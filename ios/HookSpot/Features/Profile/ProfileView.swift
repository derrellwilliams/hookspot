import SwiftUI
import PhotosUI

/// UserProfilePage (mobile web): dither header card → avatar, name, bio, Catches/Followers/
/// Following → Follow or settings → segmented Recent Activity / Stats.
struct ProfileView: View {
    let username: String
    /// Share link target (`?catch=`): opened once it appears in this profile's catches.
    var openCatchId: String? = nil
    var onOpenProfile: (String) -> Void

    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed

    enum Section: String, CaseIterable { case activity = "Recent Activity", stats = "Stats" }

    @State private var section: Section = .activity
    @State private var profile: ProfileSummary?
    @State private var otherPhotos: [Photo] = []
    @State private var counts = ProfileService.FollowCounts()
    @State private var isFollowing = false
    @State private var followBusy = false
    @State private var loading = true
    @State private var error: String?
    @State private var selection: GroupSelection?
    @State private var followList: ProfileService.FollowList?
    @State private var editingProfile = false
    @State private var editingGear = false
    @State private var avatarItem: PhotosPickerItem?
    @State private var pickingAvatar = false
    @State private var avatarUploading = false
    @State private var pendingCatchId: String?

    private let service = ProfileService()
    private let api = APIClient()

    private var isOwn: Bool { auth.username == username }
    private var shownProfile: ProfileSummary? { isOwn ? auth.profileSummary : profile }

    /// Own profile reads the shared feed store (so edits/uploads show instantly), like the web.
    private var groups: [PhotoGroup] {
        let photos = isOwn ? feed.photos.filter { $0.userId == auth.userId } : otherPhotos
        return PhotoGrouping.groupPhotos(photos)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                header
                VStack(spacing: 20) {
                    if !isOwn { followButton }
                    Picker("Section", selection: $section) {
                        ForEach(Section.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    content
                }
                .padding(.horizontal, 16)
            }
            .padding(.bottom, 24)
        }
        .background(Theme.uiBg)
        // Full-bleed header behind the nav bar (Wavetile's detailPageChrome).
        .scrollEdgeEffectHidden(true, for: .top)
        .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
        .navigationTitle(shownProfile.map { Formatters.displayName($0) } ?? username)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { if isOwn { settingsMenu } }
        .task(id: username) { pendingCatchId = openCatchId; await load(); openPendingCatch() }
        .onChange(of: groups.count) { openPendingCatch() }
        .refreshable { await load(); if isOwn { await feed.refresh() } }
        .sheet(item: $selection) { sel in
            CatchDetailView(initialGroup: sel.group, onOpenProfile: { u in selection = nil; onOpenProfile(u) },
                            onChange: { Task { await load() } })
        }
        .sheet(item: $followList) { kind in
            if let id = shownProfile?.id {
                FollowListSheet(profileId: id, initial: kind) { u in followList = nil; onOpenProfile(u) }
            }
        }
        .sheet(isPresented: $editingProfile) { EditProfileSheet() }
        .sheet(isPresented: $editingGear) { EditGearSheet() }
        .task(id: avatarItem) { await changeAvatar() }
    }

    // MARK: Header

    private var header: some View {
        VStack(spacing: 12) {
            avatar
            VStack(spacing: 4) {
                Text(shownProfile.map { Formatters.displayName($0) } ?? username)
                    .font(Typography.title).foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                if let bio = shownProfile?.bio, !bio.isEmpty {
                    Text(bio).font(Typography.caption).foregroundStyle(Theme.darkText.opacity(0.85))
                        .multilineTextAlignment(.center)
                }
            }
            HStack(spacing: 0) {
                stat(groups.count, "Catches")
                Divider().frame(height: 28).overlay(Theme.darkBorder)
                Button { followList = .followers } label: { stat(counts.followers, "Followers") }
                    .buttonStyle(.pressable)
                Divider().frame(height: 28).overlay(Theme.darkBorder)
                Button { followList = .following } label: { stat(counts.following, "Following") }
                    .buttonStyle(.pressable)
            }
        }
        .padding(.top, 12).padding(.bottom, 32).padding(.horizontal, 16)
        .frame(maxWidth: .infinity)
        .background(alignment: .bottom) {
            // Runs up under the nav bar and status bar, and past the top on overscroll.
            DitherMesh()
                .overlay(LinearGradient(colors: [.clear, Theme.uiBg], startPoint: .init(x: 0.5, y: 0.7), endPoint: .bottom))
                .padding(.top, -600)
                .ignoresSafeArea(edges: .top)
        }
    }

    @ViewBuilder private var avatar: some View {
        if isOwn {
            Button { pickingAvatar = true } label: { editableAvatar }
            .buttonStyle(.pressable)
            .photosPicker(isPresented: $pickingAvatar, selection: $avatarItem, matching: .images)
            .disabled(avatarUploading)
            .accessibilityLabel("Change profile photo")
        } else {
            Avatar(profile: shownProfile, size: 80)
        }
    }

