import SwiftUI
import Nuke
import NukeUI

/// Remote image, aspect-fill, with the dark-border placeholder the web uses behind `<img>`.
struct ThumbImage: View {
    let url: URL?
    var priority: ImageRequest.Priority = .normal

    var body: some View {
        LazyImage(url: url) { state in
            if let image = state.image { image.resizable().scaledToFill() } else { Theme.darkBorder }
        }
        .priority(priority)
    }
}
