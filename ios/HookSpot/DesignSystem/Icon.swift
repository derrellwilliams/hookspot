import SwiftUI

/// Lucide icons (same set as src/components/icons.js, stroke 2), bundled as template SVGs in
/// Assets.xcassets/Icons — regenerate from lucide-react with the script noted in CLAUDE.md.
enum Icon: String {
    case home = "lucide.house"
    case user = "lucide.user"
    case userCircle = "lucide.circle-user-round"
    case group = "lucide.users"
    case search = "lucide.search"
    case plus = "lucide.plus"
    case listView = "lucide.layout-list"
    case map = "lucide.map"
    case mapPin = "lucide.map-pin"
    case editPencil = "lucide.pencil"
    case xmark = "lucide.x"
    case share = "lucide.share"
    case check = "lucide.check"
    case checkCircle = "lucide.circle-check"
    case chevronsUpDown = "lucide.chevrons-up-down"
    case navLeft = "lucide.chevron-left"
    case navRight = "lucide.chevron-right"
    case mediaImage = "lucide.image"
    case settings = "lucide.settings"
    case camera = "lucide.camera"

    var image: Image { Image(rawValue).renderingMode(.template) }
}

extension Image {
    init(icon: Icon) { self = icon.image }
}

extension Icon {
    /// Sized icon view (asset images ignore `.font`). Scales with Dynamic Type.
    func view(_ size: CGFloat = 20) -> some View { IconView(icon: self, size: size) }
}

private struct IconView: View {
    let icon: Icon
    @ScaledMetric private var size: CGFloat
    init(icon: Icon, size: CGFloat) { self.icon = icon; _size = ScaledMetric(wrappedValue: size, relativeTo: .body) }
    var body: some View {
        icon.image.resizable().scaledToFit().frame(width: size, height: size)
    }
}
