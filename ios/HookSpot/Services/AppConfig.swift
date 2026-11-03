import Foundation

/// Build-time config from Config/*.xcconfig → Info.plist (HS* keys).
enum AppConfig {
    private static func value(_ key: String) -> String {
        (Bundle.main.object(forInfoDictionaryKey: key) as? String ?? "").trimmingCharacters(in: .whitespaces)
    }

    static let supabaseURL = URL(string: value("HSSupabaseURL")) ?? URL(string: "https://invalid.supabase.co")!
    static let supabaseAnonKey = value("HSSupabaseAnonKey")
    static let mapboxPublicToken = value("HSMapboxPublicToken")
    static let apiBaseURL = URL(string: value("HSAPIBaseURL")) ?? URL(string: "https://hook-spot.com")!

    static let mapStyleURI = "mapbox://styles/derrellwilliams/cmoc96j0y000i01r90nqr62du"
    static let catchesBucket = "catches"
    static let avatarsBucket = "avatars"

    static var isConfigured: Bool { !supabaseAnonKey.isEmpty && value("HSSupabaseURL").hasPrefix("https://") }

    /// Share link served with OG previews by catch-meta-handler.js.
    static func shareURL(username: String, catchId: String) -> URL? {
        var c = URLComponents(url: apiBaseURL.appending(path: "user/\(username)"), resolvingAgainstBaseURL: false)
        c?.queryItems = [URLQueryItem(name: "catch", value: catchId)]
        return c?.url
    }
}
