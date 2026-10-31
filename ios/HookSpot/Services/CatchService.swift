import Foundation
import Supabase

/// Catch edits and deletes — PopupCarousel.saveEdit() and fileLoader.deletePhotos().
struct CatchService: Sendable {
    var client: SupabaseClient = SupabaseService.client

    /// Encodes every key, including explicit nulls, so clearing a field really clears it.
    private struct PhotoEdit: Encodable {
        let species: String?
        let meta: [String: JSONValue]
        func encode(to e: Encoder) throws {
            var c = e.container(keyedBy: CodingKeys.self)
            try c.encode(species, forKey: .species); try c.encode(meta, forKey: .meta)
        }
        enum CodingKeys: String, CodingKey { case species, meta }
    }

    private struct CatchEdit: Encodable {
        let species: String?, rod: String?, fly: String?
        func encode(to e: Encoder) throws {
            var c = e.container(keyedBy: CodingKeys.self)
            try c.encode(species, forKey: .species); try c.encode(rod, forKey: .rod); try c.encode(fly, forKey: .fly)
        }
        enum CodingKeys: String, CodingKey { case species, rod, fly }
    }

    private struct MetaOnly: Encodable { let meta: [String: JSONValue] }

    /// Writes species/rod/fly to the lead photo *and* its catches row, then persists a new
    /// photo order if given. Returns the updated photos (lead first-updated, then reordered group).
    func saveEdit(group: PhotoGroup, lead: Photo, species: String?, rod: String?, fly: String?,
                  newOrder: PhotoGroup?, userId: String) async throws -> (lead: Photo, reordered: PhotoGroup?) {
        let rodVal = Formatters.cleanGear(rod)
        let flyVal = Formatters.cleanGear(fly)
        let speciesVal = (species?.isEmpty ?? true) ? nil : species
        var meta = lead.meta
        meta["rod"] = rodVal.map(JSONValue.string) ?? .null
        meta["fly"] = flyVal.map(JSONValue.string) ?? .null
        meta["species"] = speciesVal.map(JSONValue.string)  // undefined on web → key dropped

        try await client.from("photos").update(PhotoEdit(species: speciesVal, meta: meta))
            .eq("filename", value: lead.name).eq("user_id", value: userId).execute()
        if let catchId = lead.catchId {
            try await client.from("catches").update(CatchEdit(species: speciesVal, rod: rodVal, fly: flyVal))
                .eq("id", value: catchId).eq("user_id", value: userId).execute()
        }
        var updatedLead = lead
        updatedLead.species = speciesVal
        updatedLead.meta = meta

        var reordered: PhotoGroup?
        if let newOrder {
            let withLead = newOrder.map { $0.key == lead.key ? updatedLead : $0 }
            reordered = try await withThrowingTaskGroup(of: Photo.self) { tg in
                for (i, p) in withLead.enumerated() {
                    var m = p.meta; m["order"] = .number(Double(i))
                    var updated = p; updated.meta = m
                    tg.addTask {
                        try await client.from("photos").update(MetaOnly(meta: m))
                            .eq("filename", value: p.name).eq("user_id", value: userId).execute()
                        return updated
                    }
                }
                var byKey: [String: Photo] = [:]
                for try await p in tg { byKey[p.key] = p }
                return withLead.map { byKey[$0.key]! }
            }
        }
        return (updatedLead, reordered)
    }

    /// Delete rows first, then storage (main + thumbs/ sibling — removing a missing key is a no-op).
    func deletePhotos(_ photos: [Photo], userId: String) async throws {
        let withId = photos.compactMap(\.rowId)
        let withoutId = photos.filter { $0.rowId == nil }.map(\.name)
        if !withId.isEmpty {
            try await client.from("photos").delete().in("id", values: withId).execute()
        }
        if !withoutId.isEmpty {
            try await client.from("photos").delete().in("filename", values: withoutId).eq("user_id", value: userId).execute()
        }
        let paths = photos.map { $0.storagePath ?? StorageKeys.photoPath(userId: userId, filename: $0.name) }
        _ = try? await client.storage.from(AppConfig.catchesBucket).remove(paths: paths + paths.map(StorageKeys.thumbPath))
    }

    /// Best-effort: drops the catches row once its last photo is gone (photos.catch_id is
    /// `on delete set null`, so this never touches photos).
    func deleteCatchRow(_ catchId: String?, userId: String) async {
        guard let catchId else { return }
        _ = try? await client.from("catches").delete().eq("id", value: catchId).eq("user_id", value: userId).execute()
    }

    /// saveMeta(): merge one enrichment key into a photo's meta.
    func saveMeta(_ photo: Photo, key: String, value: JSONValue, userId: String) async throws -> Photo {
        var updated = photo
        updated.meta[key] = value
        try await client.from("photos").update(MetaOnly(meta: updated.meta))
            .eq("filename", value: photo.name).eq("user_id", value: userId).execute()
        return updated
    }
}
