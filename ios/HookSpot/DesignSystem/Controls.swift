import SwiftUI

// Content controls, after Wavetile's system (Apple Music / Podcasts style): flat tinted
// capsules — a faint wash of the accent with an accent label — for actions in content.
// Glass is only for chrome that floats above content (nav bar, tab bar, toast).

extension Theme {
    /// Accent for tinted controls on the dark UI (the brand blue is too dark to read as text here).
    static let tintAccent = accentBright
    static let tint = tintAccent.opacity(0.14)
    static let tintPressed = tintAccent.opacity(0.24)
    static let pressedScale: CGFloat = 0.975
}

/// Tinted capsule (`.tinted`, main actions) or small pill (`.tinted(.small)`, inline actions).
struct TintedButtonStyle: ButtonStyle {
    enum Size { case regular, small }
    var size: Size = .regular
    /// Full-width capsule (a screen's main action).
    var fullWidth = false
    /// Busy, not unavailable: shows the fish loader and stays solid.
    var isBusy = false

    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        HStack(spacing: 8) {
            if isBusy { PixelFishLoader(size: size == .regular ? 16 : 12, color: Theme.tintAccent) }
            configuration.label
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .font(size == .regular ? Typography.headline : Typography.label.weight(.semibold))
        .foregroundStyle(Theme.tintAccent)
        .padding(.horizontal, size == .regular ? 16 : 12)
        .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: size == .regular ? 48 : 32)
        .background(pressed ? Theme.tintPressed : Theme.tint, in: .capsule)
        .frame(minHeight: 44) // pills stay a full tap target
        .contentShape(.rect)
        .scaleEffect(pressed && !reduceMotion ? Theme.pressedScale : 1)
        .animation(Motion.animation(Motion.spring, reduceMotion: reduceMotion), value: pressed)
        .opacity(isEnabled || isBusy ? 1 : 0.4)
    }
}

extension ButtonStyle where Self == TintedButtonStyle {
    static var tinted: TintedButtonStyle { .init() }
    static func tinted(_ size: TintedButtonStyle.Size) -> TintedButtonStyle { .init(size: size) }
    /// Full-width tinted capsule, optionally busy.
    static func primary(busy: Bool = false) -> TintedButtonStyle { .init(fullWidth: true, isBusy: busy) }
}

/// Low-emphasis action with no background (Use a different email, Clear): accent label.
struct TextButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Typography.body.weight(.semibold))
            .foregroundStyle(Theme.tintAccent)
            .frame(minHeight: 44)
            .contentShape(.rect)
            .opacity(configuration.isPressed ? 0.5 : isEnabled ? 1 : 0.4)
            .animation(.snappy(duration: 0.15), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == TextButtonStyle {
    static var text: TextButtonStyle { .init() }
}

/// Exposed filter chip: tinted pill when off, solid accent (Badge-style) when on.
struct FilterPill<Label: View>: View {
    let isOn: Bool
    let action: () -> Void
    @ViewBuilder let label: Label

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: action) {
            label
                .font(Typography.label.weight(.semibold))
                .lineLimit(1)
                .foregroundStyle(isOn ? Theme.uiBg : Theme.tintAccent)
                .padding(.horizontal, 14)
                .frame(minHeight: 34)
                .background(isOn ? Theme.tintAccent : Theme.tint, in: .capsule)
                .frame(minHeight: 44)
                .contentShape(.rect)
        }
        .buttonStyle(.pressable)
        .accessibilityAddTraits(isOn ? .isSelected : [])
        .motion(Motion.springSnappy, value: isOn)
    }
}

/// Field chrome shared by login/onboarding/forms (Input.jsx).
struct FieldChrome: ViewModifier {
    enum State { case normal, error, ok }
    var state: State = .normal

    func body(content: Content) -> some View {
        content
            .font(Typography.body)
            .foregroundStyle(Theme.darkText)
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .background(Color.white.opacity(0.06), in: .rect(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(borderColor, lineWidth: state == .normal ? 0.5 : 1))
    }

    private var borderColor: Color {
        switch state {
        case .normal: Theme.darkBorder
        case .error: .red.opacity(0.8)
        case .ok: Theme.iosBlue
        }
    }
}

extension View {
    func fieldChrome(_ state: FieldChrome.State = .normal) -> some View { modifier(FieldChrome(state: state)) }

    /// Flat content card (replaces glass on in-content panels).
    func surfaceCard(padding: CGFloat = 20, cornerRadius: CGFloat = 24) -> some View {
        self.padding(padding)
            .background(Theme.darkSurface.opacity(0.92), in: .rect(cornerRadius: cornerRadius, style: .continuous))
    }
}

/// Full-screen dither background used behind Login/Onboarding (bgMesh + meshOverlay).
struct DitherBackground: View {
    var body: some View {
        DitherMesh()
            .overlay(LinearGradient(colors: [.clear, Theme.darkBg.opacity(0.55)], startPoint: .top, endPoint: .bottom))
            .ignoresSafeArea()
    }
}
