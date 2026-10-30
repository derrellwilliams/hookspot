import Foundation

/// A link the app can open: share links and profile URLs from the web.
///   https://hook-spot.com/user/<username>?catch=<id>   (universal link, see public/.well-known)
///   hookspot://user/<username>?catch=<id>              (custom scheme)
struct DeepLink: Equatable, Sendable {
    let username: String
    /// `catchId ?? lead filename` — the web's groupShareId().
    let catchId: String?

    static let hosts: Set<String> = ["hook-spot.com", "www.hook-spot.com"]

    init(username: String, catchId: String?) {
        self.username = username; self.catchId = catchId
    }

    init?(url: URL) {
        guard let c = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        var parts = c.path.split(separator: "/").map(String.init)
        switch c.scheme?.lowercased() {
        case "https", "http":
            guard let host = c.host?.lowercased(), Self.hosts.contains(host) else { return nil }
        case "hookspot":
            if let host = c.host, !host.isEmpty { parts.insert(host, at: 0) } // hookspot://user/<name>
        default:
            return nil
        }
        guard parts.count == 2, parts[0] == "user",
              let name = parts[1].removingPercentEncoding, Validation.isValidUsername(name) else { return nil }
        let id = c.queryItems?.first { $0.name == "catch" }?.value
        self.init(username: name, catchId: (id?.isEmpty ?? true) ? nil : id)
    }
}

extension Array where Element == Photo {
    /// groupShareId(): the id a share link uses for this catch.
    var shareId: String? { first.map { $0.catchId ?? $0.name } }
}
