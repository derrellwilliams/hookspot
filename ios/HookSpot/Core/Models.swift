import Foundation

nonisolated struct Coordinate: Hashable, Sendable, Codable {
    var latitude: Double
    var longitude: Double
}

/// `profiles` columns as returned by `/api/photos`, `/api/search-*` (id, username, display_name, avatar_url).
nonisolated struct ProfileSummary: Codable, Hashable, Sendable, Identifiable {
    let id: String
    var username: String?
    var displayName: String?
    var avatarUrl: String?
    var bio: String?

    enum CodingKeys: String, CodingKey {
        case id, username, bio
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
    }
}

/// Raw `photos` row from `/api/photos` and `/api/search-catches`.
nonisolated struct PhotoRow: Decodable, Sendable {
    let id: String?
    let userId: String
    let catchId: String?
    let filename: String
    let storagePath: String?
    let url: String
    let thumbUrl: String?
    let species: String?
    let lat: Double?
    let lng: Double?
    let time: String?
    let meta: [String: JSONValue]?

    enum CodingKeys: String, CodingKey {
        case id, filename, url, species, lat, lng, time, meta
        case userId = "user_id"
        case catchId = "catch_id"
        case storagePath = "storage_path"
        case thumbUrl = "thumb_url"
    }
}

/// In-app photo — the Swift twin of the object `mapPhotoRow()` + `initPhotos()` build on web.
nonisolated struct Photo: Hashable, Sendable, Identifiable {
    var rowId: String?
    var name: String
    var storagePath: String?
    var userId: String
    var catchId: String?
    var url: URL?
    var thumbUrl: URL?
    var time: Date?
    var coordinate: Coordinate?
    var species: String?
    var meta: [String: JSONValue]
    var isOwn: Bool = false
    var ownerProfile: ProfileSummary?

    /// Same identity key the web store uses (`${userId}/${name}`).
    var key: String { "\(userId)/\(name)" }
    var id: String { key }
    var hasGps: Bool { coordinate != nil }

    // Typed views over `meta` (keys written by web + iOS upload/enrichment).
    var order: Int? { meta["order"]?.doubleValue.map { Int($0) } }
    var hideTime: Bool { meta["hideTime"]?.boolValue ?? false }
    var rod: String? { meta["rod"]?.stringValue }
    var fly: String? { meta["fly"]?.stringValue }
    var location: (city: String?, state: String?)? {
        guard let loc = meta["location"]?.objectValue else { return nil }
        return (loc["city"]?.stringValue, loc["state"]?.stringValue)
    }
    var waterBodyName: String? { meta["waterBody"]?["name"]?.stringValue }
    var weather: (temp: Double?, condition: String?)? {
        guard let w = meta["weather"]?.objectValue else { return nil }
        return (w["temp"]?.doubleValue, w["condition"]?.stringValue)
    }
}

/// A catch on screen: photos sharing a `catchId` (or a single legacy photo), already ordered.
typealias PhotoGroup = [Photo]

nonisolated extension Array where Element == Photo {
    /// Lead photo for labels/counting — first photo with a species, else the first.
    var lead: Photo? { first { ($0.species ?? "").isEmpty == false } ?? first }
}
