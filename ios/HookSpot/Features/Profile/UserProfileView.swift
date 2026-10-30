import SwiftUI

/// /user/:username — pushed onto the current tab's NavigationStack.
struct UserProfileView: View {
    let username: String
    @State private var next: ProfileRoute?

    var body: some View {
        ProfileView(username: username) { next = ProfileRoute(username: $0) }
            .navigationDestination(item: $next) { UserProfileView(username: $0.username) }
    }
}
