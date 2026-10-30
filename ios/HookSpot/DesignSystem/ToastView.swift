import SwiftUI

/// Small glass capsule toast (src/components/Toast). Attach once at the root with `.toastOverlay(feed)`.
struct ToastView: View {
    let toast: FeedStore.Toast

    var body: some View {
        HStack(spacing: 8) {
            if toast.variant == .success {
                Icon.checkCircle.view(16).foregroundStyle(Theme.iosBlue)
            }
            Text(toast.message).font(Typography.caption.weight(.medium)).foregroundStyle(Theme.darkText)
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .glassSurface(in: Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.updatesFrequently)
    }
}

private struct ToastOverlay: ViewModifier {
    @Environment(FeedStore.self) private var feed
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            if let toast = feed.toast {
                ToastView(toast: toast)
                    .padding(.top, 8)
                    .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
                    .id(toast.id)
                    .onAppear { AccessibilityNotification.Announcement(toast.message).post() }
            }
        }
        .motion(Motion.springPop, value: feed.toast)
        .sensoryFeedback(trigger: feed.toast) { _, new in new?.variant == .success ? .success : nil }
    }
}

extension View {
    func toastOverlay() -> some View { modifier(ToastOverlay()) }
}
