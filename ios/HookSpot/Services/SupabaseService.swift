import Foundation
import Supabase

/// Shared client. supabase-swift persists the session in the Keychain by default —
/// never copy tokens into UserDefaults.
enum SupabaseService {
    static let client = SupabaseClient(
        supabaseURL: AppConfig.supabaseURL,
        supabaseKey: AppConfig.supabaseAnonKey,
        options: SupabaseClientOptions(auth: .init(emitLocalSessionAsInitialSession: true))
    )

    static var auth: AuthClient { client.auth }

    static func publicURL(bucket: String, path: String) -> URL? {
        try? client.storage.from(bucket).getPublicURL(path: path)
    }

    /// Current access token, refreshed if needed (nil when signed out).
    static func accessToken() async -> String? {
        try? await auth.session.accessToken
    }
}
