import SwiftUI

/// FollowListDialog: Followers / Following for a profile.
struct FollowListSheet: View {
    let profileId: String
    @State var initial: ProfileService.FollowList
    var onOpenProfile: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var people: [ProfileSummary] = []
    @State private var loading = true

    var body: some View {
        NavigationStack {
            List {
                if loading {
                    HStack { Spacer(); PixelFishLoader(size: 32); Spacer() }.listRowBackground(Color.clear)
                } else if people.isEmpty {
                    Text(initial == .followers ? "No followers yet." : "Not following anyone yet.")
                        .foregroundStyle(Theme.darkMuted).listRowBackground(Color.clear)
                } else {
                    ForEach(people) { p in
                        Button { if let u = p.username { onOpenProfile(u) } } label: { UserRow(profile: p) }
                    }
                }
            }
            .safeAreaInset(edge: .top) {
                Picker("List", selection: $initial) {
                    Text("Followers").tag(ProfileService.FollowList.followers)
                    Text("Following").tag(ProfileService.FollowList.following)
                }
                .pickerStyle(.segmented).padding(.horizontal, 16).padding(.bottom, 8)
            }
            .navigationTitle(initial == .followers ? "Followers" : "Following")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Icon.xmark.view(18) }.accessibilityLabel("Close")
                }
            }
            .task(id: initial) {
                loading = true
                people = (try? await ProfileService().followList(initial, profileId: profileId)) ?? []
                loading = false
            }
        }
        .presentationDetents([.medium, .large])
    }
}

/// Edit profile: display name + bio (metadata scalars + profiles row; avatar stays in profiles).
struct EditProfileSheet: View {
    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var bio = ""
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("Display name", text: $name)
                        .onChange(of: name) { _, v in if v.count > Validation.displayNameMax { name = String(v.prefix(Validation.displayNameMax)) } }
                }
                Section("Bio") {
                    TextField("Bio", text: $bio, axis: .vertical).lineLimit(3...6)
                        .onChange(of: bio) { _, v in if v.count > Validation.bioMax { bio = String(v.prefix(Validation.bioMax)) } }
                }
            }
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: save) { if saving { PixelFishLoader(size: 18) } else { Text("Save") } }.disabled(saving)
                }
            }
            .onAppear { name = auth.displayName ?? ""; bio = auth.bio ?? "" }
        }
    }

    private func save() {
        guard let userId = auth.userId else { return }
        saving = true
        Task {
            defer { saving = false }
            do {
                let user = try await ProfileService().updateProfile(userId: userId, displayName: name, bio: bio, avatarUrl: auth.avatarUrl)
                auth.applyUser(user)
                dismiss()
            } catch {
                feed.showToast("Failed to save profile. Please try again.")
            }
        }
    }
}

/// Edit gear: saved rod and fly lists (small string arrays in user_metadata).
struct EditGearSheet: View {
    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed
    @Environment(\.dismiss) private var dismiss
    @State private var rods: [String] = []
    @State private var flies: [String] = []
    @State private var newRod = ""
    @State private var newFly = ""
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                gearSection("Rods", items: $rods, draft: $newRod, placeholder: "Add a rod")
                gearSection("Flies", items: $flies, draft: $newFly, placeholder: "Add a fly")
            }
            .navigationTitle("Edit Gear")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: save) { if saving { PixelFishLoader(size: 18) } else { Text("Save") } }.disabled(saving)
                }
            }
            .onAppear { rods = auth.gearRods; flies = auth.gearFlies }
        }
    }

    private func gearSection(_ title: String, items: Binding<[String]>, draft: Binding<String>, placeholder: String) -> some View {
        Section(title) {
            ForEach(items.wrappedValue, id: \.self) { Text($0) }
                .onDelete { items.wrappedValue.remove(atOffsets: $0) }
            HStack {
                TextField(placeholder, text: draft).onSubmit { add(items, draft) }
                Button { add(items, draft) } label: { Icon.plus.view(18) }
                    .disabled(Formatters.cleanGear(draft.wrappedValue) == nil)
                    .accessibilityLabel(placeholder)
            }
        }
    }

    private func add(_ items: Binding<[String]>, _ draft: Binding<String>) {
        guard let v = Formatters.cleanGear(draft.wrappedValue), !items.wrappedValue.contains(v) else { return }
        items.wrappedValue.append(v)
        draft.wrappedValue = ""
    }

    private func save() {
        saving = true
        Task {
            defer { saving = false }
            do {
                auth.applyUser(try await ProfileService().updateGear(rods: rods, flies: flies))
                dismiss()
            } catch {
                feed.showToast("Failed to save gear. Please try again.")
            }
        }
    }
}
