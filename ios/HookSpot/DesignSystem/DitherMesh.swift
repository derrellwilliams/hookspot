import SwiftUI

/// Animated dithered gradient (src/components/DitherMesh.jsx) — login/onboarding
/// backgrounds and the profile header. Tweak parameters here and every surface updates.
/// Frozen when Reduce Motion is on.
struct DitherMesh: View {
    var size: Float = 2.5     // px size of a dither cell
    var speed: Double = 0.08
    var scale: Float = 0.6

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date.now

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            // Paper: u_time = elapsed ms × speed / 1000
            let time = reduceMotion ? 0 : Float(context.date.timeIntervalSince(start) * speed)
            Rectangle()
                .visualEffect { content, proxy in
                    content.colorEffect(ShaderLibrary.ditherMesh(
                        .float2(proxy.size), .float(time), .float(size), .float(scale),
                        .float4(Theme.ditherBack.srgbComponents), .float4(Theme.ditherFront.srgbComponents)))
                }
        }
        .accessibilityHidden(true)
    }
}

private extension Shader.Argument {
    static func float4(_ v: SIMD4<Float>) -> Shader.Argument { .float4(v.x, v.y, v.z, v.w) }
}
