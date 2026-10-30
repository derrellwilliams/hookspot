import SwiftUI

/// Profile tab: your profile when signed in (the /profile redirect), else a sign-in prompt.
struct MyProfileTab: View {
    @Environment(AuthStore.self) private var auth
    @State private var path: [ProfileRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let username = auth.username {
                    ProfileView(username: username) { path.append(ProfileRoute(username: $0)) }
                } else {
                    VStack(spacing: 16) {
                        PixelFishLoader(size: 48)
                        Text("Sign in to see your profile").font(Typography.headline)
                        Button("Sign In") { auth.requireSignIn() }.buttonStyle(SecondaryButtonStyle())
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.uiBg)
                }
            }
            .navigationDestination(for: ProfileRoute.self) { UserProfileView(username: $0.username) }
        }
    }
}
