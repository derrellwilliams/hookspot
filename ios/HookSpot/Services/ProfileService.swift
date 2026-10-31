import Foundation
import Supabase

/// Profiles, avatars, gear and follows. Mirrors avatarUpload.js, OnboardingPage,
/// UserProfilePage and FollowListDialog.
///
/// `user_metadata` rule (CLAUDE.md): scalars and small gear lists only — it rides in
/// every JWT. avatar_url lives in the `profiles` table only and is never written to it.
struct ProfileService: Sendable {
    var client: SupabaseClient = SupabaseService.client
    var api = APIClient()

    struct FullProfile: Decodable, Sendable {
        let id: String
        let username: String
        let displayName: String?
        let bio: String?
        let avatarUrl: String?
        let favorites: [String?]?
        enum CodingKeys: String, CodingKey {
            case id, username, bio, favorites
            case displayName = "display_name"
            case avatarUrl = "avatar_url"
        }
        var summary: ProfileSummary {
            ProfileSummary(id: id, username: username, displayName: displayName, avatarUrl: avatarUrl, bio: bio)
        }
    }

    func uploadAvatar(userId: String, imageData: Data) async throws -> URL {
        let jpeg = try ImageProcessing.avatarJPEG(from: imageData)
        let path = StorageKeys.avatarPath(userId: userId)
        try await client.storage.from(AppConfig.avatarsBucket)
            .upload(path, data: jpeg, options: FileOptions(contentType: "image/jpeg", upsert: true))
        guard let url = SupabaseService.publicURL(bucket: AppConfig.avatarsBucket, path: path) else { throw URLError(.badURL) }
        return url
    }

    /// Onboarding save — goes through /api/save-profile (server validates + writes profiles).
    func completeOnboarding(username: String, displayName: String?, bio: String?, avatarUrl: String?) async throws {
        guard let token = await SupabaseService.accessToken() else { throw URLError(.userAuthenticationRequired) }
        try await api.saveProfile(token: token, username: username, displayName: displayName, bio: bio, avatarUrl: avatarUrl)
        _ = try? await client.auth.refreshSession() // pick up the new display_name/bio metadata
    }

    func profile(username: String) async throws -> FullProfile? {
        let rows: [FullProfile] = try await client.from("profiles")
            .select("id,username,display_name,bio,avatar_url,favorites").eq("username", value: username).limit(1).execute().value
        return rows.first
    }

    func setAvatarURL(userId: String, url: String) async throws {
        struct R: Encodable { let id: String; let avatar_url: String }
        try await client.from("profiles").upsert(R(id: userId, avatar_url: url)).execute()
    }

    /// Edit Profile: display_name/bio to metadata (scalars) + profiles; avatar_url kept as-is in profiles.
    func updateProfile(userId: String, displayName: String, bio: String, avatarUrl: String?) async throws -> User {
        let name = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let b = bio.trimmingCharacters(in: .whitespacesAndNewlines)
        let user = try await client.auth.update(user: UserAttributes(data: ["display_name": .string(name), "bio": .string(b)]))
        struct R: Encodable {
            let id: String; let display_name: String?; let bio: String?; let avatar_url: String?
            func encode(to e: Encoder) throws {
                var c = e.container(keyedBy: CodingKeys.self)
                try c.encode(id, forKey: .id); try c.encode(display_name, forKey: .display_name)
                try c.encode(bio, forKey: .bio)
                // Only when known: an explicit null would wipe the stored avatar.
                try c.encodeIfPresent(avatar_url, forKey: .avatar_url)
            }
            enum CodingKeys: String, CodingKey { case id, display_name, bio, avatar_url }
        }
        try await client.from("profiles").upsert(R(id: userId, display_name: name.isEmpty ? nil : name,
                                                   bio: b.isEmpty ? nil : b, avatar_url: avatarUrl)).execute()
        return user
    }

    func updateGear(rods: [String], flies: [String]) async throws -> User {
        try await client.auth.update(user: UserAttributes(data: [
            "gear_rods": .array(rods.map(AnyJSON.string)),
            "gear_flies": .array(flies.map(AnyJSON.string)),
        ]))
    }

    /// saveNewGear() after an upload — append a new rod/fly to the saved lists.
    func appendGear(rod: String?, fly: String?, currentRods: [String], currentFlies: [String]) async throws -> User? {
        let newRods = rod.flatMap { currentRods.contains($0) ? nil : currentRods + [$0] }
        let newFlies = fly.flatMap { currentFlies.contains($0) ? nil : currentFlies + [$0] }
        guard newRods != nil || newFlies != nil else { return nil }
        var data: [String: AnyJSON] = [:]
        if let newRods { data["gear_rods"] = .array(newRods.map(AnyJSON.string)) }
        if let newFlies { data["gear_flies"] = .array(newFlies.map(AnyJSON.string)) }
        return try await client.auth.update(user: UserAttributes(data: data))
    }

    /// App.jsx: clear a legacy base64 avatar that bloats the JWT and breaks Storage uploads.
    func clearLegacyDataAvatar(_ user: User) async {
        guard case .string(let s)? = user.userMetadata["avatar_url"], s.hasPrefix("data:") else { return }
        _ = try? await client.auth.update(user: UserAttributes(data: ["avatar_url": .null]))
    }

    func setFavorites(userId: String, favorites: [String?]) async throws {
        struct R: Encodable { let favorites: [String?] }
        try await client.from("profiles").update(R(favorites: favorites)).eq("id", value: userId).execute()
    }

    // MARK: Follows

    struct FollowCounts: Sendable { var followers = 0; var following = 0 }

    func followCounts(profileId: String) async throws -> FollowCounts {
        async let followers = client.from("follows").select("*", head: true, count: .exact)
            .eq("following_id", value: profileId).execute().count
        async let following = client.from("follows").select("*", head: true, count: .exact)
            .eq("follower_id", value: profileId).execute().count
        return try await FollowCounts(followers: followers ?? 0, following: following ?? 0)
    }

    func isFollowing(me: String, profileId: String) async throws -> Bool {
        struct R: Decodable { let follower_id: String }
        let rows: [R] = try await client.from("follows").select("follower_id")
            .eq("follower_id", value: me).eq("following_id", value: profileId).limit(1).execute().value
        return !rows.isEmpty
    }

    func follow(me: String, profileId: String) async throws {
        struct R: Encodable { let follower_id: String; let following_id: String }
        try await client.from("follows").insert(R(follower_id: me, following_id: profileId)).execute()
    }

    func unfollow(me: String, profileId: String) async throws {
        try await client.from("follows").delete().eq("follower_id", value: me).eq("following_id", value: profileId).execute()
    }

    enum FollowList { case followers, following }

    func followList(_ kind: FollowList, profileId: String) async throws -> [ProfileSummary] {
        struct R: Decodable { let follower_id: String?; let following_id: String? }
        let rows: [R] = switch kind {
        case .followers: try await client.from("follows").select("follower_id").eq("following_id", value: profileId).execute().value
        case .following: try await client.from("follows").select("following_id").eq("follower_id", value: profileId).execute().value
        }
        let ids = rows.compactMap { kind == .followers ? $0.follower_id : $0.following_id }
        guard !ids.isEmpty else { return [] }
        return try await client.from("profiles").select("id,username,display_name,avatar_url").in("id", values: ids).execute().value
    }
}
