import SwiftUI

/// Public tabs (Catches / Profile / Search) for everyone; Login as a sheet for write
/// actions while signed out; Onboarding as a full-screen cover until a username exists.
struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed

    var body: some View {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-catalog") { DesignCatalog() } else { shell }
        #else
        shell
        #endif
    }

    private var shell: some View {
        @Bindable var auth = auth
        return MainTabView()
            .toastOverlay()
            .sheet(isPresented: $auth.loginPresented) { LoginView() }
            .fullScreenCover(isPresented: .constant(auth.phase == .needsOnboarding)) { OnboardingView() }
            .tint(Theme.iosBlue)
    }
}
