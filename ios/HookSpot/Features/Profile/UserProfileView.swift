import SwiftUI

/// /user/:username — pushed onto the current tab's NavigationStack.
struct UserProfileView: View {
    let username: String
    var openCatchId: String? = nil
    @State private var next: ProfileRoute?

    var body: some View {
        ProfileView(username: username, openCatchId: openCatchId) { next = ProfileRoute(username: $0) }
            .navigationDestination(item: $next) { UserProfileView(username: $0.username, openCatchId: $0.catchId) }
    }
}
