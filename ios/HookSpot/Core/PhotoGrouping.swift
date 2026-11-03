import Foundation

// Port of src/lib/groupPhotos.js and src/lib/groupByTime.js.
// JS Array.prototype.sort is stable; Swift's sort isn't, so ties keep input order explicitly.

nonisolated enum PhotoGrouping {
    static let orderUnset = 999
    /// groupByTime: photos within this window of the group's *first* photo join it.
    static let groupWindow: TimeInterval = 3 * 60

    static func mapPhotoRow(_ row: PhotoRow) -> Photo {
        let coord: Coordinate? = if let lat = row.lat, let lng = row.lng {
            Coordinate(latitude: lat, longitude: lng)
        } else { nil }
        return Photo(
            rowId: row.id,
            name: row.filename,
            storagePath: row.storagePath,
            userId: row.userId,
            catchId: row.catchId,
            url: URL(string: row.url),
            thumbUrl: URL(string: row.thumbUrl ?? row.url),
            time: row.time.flatMap(DateParsing.timestamptz),
            coordinate: coord,
            species: (row.species?.isEmpty ?? true) ? nil : row.species,
            meta: row.meta ?? [:]
        )
    }

    private static func ms(_ d: Date?) -> Double { d.map { $0.timeIntervalSince1970 * 1000 } ?? 0 }

    /// Newest first, by each group's first photo (missing time sorts as 0).
    static func sortByRecency(_ groups: [PhotoGroup]) -> [PhotoGroup] {
        stableSorted(groups) { ms($0.first?.time) > ms($1.first?.time) }
    }

    static func groupPhotos(_ photos: [Photo]) -> [PhotoGroup] {
        var byCatchId: [String: [Photo]] = [:]
        var catchOrder: [String] = []
        var ungrouped: [PhotoGroup] = []
        for p in photos {
            if let cid = p.catchId, !cid.isEmpty {
                if byCatchId[cid] == nil { catchOrder.append(cid) }
                byCatchId[cid, default: []].append(p)
            } else {
                ungrouped.append([p])
            }
        }
        let catchGroups = catchOrder.map { cid in
            stableSorted(byCatchId[cid]!) { a, b in
                let oa = a.order ?? orderUnset, ob = b.order ?? orderUnset
                return oa != ob ? oa < ob : ms(a.time) < ms(b.time)
            }
        }
        return sortByRecency(catchGroups + ungrouped)
    }

    static func groupByTime(_ photos: [Photo]) -> [PhotoGroup] {
        guard !photos.isEmpty else { return [] }
        let sorted = stableSorted(photos) { ms($0.time) < ms($1.time) }
        var groups: [PhotoGroup] = []
        for photo in sorted {
            if let first = groups.last?.first?.time, let t = photo.time,
               t.timeIntervalSince(first) <= groupWindow {
                groups[groups.count - 1].append(photo)
            } else {
                groups.append([photo])
            }
        }
        return groups.map { g in
            guard g.contains(where: { $0.order != nil }) else { return g }
            return stableSorted(g) { ($0.order ?? orderUnset) < ($1.order ?? orderUnset) }
        }
    }

    /// computeHomeCenter() from UploadDialog — average of your own GPS photos, zoom 5.
    static func homeCenter(_ photos: [Photo]) -> (center: Coordinate, zoom: Double)? {
        let pts = photos.filter(\.isOwn).compactMap(\.coordinate)
        guard !pts.isEmpty else { return nil }
        let n = Double(pts.count)
        return (Coordinate(latitude: pts.map(\.latitude).reduce(0, +) / n,
                           longitude: pts.map(\.longitude).reduce(0, +) / n), 5)
    }
}

nonisolated func stableSorted<T>(_ items: [T], by areInIncreasingOrder: (T, T) -> Bool) -> [T] {
    items.enumerated().sorted { a, b in
        if areInIncreasingOrder(a.element, b.element) { return true }
        if areInIncreasingOrder(b.element, a.element) { return false }
        return a.offset < b.offset
    }.map(\.element)
}
