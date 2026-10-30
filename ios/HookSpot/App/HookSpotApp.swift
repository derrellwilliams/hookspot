import SwiftUI
import MapboxMaps

@main
struct HookSpotApp: App {
    @State private var auth = AuthStore()
    @State private var feed = FeedStore()

    init() {
        // Public pk. token only (Secrets.xcconfig); the secret sk. token never ships.
        MapboxOptions.accessToken = AppConfig.mapboxPublicToken
    }

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
