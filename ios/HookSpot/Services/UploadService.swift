import Foundation
import Supabase

/// Port of the upload paths in src/lib/fileLoader.js + UploadDialog.submit().
///
/// Order is strict and sequential (see CLAUDE.md "Thumbnail generation must stay
/// sequential and best-effort"):
///   1. insert `catches` row  2. upload 2048px main image  3. thumbnail (best effort)
///   4. insert `photos` row — `thumb_url` only present when step 3 succeeded, never null.
struct UploadService: Sendable {
    var client: SupabaseClient = SupabaseService.client

    struct Item: Sendable {
        /// Original filename (or a generated one); also the row's `filename` identity key.
        var filename: String
        /// Original image bytes (HEIC/JPEG/PNG) — EXIF is read from these.
        var data: Data
    }

    struct CatchDetails: Sendable {
        var species: String?
        var rod: String?
        var fly: String?
        var hideTime = false
        /// Tapped/dragged pin when the first photo has no GPS.
        var manualPin: Coordinate?
    }

    struct Result: Sendable {
        var catchId: String
        var photos: [Photo]
        var failed: Int
    }

    enum UploadError: LocalizedError {
        case catchInsertFailed, nothingUploaded
        var errorDescription: String? { "Failed to add catch." }
    }

    private var bucket: StorageFileApi { client.storage.from(AppConfig.catchesBucket) }

    // MARK: Rows

    private struct CatchInsert: Encodable {
        let user_id: String
        let species: String?
        let rod: String?
        let fly: String?
        let lat: Double?
        let lng: Double?
        let time: String
    }

    /// Optional properties are omitted when nil (synthesized encodeIfPresent) — that is
    /// what keeps `thumb_url` out of the insert when no thumbnail was made.
    struct PhotoInsert: Encodable {
        let user_id: String
        let catch_id: String?
        let filename: String
        let storage_path: String
        let url: String
        let thumb_url: String?
        let species: String?
        let lat: Double?
        let lng: Double?
        let time: String?
        let meta: [String: JSONValue]
    }

    private struct IdRow: Decodable { let id: String }

    // MARK: New catch

    func addCatch(_ items: [Item], details: CatchDetails, userId: String, existingNames: Set<String>) async throws -> Result {
        let rod = Formatters.cleanGear(details.rod)
        let fly = Formatters.cleanGear(details.fly)
        let species = (details.species?.isEmpty ?? true) ? nil : details.species

        // Catch coordinates: manual pin → first photo's EXIF → nil. Time: first EXIF → now.
        var lat = details.manualPin?.latitude, lng = details.manualPin?.longitude
        var time: Date?
        if details.manualPin == nil, let first = items.first {
            let exif = ImageProcessing.exif(from: first.data)
            lat = exif.coordinate?.latitude; lng = exif.coordinate?.longitude
            time = exif.dateTimeOriginal
        }

        let catchRow: IdRow
        do {
            catchRow = try await client.from("catches")
                .insert(CatchInsert(user_id: userId, species: species, rod: rod, fly: fly, lat: lat, lng: lng,
                                    time: DateParsing.isoString(time ?? .now)))
                .select("id").single().execute().value
        } catch { throw UploadError.catchInsertFailed }

        var meta: [String: JSONValue] = ["identified": true]
        meta["species"] = species.map(JSONValue.string) ?? .string("")
        meta["rod"] = rod.map(JSONValue.string) ?? .null
        meta["fly"] = fly.map(JSONValue.string) ?? .null
        if details.hideTime { meta["hideTime"] = true }
        let fallback = (lat != nil && lng != nil) ? Coordinate(latitude: lat!, longitude: lng!) : nil

        var photos: [Photo] = []
        var failed = 0
        var seen = existingNames
        // One at a time: decode + upload for a 12MP photo is memory-heavy.
        for item in items where !seen.contains(item.filename) {
            seen.insert(item.filename)
            var m = meta
            m["order"] = .number(Double(photos.count + failed))
            if let p = try? await uploadPhoto(item, userId: userId, catchId: catchRow.id, species: species,
                                               meta: m, fallbackCoordinate: fallback) {
                photos.append(p)
            } else {
                failed += 1
            }
        }

        if photos.isEmpty {
            _ = try? await client.from("catches").delete().eq("id", value: catchRow.id).execute()
            throw UploadError.nothingUploaded
        }
        return Result(catchId: catchRow.id, photos: photos, failed: failed)
    }

