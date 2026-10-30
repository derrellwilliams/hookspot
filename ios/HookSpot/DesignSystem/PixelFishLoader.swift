import SwiftUI

/// The 12-pixel fish from src/components/PixelFishLoader.jsx with its `pixelWave` keyframes:
/// a dim silhouette with a bright chase looping through it (2 s, 90 ms stagger).
struct PixelFishLoader: View {
    var size: CGFloat = 64
    var color: Color = Theme.accent

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date.now

    /// Pixels in the same order as the web's PIXELS array (24×24 viewBox).
    static let pixels: [[CGRect]] = [
        [CGRect(x: 20, y: 9, width: 2, height: 6)],
        [CGRect(x: 18, y: 15, width: 2, height: 2)],
        [CGRect(x: 18, y: 7, width: 2, height: 2)],
        [CGRect(x: 15, y: 10, width: 2, height: 2)],
        [CGRect(x: 12, y: 17, width: 6, height: 2)],
        [CGRect(x: 12, y: 5, width: 6, height: 2)],
        [CGRect(x: 10, y: 15, width: 2, height: 2)],
        [CGRect(x: 10, y: 7, width: 2, height: 2)],
        [CGRect(x: 8, y: 13, width: 2, height: 2)],
        [CGRect(x: 8, y: 9, width: 2, height: 2)],
        [CGRect(x: 6, y: 11, width: 2, height: 2)],
        [CGRect(x: 2, y: 7, width: 2, height: 10), CGRect(x: 4, y: 9, width: 2, height: 2), CGRect(x: 4, y: 13, width: 2, height: 2)],
    ]

    static let period = 2.0
    static let stagger = 0.09

    struct Frame: Equatable { var opacity: Double; var scale: Double; var flash: Double }

    /// pixelWave keyframes, each segment eased with CSS `ease-in-out`.
    static func frame(at elapsed: Double, index: Int) -> Frame {
        // reverse ordering: --i = last - i
        let delay = Double(pixels.count - 1 - index) * stagger
        let t = elapsed - delay
        guard t >= 0 else { return Frame(opacity: 1, scale: 1, flash: 0) } // CSS fill-mode none before the delay
        let p = t.truncatingRemainder(dividingBy: period) / period
        let keys: [(Double, Frame)] = [
            (0, Frame(opacity: 0.14, scale: 0.55, flash: 0)),
            (0.06, Frame(opacity: 1, scale: 1.2, flash: 1)),
            (0.13, Frame(opacity: 1, scale: 1, flash: 0)),
            (0.87, Frame(opacity: 1, scale: 1, flash: 0)),
            (1, Frame(opacity: 0.14, scale: 0.55, flash: 0)),
        ]
        for k in 0..<(keys.count - 1) where p <= keys[k + 1].0 {
            let (t0, a) = keys[k], (t1, b) = keys[k + 1]
            let e = cssEaseInOut((p - t0) / (t1 - t0))
            return Frame(opacity: a.opacity + (b.opacity - a.opacity) * e,
                         scale: a.scale + (b.scale - a.scale) * e,
                         flash: a.flash + (b.flash - a.flash) * e)
        }
        return keys[0].1
    }

    /// cubic-bezier(0.42, 0, 0.58, 1) solved for y at x.
    static func cssEaseInOut(_ x: Double) -> Double {
        func bez(_ t: Double, _ p1: Double, _ p2: Double) -> Double {
            3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t
        }
        var lo = 0.0, hi = 1.0, t = x
        for _ in 0..<20 {
            t = (lo + hi) / 2
            if bez(t, 0.42, 0.58) < x { lo = t } else { hi = t }
        }
        return bez(t, 0, 1)
    }

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let elapsed = context.date.timeIntervalSince(start)
            Canvas { ctx, canvasSize in
                let unit = canvasSize.width / 24
                for (i, rects) in Self.pixels.enumerated() {
                    let f = reduceMotion ? Frame(opacity: 1, scale: 1, flash: 0) : Self.frame(at: elapsed, index: i)
                    let bounds = rects.dropFirst().reduce(rects[0]) { $0.union($1) }
                    var path = Path()
                    for r in rects {
                        // scale around the pixel group's own center (transform-box: fill-box)
                        let scaled = CGRect(
                            x: bounds.midX + (r.minX - bounds.midX) * f.scale,
                            y: bounds.midY + (r.minY - bounds.midY) * f.scale,
                            width: r.width * f.scale, height: r.height * f.scale)
                        path.addRect(CGRect(x: scaled.minX * unit, y: scaled.minY * unit,
                                            width: scaled.width * unit, height: scaled.height * unit))
                    }
                    var layer = ctx
                    layer.opacity = f.opacity
                    layer.fill(path, with: .color(color))
                    if f.flash > 0 { layer.opacity = f.opacity * f.flash; layer.fill(path, with: .color(Theme.accentBright)) }
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel("Loading")
    }
}
