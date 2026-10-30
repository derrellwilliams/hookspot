import SwiftUI
import MapboxMaps

@main
struct HookSpotApp: App {
    @State private var auth = AuthStore()
    @State private var feed = FeedStore()
    @State private var router = Router()

    init() {
        // Public pk. token only (Secrets.xcconfig); the secret sk. token never ships.
        MapboxOptions.accessToken = AppConfig.mapboxPublicToken
        ProminentTab.install()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(feed)
                .environment(router)
                // Universal links (hook-spot.com/user/...) and hookspot:// both arrive here.
                .onOpenURL { url in if let link = DeepLink(url: url) { router.pendingLink = link } }
                .preferredColorScheme(.dark)
                .task {
                    auth.onFeedOwnerChange = { [feed] userId in feed.load(for: userId) }
                    auth.start()
                    #if DEBUG
                    if let arg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("-openURL=") }),
                       let url = URL(string: String(arg.dropFirst("-openURL=".count))) {
                        router.pendingLink = DeepLink(url: url)
                    }
                    #endif
                }
        }
    }
}
