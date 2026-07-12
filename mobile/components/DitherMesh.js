import { useMemo } from 'react'
import { Canvas, Fill, Shader, ImageShader, Skia, useClock, AlphaType, ColorType } from '@shopify/react-native-skia'
import { useDerivedValue, useSharedValue } from 'react-native-reanimated'

// Native port of the web DitherMesh (src/components/DitherMesh.jsx), which
// wraps @paper-design/shaders' Dithering. Only the config the app uses is
// ported: warp shape + 4x4 ordered Bayer dithering, plus the noise grain the
// web layers on top separately. Animates live at the web's speed via useClock.
//
// Sizing: percent dims + onSize, NOT StyleSheet.absoluteFillObject — on this
// Fabric version, absolute children anchored top:0/bottom:0 resolve to height
// 0 (a 0-size CAMetalLayer can't allocate drawables, which looked like "Skia
// is broken on the simulator"). width/height '100%' resolves correctly, and
// with explicit dims the canvas also paints in normal sibling order.
// See mobile/AGENTS.md.
const source = Skia.RuntimeEffect.Make(`
uniform float u_time;
uniform float2 u_resolution;
uniform float u_pxSize;
uniform float u_scale;
uniform half3 u_colorBack;
uniform half3 u_colorFront;

float bayer4x4(float2 uv) {
  float2 p = floor(fract(uv / 4.0) * 4.0);
  float x0 = mod(p.x, 2.0);
  float y0 = mod(p.y, 2.0);
  float x1 = floor(p.x / 2.0);
  float y1 = floor(p.y / 2.0);
  float m2a = 2.0 * mod(x0 + y0, 2.0) + y0;
  float m2b = 2.0 * mod(x1 + y1, 2.0) + y1;
  return (4.0 * m2a + m2b) / 16.0;
}

half4 main(float2 xy) {
  float t = 0.5 * u_time;

  // Match GL's bottom-left fragcoord origin (web parity)
  float2 fragCoord = float2(xy.x, u_resolution.y - xy.y);
  float2 pxSizeUV = (fragCoord - 0.5 * u_resolution) / u_pxSize;
  float2 pixelized = (floor(pxSizeUV) + 0.5) * u_pxSize;

  // Pattern-box math with the library defaults (fit none, world = canvas,
  // origin .5, no offset/rotation) reduces to centered px / scale + .5
  float2 shapeUV = pixelized / u_scale + 0.5;

  // Warp shape
  shapeUV *= 0.003;
  for (float i = 1.0; i < 6.0; i += 1.0) {
    shapeUV.x += 0.6 / i * cos(i * 2.5 * shapeUV.y + t);
    shapeUV.y += 0.6 / i * cos(i * 1.5 * shapeUV.x + t);
  }
  float shape = 0.15 / max(0.001, abs(sin(t - shapeUV.y - shapeUV.x)));
  shape = smoothstep(0.02, 1.0, shape);

  float dither = bayer4x4(pxSizeUV) - 0.5;
  float res = step(0.5, shape + dither);

  return half4(mix(u_colorBack, u_colorFront, half(res)), 1.0);
}
`)

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// 256x256 opaque grayscale white noise, generated once (mirrors the web's
// noise.svg speckle, which RN can't hand to Skia without a bundler round-trip)
let _noiseImage = null
function getNoiseImage() {
  if (_noiseImage) return _noiseImage
  const size = 256
  const pixels = new Uint8Array(size * size * 4)
  let seed = 987654321
  for (let i = 0; i < size * size; i++) {
    // xorshift32 — deterministic so every surface gets the same grain
    seed ^= seed << 13; seed >>>= 0
    seed ^= seed >> 17
    seed ^= seed << 5; seed >>>= 0
    const v = seed & 0xff
    pixels[i * 4] = v
    pixels[i * 4 + 1] = v
    pixels[i * 4 + 2] = v
    pixels[i * 4 + 3] = 255
  }
  _noiseImage = Skia.Image.MakeImage(
    { width: size, height: size, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Opaque },
    Skia.Data.fromBytes(pixels),
    size * 4,
  )
  return _noiseImage
}

// The canvas works in dp; the shader's px-cell math is resolution-uniform, so
// dp-space uniforms (size/scale unscaled) produce the same image as the web's
// physical-px rendering with dpr-scaled uniforms.
export function DitherMesh({
  colorBack = '#1a1952',
  colorFront = '#2e2e76',
  size = 2.5,
  speed = 0.08,
  scale = 0.6,
  // Web parity: same animation, offset to a good composition at mount
  time = 34,
  grain = true,
  // Web: noise.svg has 0.5 baked-in opacity + screen blend, overlaid at 0.28
  grainOpacity = 0.14,
  style,
}) {
  const clock = useClock()
  const dims = useSharedValue({ width: 0, height: 0 })
  const colors = useMemo(
    () => ({ back: hexToRgb(colorBack), front: hexToRgb(colorFront) }),
    [colorBack, colorFront],
  )
  const uniforms = useDerivedValue(() => ({
    u_time: time + (clock.value / 1000) * speed,
    u_resolution: [dims.value.width, dims.value.height],
    u_pxSize: size,
    u_scale: scale,
    u_colorBack: colors.back,
    u_colorFront: colors.front,
  }), [time, speed, size, scale, colors])

  return (
    <Canvas
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: colorBack,
          pointerEvents: 'none',
        },
        style,
      ]}
      onSize={dims}
    >
      <Fill>
        <Shader source={source} uniforms={uniforms} />
      </Fill>
      {grain && (
        <Fill blendMode="screen" opacity={grainOpacity}>
          <ImageShader image={getNoiseImage()} tx="repeat" ty="repeat" fm="nearest" />
        </Fill>
      )}
    </Canvas>
  )
}
