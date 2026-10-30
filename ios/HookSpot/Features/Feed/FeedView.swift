import SwiftUI

/// MapPage on mobile web: card feed with a list/map toggle; wordmark scrolls away with the feed.
struct FeedView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed

    enum Mode: String, CaseIterable { case list, map }
    @State private var mode: Mode = .list
    @State private var path: [ProfileRoute] = []
    @State private var selection: GroupSelection?

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                // Map stays mounted in list mode so its camera survives toggling.
                FeedMapView(groups: feed.groups) { selection = GroupSelection(group: $0) }
                    .ignoresSafeArea()
                    .opacity(mode == .map ? 1 : 0)
                    .allowsHitTesting(mode == .map)
                    .accessibilityHidden(mode != .map)
                list
                    .opacity(mode == .list ? 1 : 0)
                    .allowsHitTesting(mode == .list)
                    .accessibilityHidden(mode != .list)
            }
            .background(Theme.uiBg)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("View", selection: $mode) {
                        Image(systemName: "list.bullet").tag(Mode.list).accessibilityLabel("List")
                        Image(systemName: "map").tag(Mode.map).accessibilityLabel("Map")
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 120)
                }
            }
            .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
            .navigationDestination(for: ProfileRoute.self) { UserProfileView(username: $0.username) }
            .sheet(item: $selection) { sel in
                CatchDetailView(initialGroup: sel.group, showMap: mode == .list) { username in
                    selection = nil
                    path.append(ProfileRoute(username: username))
                }
            }
            .motion(Motion.springSmooth, value: mode)
            .sensoryFeedback(.selection, trigger: mode)
        }
    }

    private var list: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 28) {
                Text("HookSpot").font(Typography.wordmark).foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                if !feed.initialized {
                    ForEach(0..<3, id: \.self) { _ in SkeletonCard() }
                } else if feed.groups.isEmpty {
                    emptyState
                } else {
                    ForEach(Array(feed.groups.enumerated()), id: \.element[0].key) { i, group in
                        CatchCard(group: group, index: i, me: auth.profileSummary) {
                            selection = GroupSelection(group: group)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .refreshable { await feed.refresh() }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            PixelFishLoader(size: 48)
            Text(auth.isSignedIn ? "No catches yet" : "No catches to show")
                .font(Typography.headline)
            Text(auth.isSignedIn ? "Add your first catch, or follow anglers to see theirs." : "Pull to refresh.")
                .font(Typography.caption).foregroundStyle(Theme.darkMuted).multilineTextAlignment(.center)
            if auth.isSignedIn {
                Button("Add Catch") { feed.uploadOpen = true }.buttonStyle(SecondaryButtonStyle())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }
}
