import SwiftUI
import PhotosUI

/// Navigation value for a profile (`/user/:username`).
struct ProfileRoute: Hashable {
    let username: String
    /// Open this catch once the profile loads (share links: `?catch=`).
    var catchId: String? = nil
}

/// Wraps a group so it can drive `.sheet(item:)`.
struct GroupSelection: Identifiable, Hashable {
    let group: PhotoGroup
    var id: String { group.first?.key ?? UUID().uuidString }
}

/// PopupCarousel inside CatchDialog: the catch-detail sheet used by feed, search and profile.
struct CatchDetailView: View {
    let initialGroup: PhotoGroup
    var showMap = true
    var onOpenProfile: ((String) -> Void)?
    /// Called after a delete or edit so non-feed lists (search/profile) can refresh.
    var onChange: (() -> Void)?

    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed
    @Environment(\.dismiss) private var dismiss

    @State private var localGroup: PhotoGroup?
    @State private var current = 0
    @State private var editing = false

    private var leadKey: String { initialGroup[0].key }
    /// Latest copy: feed store first (it receives edits/enrichment), else our local copy.
    private var group: PhotoGroup {
        feed.groups.first { $0.contains { $0.key == leadKey } } ?? localGroup ?? initialGroup
    }
    private var lead: Photo { group[0] }
    private var isOwn: Bool { initialGroup[0].isOwn || initialGroup[0].userId == auth.userId }
    private var photo: Photo { group[min(current, group.count - 1)] }

    private var ownerUsername: String? { isOwn ? auth.username : lead.ownerProfile?.username }
    private var shareURL: URL? {
        guard let u = ownerUsername else { return nil }
        return AppConfig.shareURL(username: u, catchId: lead.catchId ?? lead.name)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    carousel
                    details.padding(.horizontal, 20)
                    if showMap {
                        Group {
                            if let c = lead.coordinate { MiniMap(coordinate: c) }
                            else { Text("No location").font(Typography.caption).foregroundStyle(Theme.darkMuted)
                                    .frame(maxWidth: .infinity, maxHeight: .infinity).background(Theme.darkSurface) }
                        }
                        .frame(height: 180)
                        .clipShape(.rect(cornerRadius: Theme.cardRadius, style: .continuous))
                        .padding(.horizontal, 20)
                    }
                }
                .padding(.bottom, 24)
            }
            .toolbar { toolbar }
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(.thinMaterial)
        .presentationDragIndicator(.visible)
        .sheet(isPresented: $editing) {
            CatchEditView(group: group) { result in
                switch result {
                case .saved(let updated): localGroup = updated; onChange?()
                case .deleted: onChange?(); dismiss()
                case .cancelled: break
                }
            }
        }
    }

    private var carousel: some View {
        VStack(spacing: 10) {
            TabView(selection: $current) {
                ForEach(Array(group.enumerated()), id: \.element.key) { i, p in
                    ThumbImage(url: p.url, priority: .high)
                        .clipped()
                        .tag(i)
                        .accessibilityLabel(Formatters.cleanSpecies(lead.species).map { "\($0), photo \(i + 1) of \(group.count)" } ?? "Photo \(i + 1) of \(group.count)")
                }
            }
            .tabViewStyle(.page(indexDisplayMode: group.count > 1 ? .automatic : .never))
            .aspectRatio(4 / 3, contentMode: .fit)
            .clipShape(.rect(cornerRadius: Theme.cardRadius, style: .continuous))
            .padding(.horizontal, 12)
        }
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !isOwn, let owner = lead.ownerProfile, let username = owner.username {
                Button {
                    onOpenProfile?(username)
                } label: {
                    HStack(spacing: 8) {
                        Avatar(profile: owner, size: 24)
                        Text(Formatters.displayName(owner)).font(Typography.label).foregroundStyle(Theme.darkText)
                    }
                    .frame(minHeight: 44)
                }
                .buttonStyle(.pressable)
                .accessibilityHint("Opens profile")
            }
            Text(Formatters.cleanSpecies(lead.species) ?? "—")
                .font(Typography.title).foregroundStyle(.white)
                .accessibilityAddTraits(.isHeader)
            Text(Formatters.formatDateFull(photo.time, hideTime: photo.hideTime))
                .font(Typography.cardMeta).foregroundStyle(Theme.darkMuted)
            if let line = weatherLocationLine {
                Text(line).font(Typography.cardMeta).foregroundStyle(Theme.darkMuted)
            }
            let gear = [lead.rod, lead.fly].compactMap { $0 }.filter { !$0.isEmpty }
            if !gear.isEmpty {
                Text(gear.joined(separator: " · ")).font(Typography.cardMeta).foregroundStyle(Theme.darkMuted)
            }
        }
    }

    /// "61°F · Clear · Deschutes River, Oregon" (weather from the current photo, location from the lead).
    private var weatherLocationLine: String? {
        let location = Formatters.formatCatchLocation(lead)
        var parts: [String] = []
        if let w = photo.weather, let t = w.temp, let c = w.condition { parts.append("\(Int(t))°F · \(c)") }
        if let location { parts.append(location) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    @ToolbarContentBuilder private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button { dismiss() } label: { Icon.xmark.view(18) }.accessibilityLabel("Close")
        }
        if let shareURL {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: shareURL) { Icon.share.view(18) }.accessibilityLabel("Share")
            }
        }
        if isOwn {
            ToolbarItem(placement: .primaryAction) {
                Button { editing = true } label: { Icon.editPencil.view(18) }.accessibilityLabel("Edit")
            }
        }
    }
}
