import SwiftUI

/// Same spring numbers as src/lib/motion.js (mass 1). Every call site goes through
/// `Motion.animation(_:reduceMotion:)` or `.motion(...)`, which swaps springs for a
/// short fade-friendly ease when Reduce Motion is on.
enum Motion {
    static let spring = Animation.interpolatingSpring(mass: 1, stiffness: 300, damping: 24)        // tap/hover
    static let springTight = Animation.interpolatingSpring(mass: 1, stiffness: 400, damping: 35)   // indicators
    static let springSmooth = Animation.interpolatingSpring(mass: 1, stiffness: 300, damping: 34)  // layout resizes
    static let springPop = Animation.interpolatingSpring(mass: 1, stiffness: 400, damping: 25)     // menus, chips
    static let springSnappy = Animation.interpolatingSpring(mass: 1, stiffness: 500, damping: 38)  // toggle thumbs
    /// EASE_OUT cubic-bezier(0.23, 1, 0.32, 1)
    static func easeOut(_ duration: Double) -> Animation { .timingCurve(0.23, 1, 0.32, 1, duration: duration) }

    /// Press feedback: fast and settled, no overshoot (scale 0.97–0.98, 100–160ms ease-out).
    static let press = easeOut(0.16)
    /// Toasts enter/exit often and get interrupted by the next one: a spring keeps the
    /// velocity when retargeted, and a small bounce keeps it from feeling playful.
    static let toast = Animation.spring(duration: 0.35, bounce: 0.1)

    static let reduced = Animation.easeInOut(duration: 0.15)

    static func animation(_ a: Animation, reduceMotion: Bool) -> Animation { reduceMotion ? reduced : a }
}

private struct MotionModifier<V: Equatable>: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let animation: Animation
    let value: V
    func body(content: Content) -> some View {
        content.animation(Motion.animation(animation, reduceMotion: reduceMotion), value: value)
    }
}

extension View {
    /// `.animation(_:value:)` that respects Reduce Motion.
    func motion<V: Equatable>(_ animation: Animation, value: V) -> some View {
        modifier(MotionModifier(animation: animation, value: value))
    }
}

/// `whileTap={{ scale: 0.975 }}` press feedback.
struct PressableStyle: ButtonStyle {
    var scale: CGFloat = 0.975
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(.rect)
            .scaleEffect(configuration.isPressed && !reduceMotion ? scale : 1)
            .opacity(configuration.isPressed && reduceMotion ? 0.8 : 1)
            .animation(Motion.animation(Motion.press, reduceMotion: reduceMotion), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == PressableStyle {
    static var pressable: PressableStyle { PressableStyle() }
}
