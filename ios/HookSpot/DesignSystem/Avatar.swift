import SwiftUI
import NukeUI

/// Avatar with initial fallback (src/components/ui/Avatar.jsx). The one avatar recipe.
struct Avatar: View {
    var url: URL?
    var name: String
    var size: CGFloat = 36

    init(url: URL?, name: String, size: CGFloat = 36) {
        self.url = url; self.name = name; self.size = size
    }

    init(profile: ProfileSummary?, size: CGFloat = 36) {
        self.init(url: profile?.avatarUrl.flatMap(URL.init(string:)), name: Formatters.displayName(profile), size: size)
    }

    private var initial: String { name.first.map { String($0).uppercased() } ?? "?" }

    var body: some View {
        Group {
            if let url {
                LazyImage(url: url) { state in
                    if let image = state.image {
                        image.resizable().scaledToFill()
                    } else {
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(.circle)
        .accessibilityLabel(name.isEmpty ? "Avatar" : name)
    }

    private var fallback: some View {
        Circle().fill(Theme.avatarFallback)
            .overlay(
                Text(initial)
                    .font(.custom(Typography.Family.sans.rawValue, fixedSize: size * 0.389).weight(.semibold))
                    .foregroundStyle(Theme.darkMuted)
            )
    }
}
