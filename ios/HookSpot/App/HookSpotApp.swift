import SwiftUI

@main
struct HookSpotApp: App {
    @State private var auth = AuthStore()
    @State private var feed = FeedStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(feed)
                .preferredColorScheme(.dark)
                .task {
                    auth.onFeedOwnerChange = { [feed] userId in feed.load(for: userId) }
                    auth.start()
                }
        }
    }
}
