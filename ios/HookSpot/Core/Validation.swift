import Foundation

// Port of src/lib/validation.js plus the limits /api/save-profile enforces.
nonisolated enum Validation {
    static func isValidUsername(_ s: String) -> Bool {
        s.wholeMatch(of: /[a-z0-9_-]{3,20}/) != nil
    }
    static let displayNameMax = 60
    static let bioMax = 200
}

// Storage object keys, matching storageKey() and the thumbs/ sibling path in src/lib/fileLoader.js.
nonisolated enum StorageKeys {
    /// Supabase Storage rejects spaces/special chars; HEIC/HEIF become .jpg since we always store JPEG.
    /// Works per UTF-16 unit, like the JS regex, so keys match what the web would produce.
    static func storageKey(_ filename: String) -> String {
        let allowed = Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-".utf16)
        let units = filename.utf16.map { allowed.contains($0) ? $0 : UInt16(UInt8(ascii: "_")) }
        let cleaned = String(decoding: units, as: UTF16.self)
        return cleaned.replacing(/\.(?i:heic|heif)$/, with: ".jpg")
    }

    static func photoPath(userId: String, filename: String) -> String {
        "\(userId)/\(storageKey(filename))"
    }

    /// "uid/name.jpg" → "uid/thumbs/name.jpg"
    static func thumbPath(for storagePath: String) -> String {
        storagePath.replacing(/^([^\/]+)\//, maxReplacements: 1) { "\($0.1)/thumbs/" }
    }

    static func avatarPath(userId: String) -> String { "\(userId)/avatar.jpg" }
}
