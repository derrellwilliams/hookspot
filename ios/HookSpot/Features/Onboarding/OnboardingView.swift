import SwiftUI
import PhotosUI

/// OnboardingPage: avatar (required), username with live availability check, name, bio.
struct OnboardingView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed

    @State private var username = ""
    @State private var displayName = ""
    @State private var bio = ""
    @State private var avatarItem: PhotosPickerItem?
    @State private var avatarData: Data?
    @State private var avatarImage: Image?
    @State private var check: UsernameCheck = .idle
    @State private var saving = false
    @State private var saveError: String?

    enum UsernameCheck: Equatable { case idle, invalid, checking, available, taken, failed }

    private let api = APIClient()
    private let profiles = ProfileService()

    private var canSave: Bool { check == .available && avatarData != nil && !saving }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 16) {
                        PhotosPicker(selection: $avatarItem, matching: .images) {
                            Group {
                                if let avatarImage { avatarImage.resizable().scaledToFill() }
                                else { Icon.user.view(32).foregroundStyle(Theme.darkMuted) }
                            }
                            .frame(width: 80, height: 80)
                            .background(Theme.avatarFallback)
                            .clipShape(.circle)
                        }
                        .accessibilityLabel(avatarImage == nil ? "Choose profile photo" : "Change profile photo")
                        PhotosPicker(avatarImage == nil ? "Upload photo" : "Change photo", selection: $avatarItem, matching: .images)
                            .buttonStyle(SecondaryButtonStyle())
                    }
                    .padding(.vertical, 4)
                } header: { Text("Profile photo *") }

                Section {
                    TextField("username", text: $username)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onChange(of: username) { _, new in
                            let cleaned = String(new.lowercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_" || $0 == "-") })
                            if cleaned != new { username = cleaned }
                        }
                } header: { Text("Username *") } footer: { usernameFooter }

                Section("Name") {
                    TextField("Display name", text: $displayName)
                        .textContentType(.name)
                        .onChange(of: displayName) { _, v in if v.count > Validation.displayNameMax { displayName = String(v.prefix(Validation.displayNameMax)) } }
                }
                Section("Bio") {
                    TextField("A little about your fishing", text: $bio, axis: .vertical)
                        .lineLimit(3...6)
                        .onChange(of: bio) { _, v in if v.count > Validation.bioMax { bio = String(v.prefix(Validation.bioMax)) } }
                }
                if let saveError {
                    Section { Text(saveError).foregroundStyle(.red) }
                }
            }
            .scrollContentBackground(.hidden)
            .background(DitherBackground())
            .navigationTitle("Let's set up your profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: save) {
                        if saving { PixelFishLoader(size: 18) } else { Text("Save") }
                    }
                    .disabled(!canSave)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Sign Out") { Task { await auth.signOut() } }
                }
            }
            .task(id: username) { await checkUsername() }
            .task(id: avatarItem) { await loadAvatar() }
            .onAppear {
                if displayName.isEmpty { displayName = auth.displayName ?? "" }
                if bio.isEmpty { bio = auth.bio ?? "" }
            }
            .sensoryFeedback(.selection, trigger: check == .available)
        }
    }

    @ViewBuilder private var usernameFooter: some View {
        switch check {
        case .idle: Text("3–20 characters: lowercase letters, numbers, - or _")
        case .invalid: Text("3–20 chars: lowercase letters, numbers, - or _").foregroundStyle(.red)
        case .checking: Text("Checking…")
        case .available: Label { Text("Available") } icon: { Icon.checkCircle.view(14) }.foregroundStyle(Theme.iosBlue)
        case .taken: Text("That username is taken").foregroundStyle(.red)
        case .failed: Text("Could not check username. Try again.").foregroundStyle(.red)
        }
    }

    /// Debounced (task restarts on every keystroke) availability check.
    private func checkUsername() async {
        guard !username.isEmpty else { check = .idle; return }
        guard Validation.isValidUsername(username) else { check = .invalid; return }
        check = .checking
        try? await Task.sleep(for: .milliseconds(350))
        guard !Task.isCancelled else { return }
        do {
            let ok = try await api.isUsernameAvailable(username)
            guard !Task.isCancelled else { return }
            check = ok ? .available : .taken
        } catch {
            if !Task.isCancelled { check = .failed }
        }
    }

    private func loadAvatar() async {
        guard let avatarItem, let data = try? await avatarItem.loadTransferable(type: Data.self),
              let preview = try? ImageProcessing.jpeg(from: data, maxPx: 400, quality: 0.85),
              let ui = UIImage(data: preview) else { return }
        avatarData = data
        avatarImage = Image(uiImage: ui)
    }

    private func save() {
        guard canSave, let userId = auth.userId, let avatarData else { return }
        saving = true; saveError = nil
        Task {
            defer { saving = false }
            do {
                // Re-validate at submit time against stale state.
                guard try await api.isUsernameAvailable(username) else { check = .taken; return }
                let url = try await profiles.uploadAvatar(userId: userId, imageData: avatarData)
                let name = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
                let b = bio.trimmingCharacters(in: .whitespacesAndNewlines)
                try await profiles.completeOnboarding(username: username, displayName: name.isEmpty ? nil : name,
                                                      bio: b.isEmpty ? nil : b, avatarUrl: url.absoluteString)
                auth.applyProfile(username: username, avatarUrl: url.absoluteString)
            } catch {
                saveError = error.localizedDescription.isEmpty ? "Failed to save. Please try again." : error.localizedDescription
            }
        }
    }
}
