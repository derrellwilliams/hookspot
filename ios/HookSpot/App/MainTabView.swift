import SwiftUI

/// MobileNav → native TabView: Catches / Profile / Search, plus a detached "+".
/// Tapping "+" never switches tabs — it opens Upload, or Login when signed out.
/// Minimizes on scroll.
struct MainTabView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed
    @Environment(Router.self) private var router

    enum TabID: Hashable { case catches, profile, search, add }
    @State private var selection: TabID = {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains(where: { $0.hasPrefix("-search=") }) { return .search }
        #endif
        return .catches
    }()

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
            Tab(value: .catches) { FeedView() } label: { Label { Text("Catches") } icon: { Icon.home.image }.labelStyle(.iconOnly) }
            Tab(value: .profile) { MyProfileTab() } label: { Label { Text("Profile") } icon: { Icon.user.image }.labelStyle(.iconOnly) }
            Tab(value: .search) { SearchView() } label: { Label { Text("Search") } icon: { Icon.search.image }.labelStyle(.iconOnly) }
            Tab(value: .add, role: .search) { Color.clear } label: { Label { Text(ProminentTab.addTitle) } icon: { Icon.plus.image }.labelStyle(.iconOnly) }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .sheet(isPresented: $feed.uploadOpen) { UploadView() }
        .onChange(of: router.pendingLink) { _, link in if link != nil { selection = .catches; feed.uploadOpen = false } }
    }
}
