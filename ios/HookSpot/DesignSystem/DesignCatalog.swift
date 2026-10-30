import SwiftUI

/// iOS counterpart of the web /design page: renders only the real DesignSystem
/// components so it can't drift from production. Open via the Xcode preview.
struct DesignCatalog: View {
    private let sample: PhotoGroup = [Photo(
        name: "sample.jpg", userId: "u", catchId: "c", url: nil, thumbUrl: nil,
        time: .now, coordinate: Coordinate(latitude: 44.9, longitude: -121.1), species: "Brown Trout (Salmo trutta)",
        meta: ["waterBody": ["name": "Deschutes River"], "location": ["city": "Maupin", "state": "Oregon"]],
        ownerProfile: ProfileSummary(id: "u", username: "angler", displayName: "Sam Angler", avatarUrl: nil))]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                Text("HookSpot").font(Typography.wordmark)
                section("DitherMesh") { DitherMesh().frame(height: 160).clipShape(.rect(cornerRadius: 20)) }
                section("PixelFishLoader") { HStack(spacing: 24) { PixelFishLoader(size: 64); PixelFishLoader(size: 14) } }
                section("Glass card") {
                    Text("Glass surface").font(Typography.body).frame(maxWidth: .infinity).glassCard()
                        .background(DitherMesh().clipShape(.rect(cornerRadius: 24)))
                }
                section("Avatar") { HStack { Avatar(url: nil, name: "Sam", size: 36); Avatar(url: nil, name: "", size: 18) } }
                section("CatchCard") { CatchCard(group: sample) {} }
                section("SkeletonCard") { SkeletonCard() }
                section("Toast") { ToastView(toast: .init(message: "Catch added!", variant: .success)) }
                section("Type") {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Title").font(Typography.title)
                        Text("Headline").font(Typography.headline)
                        Text("Body copy").font(Typography.body)
                        Text("Condensed label").font(Typography.label)
                        Text("02/28/26 · 7:05pm").font(Typography.cardMeta)
                    }
                }
            }
            .padding(20)
        }
        .background(Theme.uiBg)
        .foregroundStyle(Theme.darkText)
    }

    private func section(_ title: String, @ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(Typography.label).foregroundStyle(Theme.darkMuted)
            content()
        }
    }
}

#Preview { DesignCatalog().preferredColorScheme(.dark) }
