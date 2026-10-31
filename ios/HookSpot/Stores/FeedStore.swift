import Foundation
import Observation

/// Mirrors usePhotoStore + initPhotos()/enrichment in src/lib/fileLoader.js.
@MainActor @Observable
final class FeedStore {
    private(set) var photos: [Photo] = []
    /// Catches with GPS, grouped and newest first (what the feed and map render).
    private(set) var groups: [PhotoGroup] = []
    private(set) var initialized = false
    private(set) var isLoading = false
    var activeGroup: PhotoGroup?
    var uploadOpen = false
    var toast: Toast?

    struct Toast: Equatable, Identifiable {
        enum Variant { case standard, success }
        let id = UUID()
        let message: String
        let variant: Variant
    }

    /// Whose feed is loaded (nil = public feed). Changing owner clears photos so `isOwn` never goes stale.
    private var feedUserId: String??
    private var loadTask: Task<Void, Never>?
    private let api = APIClient()
    private let enrichment = EnrichmentService()
    private let catches = CatchService()
    private let limiter = AsyncLimiter(limit: 3)

    // MARK: Loading

    func load(for userId: String?) {
        if let current = feedUserId, current != userId { clear() }
        feedUserId = .some(userId)
        loadTask?.cancel()
        loadTask = Task { await fetch(userId: userId) }
    }

    func refresh() async {
        guard let owner = feedUserId else { return }
        await fetch(userId: owner)
    }

    private func fetch(userId: String?) async {
        isLoading = true
        defer { isLoading = false; initialized = true }
        guard let res = try? await api.photos(userId: userId), !Task.isCancelled,
              feedUserId == .some(userId) else { return }
        let profiles = Dictionary(res.profiles.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        // The server is the source of truth, so a refresh drops deletions and picks up edits
        // made elsewhere. Enrichment values saved locally but not yet echoed back are kept.
        let local = Dictionary(photos.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a })
        let fresh = res.rows.map { row -> Photo in
            var p = PhotoGrouping.mapPhotoRow(row)
            p.isOwn = row.userId == userId
            p.ownerProfile = profiles[row.userId]
            if let old = local[p.key] {
                for k in Self.enrichmentKeys where p.meta[k] == nil { p.meta[k] = old.meta[k] }
            }
            return p
        }
        photos = fresh
        if let active = activeGroup {
            let byKey = Dictionary(fresh.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a })
            let kept = active.compactMap { byKey[$0.key] }
            activeGroup = kept.isEmpty ? nil : kept
        }
        regroup()
        if let userId { fresh.forEach { enrich($0, userId: userId) } }
    }

    func clear() {
        photos = []; groups = []; activeGroup = nil; initialized = false
    }

    // MARK: Mutations (same semantics as the zustand actions)

    private func regroup() { groups = PhotoGrouping.groupPhotos(photos.filter(\.hasGps)) }

    func add(_ new: [Photo]) {
        guard !new.isEmpty else { return }
        photos += new
        regroup()
    }

    func update(_ photo: Photo) {
        photos = photos.map { $0.key == photo.key ? photo : $0 }
        activeGroup = activeGroup?.map { $0.key == photo.key ? photo : $0 }
        regroup()
    }

    func remove(_ removed: [Photo]) {
        let keys = Set(removed.map(\.key))
        photos.removeAll { keys.contains($0.key) }
        activeGroup = nil
        regroup()
    }

    /// Unfollow: drop that angler's catches from your feed (removeUserPhotos).
    func removeUser(_ userId: String) {
        photos.removeAll { $0.userId == userId }
        activeGroup = nil
        regroup()
    }

    func replaceGroupOrder(_ reordered: PhotoGroup) {
        let byKey = Dictionary(reordered.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a })
        photos = photos.map { byKey[$0.key] ?? $0 }
        if activeGroup?.contains(where: { byKey[$0.key] != nil }) == true { activeGroup = reordered }
        regroup()
    }

    func showToast(_ message: String, _ variant: Toast.Variant = .standard) {
        let t = Toast(message: message, variant: variant)
        toast = t
        Task { try? await Task.sleep(for: .seconds(4)); if toast == t { toast = nil } }
    }

    var existingOwnNames: Set<String> { Set(photos.filter(\.isOwn).map(\.name)) }

    // MARK: Enrichment (own photos only, 3 at a time, skip keys already set)

    private static let enrichmentKeys = ["weather", "location", "waterBody"]
    /// "photoKey|metaKey" lookups already running, so a refresh doesn't start duplicates.
    private var enriching: Set<String> = []
    /// Meta writes run one at a time: each sends the photo's whole meta, so two in flight
    /// could land out of order and drop the other's key.
    private var metaWrites: Task<Void, Never>?

    func enrich(_ photo: Photo, userId: String) {
        guard photo.isOwn, let coord = photo.coordinate else { return }
        if photo.meta["weather"] == nil, let time = photo.time {
            schedule(photo, key: "weather", userId: userId) { [enrichment] in await enrichment.weather(coord, at: time) }
        }
        if photo.meta["location"] == nil {
            schedule(photo, key: "location", userId: userId) { [enrichment] in await enrichment.reverseGeocode(coord) }
        }
        if photo.meta["waterBody"] == nil {
            schedule(photo, key: "waterBody", userId: userId) { [enrichment] in await enrichment.nearestWaterBody(coord) }
        }
    }

    private func schedule(_ photo: Photo, key: String, userId: String, fetch: @escaping @Sendable () async -> JSONValue?) {
        let id = "\(photo.key)|\(key)"
        guard enriching.insert(id).inserted else { return }
        Task {
            defer { enriching.remove(id) }
            guard let value = await limiter.run(fetch),
                  var latest = photos.first(where: { $0.key == photo.key }) else { return }
            // Merge locally first (main actor, so atomic), then queue the write behind any
            // other meta write; it sends whatever the photo's meta is when its turn comes.
            latest.meta[key] = value
            update(latest)
            let previous = metaWrites
            let write = Task { [catches] in
                await previous?.value
                guard let current = self.photos.first(where: { $0.key == photo.key }) else { return }
                _ = try? await catches.saveMeta(current, key: key, value: current.meta[key] ?? value, userId: userId)
            }
            metaWrites = write
            await write.value
        }
    }
}
