import Foundation
import Observation
import Supabase

/// Mirrors useAuthStore + the onAuthStateChange handler in App.jsx.
@MainActor @Observable
final class AuthStore {
    enum Phase: Equatable { case loading, signedOut, needsOnboarding, signedIn }

    private(set) var phase: Phase = .loading
    private(set) var user: User?
    private(set) var username: String?
    /// From the `profiles` table — never user_metadata. Survives token refreshes.
    private(set) var avatarUrl: String?

    var userId: String? { user?.id.uuidString.lowercased() }
    var isSignedIn: Bool { user != nil }

    private func meta(_ key: String) -> AnyJSON? { user?.userMetadata[key] }
    var displayName: String? {
        [meta("display_name"), meta("full_name")].compactMap { $0?.stringValue }.first { !$0.isEmpty }
    }
    var bio: String? { meta("bio")?.stringValue }
    var gearRods: [String] { meta("gear_rods")?.arrayValue?.compactMap(\.stringValue) ?? [] }
    var gearFlies: [String] { meta("gear_flies")?.arrayValue?.compactMap(\.stringValue) ?? [] }

    var profileSummary: ProfileSummary? {
        userId.map { ProfileSummary(id: $0, username: username, displayName: displayName, avatarUrl: avatarUrl, bio: bio) }
    }

    /// Presents LoginView (sheet). Every write entry point calls `requireSignIn()`.
    var loginPresented = false

    /// Returns true when signed in; otherwise shows Login (which doubles as sign-up).
    @discardableResult
    func requireSignIn() -> Bool {
        if isSignedIn && phase == .signedIn { return true }
        if !isSignedIn { loginPresented = true }
        return false
    }

    /// Called whenever the signed-in user changes (or on first load) so the feed reloads.
    var onFeedOwnerChange: (@MainActor (String?) -> Void)?

    private let auth = SupabaseService.auth
    private let api = APIClient()
    private let profiles = ProfileService()
    private var listenTask: Task<Void, Never>?

    func start() {
        guard listenTask == nil else { return }
        listenTask = Task { [weak self] in
            guard let self else { return }
            for await (event, session) in auth.authStateChanges {
                await handle(event: event, session: session)
            }
        }
    }

    private func handle(event: AuthChangeEvent, session: Session?) async {
        switch event {
        case .initialSession, .signedIn:
            // An expired stored session shows the public feed until the SDK refreshes it;
            // the .tokenRefreshed below then finishes signing in.
            guard let session, !session.isExpired || event == .signedIn else {
                signedOutState(); return
            }
            await signIn(session, initial: event == .initialSession)
        case .tokenRefreshed, .userUpdated:
            guard let session else { break }
            if phase == .signedOut || phase == .loading {
                await signIn(session, initial: true)
            } else {
                user = session.user // keeps avatarUrl/username as-is
            }
        case .signedOut:
            signedOutState()
        default:
            break
        }
    }

    private func signIn(_ session: Session, initial: Bool) async {
        let previousId = userId
        user = session.user
        // Clear a legacy data: avatar before anything touches Storage.
        await profiles.clearLegacyDataAvatar(session.user)
        do {
            let p = try await api.profile(userId: userId!)
            if p.username == nil {
                phase = .needsOnboarding
                return
            }
            username = p.username
            avatarUrl = p.avatarUrl
        } catch {
            // Profile check failed — same as web: carry on to the feed.
        }
        phase = .signedIn
        if previousId != userId || initial { onFeedOwnerChange?(userId) }
    }

    private func signedOutState() {
        user = nil; username = nil; avatarUrl = nil
        phase = .signedOut
        onFeedOwnerChange?(nil)
    }

    // MARK: Actions

    func sendCode(email: String) async throws {
        try await auth.signInWithOTP(email: email.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    func verify(email: String, code: String) async throws {
        try await auth.verifyOTP(email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                                 token: code.trimmingCharacters(in: .whitespacesAndNewlines), type: .email)
    }

    func signOut() async {
        try? await auth.signOut()
    }

    /// After onboarding or profile edits.
    func applyProfile(username: String?, avatarUrl: String?) {
        if let username { self.username = username }
        if let avatarUrl { self.avatarUrl = avatarUrl }
        if phase == .needsOnboarding, self.username != nil {
            phase = .signedIn
            onFeedOwnerChange?(userId)
        }
    }

    func applyUser(_ user: User) { self.user = user }
}

private extension AnyJSON {
    var stringValue: String? { if case .string(let s) = self { s } else { nil } }
    var arrayValue: [AnyJSON]? { if case .array(let a) = self { a } else { nil } }
}
