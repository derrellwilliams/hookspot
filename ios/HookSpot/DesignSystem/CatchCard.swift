import SwiftUI
import NukeUI

/// Shared catch card (CatchGrid.jsx CatchCard) — used by the feed, search and profile grids.
struct CatchCard: View {
    let group: PhotoGroup
    var index: Int = 0
    var showAngler = true
    /// Signed-in user's own profile — own catches show it rather than the row's owner profile.
    var me: ProfileSummary?
    var action: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    private var lead: Photo { group.lead ?? group[0] }
    private var species: String? { Formatters.cleanSpecies(lead.species) }
    private var owner: ProfileSummary? { (group.first?.isOwn ?? false) ? me : group.first?.ownerProfile }
    private var ownerName: String { Formatters.displayName(owner) }
    private var location: String? { Formatters.formatCatchLocation(lead) }
    private var dateText: String? { lead.time.map { Formatters.formatDateNumeric($0, hideTime: lead.hideTime) } }

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                Color.clear
                    .aspectRatio(4 / 3, contentMode: .fit)
                    .overlay {
                        LazyImage(url: lead.thumbUrl ?? lead.url) { state in
                            if let image = state.image {
                                image.resizable().scaledToFill()
                            } else {
                                Theme.darkBorder
                            }
                        }
                        .priority(index < 2 ? .high : .normal)
                    }
                    .background(Theme.darkBorder)
                    .clipShape(.rect(cornerRadius: Theme.cardRadius, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    if showAngler, !ownerName.isEmpty || owner?.avatarUrl != nil {
                        HStack(spacing: 6) {
                            Avatar(profile: owner, size: 18)
                            if !ownerName.isEmpty {
                                Text(ownerName).font(Typography.cardAngler).foregroundStyle(Theme.darkMuted).lineLimit(1)
                            }
                        }
                    }
                    if let species {
                        Text(species).font(Typography.cardSpecies).foregroundStyle(.white).lineLimit(1)
                    }
                    if let dateText {
                        Text(dateText).font(Typography.cardMeta).foregroundStyle(Theme.darkMuted).lineLimit(1)
                    }
                    if let location {
                        Text(location).font(Typography.cardMeta).foregroundStyle(Theme.darkMuted).lineLimit(1)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.pressable)
        .opacity(appeared ? 1 : 0)
        .onAppear {
            guard !appeared else { return }
            // Only the first screenful fades in (staggered 40ms). Cards further down appear
            // as they scroll in, which happens constantly, so they don't animate.
            guard index < 9, !reduceMotion else { appeared = true; return }
            withAnimation(Motion.easeOut(0.25).delay(Double(index) * 0.04)) { appeared = true }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel([species.map { "\($0) catch" } ?? "Fishing catch", showAngler ? ownerName : nil, dateText, location]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", "))
        .accessibilityAddTraits(.isButton)
    }
}

/// Loading placeholder matching the card layout (SkeletonCard), with the web's shimmer.
struct SkeletonCard: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: CGFloat = -1

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            shimmer.aspectRatio(4 / 3, contentMode: .fit)
                .clipShape(.rect(cornerRadius: Theme.cardRadius, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                shimmer.frame(height: 15).containerRelativeFrame(.horizontal) { w, _ in w * 0.55 }
                    .clipShape(.rect(cornerRadius: 4))
                shimmer.frame(height: 11).containerRelativeFrame(.horizontal) { w, _ in w * 0.38 }
                    .clipShape(.rect(cornerRadius: 3))
                shimmer.frame(height: 11).containerRelativeFrame(.horizontal) { w, _ in w * 0.38 }
                    .clipShape(.rect(cornerRadius: 3))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 2.2).repeatForever(autoreverses: false)) { phase = 1 } // constant motion → linear
        }
        .accessibilityLabel("Loading catch")
    }

    private var shimmer: some View {
        LinearGradient(stops: [.init(color: Theme.skeletonBase, location: 0.25),
                               .init(color: Theme.skeletonHighlight, location: 0.5),
                               .init(color: Theme.skeletonBase, location: 0.75)],
                       startPoint: UnitPoint(x: phase, y: 0.5), endPoint: UnitPoint(x: phase + 2, y: 0.5))
    }
}
