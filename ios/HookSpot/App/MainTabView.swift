import SwiftUI

/// MobileNav → native TabView. Minimizes on scroll (replaces the shrink-on-scroll pill);
/// the glass "+" sits in the bottom accessory and opens Upload (or Login when signed out).
struct MainTabView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed

    enum TabID: Hashable { case catches, profile, search }
    @State private var selection: TabID = .catches

    var body: some View {
        @Bindable var feed = feed
        TabView(selection: $selection) {
            Tab("Catches", systemImage: "house", value: .catches) { FeedView() }
            Tab("Profile", systemImage: "person", value: .profile) { MyProfileTab() }
            Tab(value: .search, role: .search) { SearchView() }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .tabViewBottomAccessory {
            Button {
                if auth.requireSignIn() { feed.uploadOpen = true }
            } label: {
                Label("Add catch", systemImage: "plus").font(Typography.label)
                    .frame(maxWidth: .infinity)
            }
            .accessibilityHint(auth.isSignedIn ? "Opens the upload flow" : "Sign in to add a catch")
        }
        .sheet(isPresented: $feed.uploadOpen) { UploadView() }
        .sensoryFeedback(.selection, trigger: selection)
    }
}
