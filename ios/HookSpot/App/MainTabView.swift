import SwiftUI

/// MobileNav → native TabView: Catches / Profile / Search, plus a detached "+".
/// Tapping "+" never switches tabs — it opens Upload, or Login when signed out.
/// Minimizes on scroll.
struct MainTabView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed

    enum TabID: Hashable { case catches, profile, search, add }
    @State private var selection: TabID = .catches

    var body: some View {
        @Bindable var feed = feed
        TabView(selection: Binding(
            get: { selection },
            set: { new in
                if new == .add {
                    if auth.requireSignIn() { feed.uploadOpen = true }
                } else {
                    selection = new
                }
            })) {
            Tab("Catches", systemImage: "house", value: .catches) { FeedView() }
            Tab("Profile", systemImage: "person", value: .profile) { MyProfileTab() }
            Tab("Search", systemImage: "magnifyingglass", value: .search) { SearchView() }
            Tab(ProminentTab.addTitle, systemImage: "plus", value: .add, role: .search) { Color.clear }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .sheet(isPresented: $feed.uploadOpen) { UploadView() }
        .sensoryFeedback(.selection, trigger: selection)
    }
}
