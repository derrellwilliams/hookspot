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

    private static let back = Theme.ditherBack.srgbComponents
    private static let front = Theme.ditherFront.srgbComponents

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            // Paper: u_time = elapsed ms × speed / 1000
            let time = reduceMotion ? 0 : Float(context.date.timeIntervalSince(start) * speed)
            // visualEffect runs off the main actor: copy the values in, don't capture self.
            Rectangle()
                .visualEffect { [size, scale, back = Self.back, front = Self.front] content, proxy in
                    content.colorEffect(ShaderLibrary.ditherMesh(
                        .float2(proxy.size), .float(time), .float(size), .float(scale),
                        .float4(back.x, back.y, back.z, back.w), .float4(front.x, front.y, front.z, front.w)))
                }
        }
        .accessibilityHidden(true)
    }
}


