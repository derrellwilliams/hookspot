#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// Port of Paper's Dithering shader (@paper-design/shaders dithering.js) for the
// settings DitherMesh.jsx uses: shape "warp", type "4x4" Bayer, default sizing
// (fit none, centered origin, no rotation/offset). Coordinates are in points, so
// pxSize/scale match the web's CSS-pixel values.

constant int bayer4x4[16] = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 };

static float bayer4(float2 uv) {
    int2 pos = int2(fract(uv / 4.0) * 4.0);
    return float(bayer4x4[pos.y * 4 + pos.x]) / 16.0;
}

[[ stitchable ]] half4 ditherMesh(float2 position, half4 color, float2 size, float time,
                                  float pxSize, float scale, float4 back, float4 front) {
    float t = 0.5 * time;
    // GL's gl_FragCoord is bottom-up; flip so the pattern matches the web.
    float2 frag = float2(position.x, size.y - position.y);

    float2 pxSizeUV = (frag - 0.5 * size) / pxSize;
    float2 canvasPixelizedUV = (floor(pxSizeUV) + 0.5) * pxSize;

    // Pattern branch with default sizing reduces to centered point coords / scale.
    float2 shapeUV = canvasPixelizedUV / scale + 0.5;

    // Warp
    shapeUV *= 0.003;
    for (float i = 1.0; i < 6.0; i++) {
        shapeUV.x += 0.6 / i * cos(i * 2.5 * shapeUV.y + t);
        shapeUV.y += 0.6 / i * cos(i * 1.5 * shapeUV.x + t);
    }
    float shape = 0.15 / max(0.001, abs(sin(t - shapeUV.y - shapeUV.x)));
    shape = smoothstep(0.02, 1.0, shape);

    float dithering = bayer4(pxSizeUV) - 0.5;
    float res = step(0.5, shape + dithering);

    float3 fg = front.rgb * front.a;
    float3 bg = back.rgb * back.a;
    float3 outColor = fg * res;
    float opacity = front.a * res;
    outColor += bg * (1.0 - opacity);
    opacity += back.a * (1.0 - opacity);
    return half4(half3(outColor), half(opacity));
}
