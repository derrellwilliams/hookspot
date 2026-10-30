import Foundation

/// The same server routes the web calls (root-level *-handler.js, mounted as Vercel functions).
struct APIClient: Sendable {
    var baseURL: URL = AppConfig.apiBaseURL
    var session: URLSession = .shared

    struct APIError: LocalizedError {
        let status: Int
        let message: String?
        var errorDescription: String? { message ?? "Request failed (\(status))" }
    }

    struct FeedResponse: Decodable, Sendable {
        var rows: [PhotoRow]
        var profiles: [ProfileSummary]
        var truncated: Bool?
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            rows = try c.decodeIfPresent([PhotoRow].self, forKey: .rows) ?? []
            profiles = try c.decodeIfPresent([ProfileSummary].self, forKey: .profiles) ?? []
            truncated = try c.decodeIfPresent(Bool.self, forKey: .truncated)
        }
        enum CodingKeys: String, CodingKey { case rows, profiles, truncated }
    }

    struct ProfileLookup: Decodable, Sendable {
        let username: String?
        let avatarUrl: String?
        enum CodingKeys: String, CodingKey { case username; case avatarUrl = "avatar_url" }
    }

    struct SaveProfileResponse: Decodable, Sendable {
        struct User: Decodable, Sendable { let id: String }
        let user: User
    }

    private struct ErrorBody: Decodable { let error: String? }

    private func url(_ path: String, _ query: [String: String?] = [:]) -> URL {
        var c = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!
        let items = query.compactMap { k, v in v.map { URLQueryItem(name: k, value: $0) } }.sorted { $0.name < $1.name }
        if !items.isEmpty { c.queryItems = items }
        return c.url!
    }

    private func send<T: Decodable>(_ req: URLRequest, as: T.Type = T.self) async throws -> T {
        let (data, res) = try await session.data(for: req)
        let status = (res as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw APIError(status: status, message: (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error)
        }
        if let err = try? JSONDecoder().decode(ErrorBody.self, from: data), let msg = err.error {
            throw APIError(status: status, message: msg)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func get<T: Decodable>(_ path: String, _ query: [String: String?] = [:]) async throws -> T {
        try await send(URLRequest(url: url(path, query)))
    }

    /// GET /api/photos — signed out: everyone's recent catches; signed in: you + people you follow.
    func photos(userId: String?, ownOnly: Bool = false) async throws -> FeedResponse {
        try await get("api/photos", ["userId": userId, "ownOnly": ownOnly ? "true" : nil])
    }

    func profile(userId: String) async throws -> ProfileLookup {
        try await get("api/profile", ["userId": userId])
    }

    func isUsernameAvailable(_ username: String) async throws -> Bool {
        struct R: Decodable { let available: Bool }
        let r: R = try await get("api/check-username", ["username": username])
        return r.available
    }

    func searchUsers(_ q: String) async throws -> [ProfileSummary] {
        struct R: Decodable { let results: [ProfileSummary] }
        let r: R = try await get("api/search-users", ["q": q])
        return r.results
    }

    /// GET /api/search-catches. `from`/`to` are calendar days (YYYY-MM-DD).
    func searchCatches(query: String, userId: String?, mine: Bool, from: String?, to: String?) async throws -> FeedResponse {
        try await get("api/search-catches", [
            "q": query.isEmpty ? nil : query,
            "userId": userId,
            "mine": mine ? "true" : nil,
            "from": from,
            "to": to,
        ])
    }

    /// POST /api/save-profile. avatar_url goes to the profiles table only — never user_metadata.
    func saveProfile(token: String, username: String, displayName: String?, bio: String?, avatarUrl: String?) async throws {
        var req = URLRequest(url: url("api/save-profile"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: String?] = ["token": token, "username": username, "displayName": displayName, "bio": bio, "avatarUrl": avatarUrl]
        req.httpBody = try JSONEncoder().encode(body.compactMapValues { $0 })
        let _: SaveProfileResponse = try await send(req)
    }

    /// POST /identify with raw JPEG bytes (same as web). Returns nil for "none" or any failure.
    func identify(jpeg: Data, token: String?) async -> String? {
        var req = URLRequest(url: url("identify"))
        req.httpMethod = "POST"
        req.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.httpBody = jpeg
        struct R: Decodable { let species: String? }
        guard let r: R = try? await send(req), let s = r.species, !s.isEmpty, s != "none" else { return nil }
        return s
    }
}
