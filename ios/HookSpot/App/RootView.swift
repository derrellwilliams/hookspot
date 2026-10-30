import SwiftUI

/// Auth gate → onboarding → tabs. Screens land in Phase 3.
struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed

    var body: some View {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-catalog") { DesignCatalog() } else { gate }
        #else
        gate
        #endif
    }

    @ViewBuilder private var gate: some View {
        switch auth.phase {
        case .loading: ProgressView()
        default: Text("\(feed.groups.count) catches")
        }
    }
}
