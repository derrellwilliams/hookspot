import SwiftUI

/// SearchPage: anglers by name, catches by species/fly/rod/location text and date range.
struct SearchView: View {
    @Environment(AuthStore.self) private var auth

    enum Scope: String, CaseIterable { case all = "All", anglers = "Anglers", catches = "Catches" }
    enum Whose: Hashable { case everyone, me }

    @State private var query: String = {
        #if DEBUG
        if let a = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("-search=") }) { return String(a.dropFirst(8)) }
        #endif
        return ""
    }()
    @State private var scope: Scope = .all
    @State private var whose: Whose = .everyone
    @State private var from: Date?
    @State private var to: Date?
    @State private var users: [ProfileSummary] = []
    @State private var groups: [PhotoGroup] = []
    @State private var truncated = false
    @State private var loading = false
    @State private var showFilters = false
    @State private var path: [ProfileRoute] = []
    @State private var selection: GroupSelection?

    private let api = APIClient()

    private var trimmed: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var hasCatchFilters: Bool { !trimmed.isEmpty || from != nil || to != nil }
    private var isSearching: Bool { !trimmed.isEmpty || hasCatchFilters }
    private var showAnglers: Bool { scope != .catches && !trimmed.isEmpty && !users.isEmpty }
    private var showCatches: Bool { scope != .anglers && hasCatchFilters && !groups.isEmpty }
    private var filtersActive: Bool { whose == .me || from != nil || to != nil }

    /// Everything that should re-run the search.
    private struct Key: Equatable { let q: String; let whose: Whose; let from: Date?; let to: Date?; let me: String? }

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    if !isSearching {
                        idle
                    } else if loading && users.isEmpty && groups.isEmpty {
                        HStack { Spacer(); PixelFishLoader(size: 48); Spacer() }.padding(.top, 60)
                    } else if !showAnglers && !showCatches {
                        Text(trimmed.isEmpty ? "No catches found in this date range" : "No results for “\(trimmed)”")
                            .font(Typography.caption).foregroundStyle(Theme.darkMuted)
                            .frame(maxWidth: .infinity).padding(.top, 60)
                    } else {
                        if showAnglers {
                            sectionHeader("Anglers")
                            ForEach(users) { u in
                                Button { if let name = u.username { path.append(ProfileRoute(username: name)) } } label: { UserRow(profile: u) }
                                    .buttonStyle(.pressable)
                            }
                        }
                        if showCatches {
                            sectionHeader("Catches")
                            ForEach(Array(groups.enumerated()), id: \.element[0].key) { i, g in
                                CatchCard(group: g, index: i, me: auth.profileSummary) { selection = GroupSelection(group: g) }
                            }
                            if truncated {
                                Text("Showing the 300 most recent matches — narrow your search to see more.")
                                    .font(Typography.caption).foregroundStyle(Theme.darkMuted)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
            .background(Theme.uiBg)
            .navigationTitle("Search")
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always),
                        prompt: "Search anglers, species, flies, rods, locations…")
            .searchScopes($scope) { ForEach(Scope.allCases, id: \.self) { Text($0.rawValue).tag($0) } }
            .toolbar {
                if scope != .anglers {
                    ToolbarItem(placement: .primaryAction) {
                        Button { showFilters = true } label: {
                            Icon.filters.view(20).overlay(alignment: .topTrailing) {
                                if filtersActive { Circle().fill(Theme.iosBlue).frame(width: 7, height: 7).offset(x: 3, y: -3) }
                            }
                        }
                        .accessibilityLabel(filtersActive ? "Filters, active" : "Filters")
                    }
                }
            }
            .sheet(isPresented: $showFilters) { filterSheet }
            .sheet(item: $selection) { sel in
                CatchDetailView(initialGroup: sel.group, onOpenProfile: { u in selection = nil; path.append(ProfileRoute(username: u)) },
                                onChange: { Task { await search() } })
            }
            .navigationDestination(for: ProfileRoute.self) { UserProfileView(username: $0.username, openCatchId: $0.catchId) }
            .task(id: Key(q: trimmed, whose: whose, from: from, to: to, me: auth.userId)) {
                try? await Task.sleep(for: .milliseconds(300)) // debounce, like the web
                guard !Task.isCancelled else { return }
                await search()
            }
        }
    }

    private var idle: some View {
        VStack(spacing: 12) {
            PixelFishLoader(size: 48)
            Text("Search HookSpot").font(Typography.headline)
            Text("Find anglers by name, or catches by species, fly, rod, location, or date range.")
                .font(Typography.caption).foregroundStyle(Theme.darkMuted).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.top, 80).padding(.horizontal, 24)
    }

    private func sectionHeader(_ t: String) -> some View {
        Text(t).font(Typography.label).foregroundStyle(Theme.darkMuted).accessibilityAddTraits(.isHeader)
    }

    private var filterSheet: some View {
        NavigationStack {
            Form {
                Picker("Whose catches", selection: $whose) {
                    Text("Everyone").tag(Whose.everyone)
                    if auth.isSignedIn { Text("Just me").tag(Whose.me) }
                }
                Section("Date range") {
                    dateRow("From", value: $from, range: Date.distantPast...(to ?? .now))
                    dateRow("To", value: $to, range: (from ?? .distantPast)...Date.now)
                }
                if filtersActive {
                    Button("Clear filters", role: .destructive) { whose = .everyone; from = nil; to = nil }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showFilters = false } } }
        }
        .presentationDetents([.medium])
    }

    private func dateRow(_ label: String, value: Binding<Date?>, range: ClosedRange<Date>) -> some View {
        Toggle(isOn: Binding(get: { value.wrappedValue != nil }, set: { value.wrappedValue = $0 ? .now : nil })) {
            if let d = value.wrappedValue {
                DatePicker(label, selection: Binding(get: { d }, set: { value.wrappedValue = $0 }), in: range, displayedComponents: .date)
            } else {
                Text(label)
            }
        }
    }

    /// YYYY-MM-DD in the device calendar (what <input type="date"> sends).
    private func day(_ d: Date?) -> String? {
        d.map { String(format: "%04d-%02d-%02d", Calendar.current.component(.year, from: $0),
                       Calendar.current.component(.month, from: $0), Calendar.current.component(.day, from: $0)) }
    }

    private func search() async {
        guard isSearching else { users = []; groups = []; truncated = false; return }
        loading = true
        defer { loading = false }
        let q = trimmed
        async let usersReq: [ProfileSummary] = q.isEmpty ? [] : ((try? await api.searchUsers(q)) ?? [])
        async let catchesReq: APIClient.FeedResponse? = hasCatchFilters
            ? try? await api.searchCatches(query: q, userId: auth.userId, mine: whose == .me, from: day(from), to: day(to))
            : nil
        let (u, c) = await (usersReq, catchesReq)
        guard !Task.isCancelled else { return }
        users = u
        let profiles = Dictionary((c?.profiles ?? []).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let photos = (c?.rows ?? []).map { row -> Photo in
            var p = PhotoGrouping.mapPhotoRow(row)
            p.isOwn = row.userId == auth.userId
            p.ownerProfile = profiles[row.userId]
            return p
        }
        groups = PhotoGrouping.groupPhotos(photos)
        truncated = c?.truncated ?? false
    }
}