    /// uploadPhoto(): main image → thumbnail → photos row, cleaning storage up if the insert fails.
    func uploadPhoto(_ item: Item, userId: String, catchId: String?, species: String?,
                     meta: [String: JSONValue], fallbackCoordinate: Coordinate?,
                     fallbackTime: Date? = nil, useFallbackLocation: Bool = false) async throws -> Photo {
        let storagePath = StorageKeys.photoPath(userId: userId, filename: item.filename)
        let exif = ImageProcessing.exif(from: item.data)
        // Never fall back to the original bytes: they carry full EXIF (GPS, time) into a
        // public bucket. An image ImageIO can't re-encode fails this photo instead.
        let storageJPEG = try ImageProcessing.storageJPEG(item.data)

        // Filenames are unique per pick (UploadNaming), so no 409 tolerance: an existing
        // object would belong to another row, and the cleanup below would delete it.
        try await bucket.upload(storagePath, data: storageJPEG,
                                options: FileOptions(contentType: "image/jpeg", upsert: false))
        guard let publicURL = SupabaseService.publicURL(bucket: AppConfig.catchesBucket, path: storagePath) else {
            throw URLError(.badURL)
        }

        // Strictly after the main upload succeeded; any failure here just means no thumb_url.
        let thumbURL = await uploadThumbnail(item.data, storagePath: storagePath)

        let coord = useFallbackLocation ? fallbackCoordinate : (exif.coordinate ?? fallbackCoordinate)
        let time = fallbackTime ?? exif.dateTimeOriginal ?? .now
        let row = PhotoInsert(
            user_id: userId, catch_id: catchId, filename: item.filename, storage_path: storagePath,
            url: publicURL.absoluteString, thumb_url: thumbURL?.absoluteString, species: species,
            lat: coord?.latitude, lng: coord?.longitude, time: DateParsing.isoString(time), meta: meta)

        let inserted: IdRow
        do {
            inserted = try await client.from("photos").insert(row).select("id").single().execute().value
        } catch {
            var cleanup = [storagePath]
            if thumbURL != nil { cleanup.append(StorageKeys.thumbPath(for: storagePath)) }
            _ = try? await bucket.remove(paths: cleanup)
            throw error
        }

        return Photo(rowId: inserted.id, name: item.filename, storagePath: storagePath, userId: userId,
                     catchId: catchId, url: publicURL, thumbUrl: thumbURL ?? publicURL, time: time,
                     coordinate: coord, species: species, meta: meta, isOwn: true)
    }

    /// Best effort — returns nil on any failure so the caller omits thumb_url entirely.
    private func uploadThumbnail(_ original: Data, storagePath: String) async -> URL? {
        do {
            let thumb = try ImageProcessing.thumbJPEG(original)
            let path = StorageKeys.thumbPath(for: storagePath)
            try await bucket.upload(path, data: thumb, options: FileOptions(contentType: "image/jpeg", upsert: false))
            return SupabaseService.publicURL(bucket: AppConfig.catchesBucket, path: path)
        } catch {
            return nil
        }
    }

    // MARK: Add photo to an existing catch (uploadPhotoToGroup — takes the lead's place and time)

    func addPhoto(_ item: Item, to lead: Photo, userId: String) async throws -> Photo {
        try await uploadPhoto(item, userId: userId, catchId: lead.catchId, species: nil, meta: [:],
                              fallbackCoordinate: lead.coordinate, fallbackTime: lead.time,
                              useFallbackLocation: true)
    }
}