    private var editableAvatar: some View {
        Avatar(profile: shownProfile, size: 80)
            .overlay { if avatarUploading { Circle().fill(.black.opacity(0.5)); PixelFishLoader(size: 22) } }
            .overlay(alignment: .bottomTrailing) {
                Icon.editPencil.view(12).foregroundStyle(Theme.uiBg).padding(6).background(Theme.tintAccent, in: Circle())
            }
    }

    private func stat(_ n: Int, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text("\(n)").font(Typography.font(.mono, 17, .medium, relativeTo: .headline)).foregroundStyle(.white)
            Text(label).font(Typography.cardAngler).foregroundStyle(Theme.darkMuted)
        }
        .frame(maxWidth: .infinity, minHeight: 44)
        .accessibilityElement(children: .combine)
    }

    private var followButton: some View {
        Button(isFollowing ? "Unfollow" : "Follow", action: toggleFollow)
            .buttonStyle(.primary())
            .disabled(followBusy || profile == nil)
            .sensoryFeedback(.success, trigger: isFollowing)
    }

    @ToolbarContentBuilder private var settingsMenu: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Menu {
                Button("Edit Profile") { editingProfile = true }
                Button("Edit Gear") { editingGear = true }
                Divider()
                Button("Sign Out", role: .destructive) { Task { await auth.signOut() } }
            } label: { Icon.settings.view(20) }
            .accessibilityLabel("Settings")
        }
    }

    // MARK: Content

    @ViewBuilder private var content: some View {
        if let error {
            Text(error).font(Typography.caption).foregroundStyle(Theme.error).padding(.top, 20)
        } else if section == .activity {
            if loading && groups.isEmpty && !(isOwn && feed.initialized) {
                ForEach(0..<2, id: \.self) { _ in SkeletonCard() }
            } else if groups.isEmpty {
                Text("No catches yet.").font(Typography.caption).foregroundStyle(Theme.darkMuted).padding(.top, 30)
            } else {
                LazyVStack(spacing: 28) {
                    ForEach(Array(groups.enumerated()), id: \.element[0].key) { i, g in
                        CatchCard(group: g, index: i, showAngler: false, me: auth.profileSummary) {
                            selection = GroupSelection(group: g)
                        }
                    }
                }
            }
        } else {
            StatsView(stats: StatsAggregations.compute(groups))
        }
    }

    // MARK: Data

    /// Share links open the catch whose groupShareId matches. Own profiles fill in from the
    /// feed store, so this also re-checks as groups arrive.
    private func openPendingCatch() {
        guard let id = pendingCatchId, let g = groups.first(where: { $0.shareId == id }) else { return }
        pendingCatchId = nil
        section = .activity
        selection = GroupSelection(group: g)
    }

    private func load() async {
        error = nil
        if isOwn {
            loading = false
            if let id = auth.userId { counts = (try? await service.followCounts(profileId: id)) ?? counts }
            return
        }
        loading = true
        defer { loading = false }
        do {
            guard let p = try await service.profile(username: username) else { error = "Profile not found"; return }
            profile = p.summary
            async let rows = api.photos(userId: p.id, ownOnly: true)
            async let c = service.followCounts(profileId: p.id)
            let me = auth.userId
            async let following: Bool = me == nil ? false : service.isFollowing(me: me!, profileId: p.id)
            let (res, cc, f) = try await (rows, c, following)
            let profilesById = Dictionary(res.profiles.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
            otherPhotos = res.rows.map { row in
                var ph = PhotoGrouping.mapPhotoRow(row)
                ph.ownerProfile = profilesById[row.userId] ?? p.summary
                return ph
            }
            counts = cc
            isFollowing = f
        } catch {
            self.error = "Failed to load profile"
        }
    }

    private func toggleFollow() {
        guard auth.requireSignIn(), let me = auth.userId, let id = profile?.id else { return }
        followBusy = true
        let wasFollowing = isFollowing
        Task {
            defer { followBusy = false }
            do {
                if wasFollowing {
                    try await service.unfollow(me: me, profileId: id)
                    feed.removeUser(id)
                } else {
                    try await service.follow(me: me, profileId: id)
                }
                isFollowing.toggle()
                counts.followers += wasFollowing ? -1 : 1
                if !wasFollowing { await feed.refresh() } // their catches join your feed
            } catch {
                feed.showToast(wasFollowing ? "Failed to unfollow" : "Failed to follow")
            }
        }
    }

    private func changeAvatar() async {
        guard let avatarItem, let userId = auth.userId else { return }
        avatarUploading = true
        defer { avatarUploading = false; self.avatarItem = nil }
        do {
            guard let data = try await avatarItem.loadTransferable(type: Data.self) else { return }
            let url = try await service.uploadAvatar(userId: userId, imageData: data)
            // Cache-bust: the path is stable (avatar.jpg, upsert), so the CDN URL never changes.
            let busted = url.absoluteString + "?v=\(Int(Date.now.timeIntervalSince1970))"
            try await service.setAvatarURL(userId: userId, url: busted)
            auth.applyProfile(username: nil, avatarUrl: busted)
        } catch {
            feed.showToast("Failed to update photo")
        }
    }
}

extension ProfileService.FollowList: Identifiable {
    public var id: Self { self }
}
