import SwiftUI

/// Accent pill button (ui/Button.jsx `primary`). Shows a PixelFishLoader while busy.
struct PrimaryButtonStyle: ButtonStyle {
    var isBusy = false
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) {
            if isBusy { PixelFishLoader(size: 16, color: .white) }
            configuration.label
        }
        .font(Typography.headline)
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, minHeight: 48)
        .background(Theme.accent.opacity(isEnabled ? 1 : 0.45), in: .capsule)
        .scaleEffect(configuration.isPressed && !reduceMotion ? 0.975 : 1)
        .animation(Motion.animation(Motion.spring, reduceMotion: reduceMotion), value: configuration.isPressed)
    }
}

/// Secondary glass pill button.
struct SecondaryButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Typography.label)
            .foregroundStyle(Theme.darkText)
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .glassSurface(in: Capsule(), interactive: true)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.975 : 1)
            .animation(Motion.animation(Motion.spring, reduceMotion: reduceMotion), value: configuration.isPressed)
    }
}

/// Field chrome shared by login/onboarding/forms on dark glass (Input.jsx).
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
}

/// Full-screen dither background used behind Login/Onboarding (bgMesh + meshOverlay).
struct DitherBackground: View {
    var body: some View {
        DitherMesh()
            .overlay(LinearGradient(colors: [.clear, Theme.darkBg.opacity(0.55)], startPoint: .top, endPoint: .bottom))
            .ignoresSafeArea()
    }
}
