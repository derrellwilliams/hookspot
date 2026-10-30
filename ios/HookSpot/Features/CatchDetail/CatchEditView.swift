import SwiftUI
import PhotosUI

/// Owner edit mode for a catch: species/rod/fly, reorder, add/remove photos, delete.
/// Writes both `photos` and `catches` (saveEdit) through CatchService.
struct CatchEditView: View {
    enum Result { case saved(PhotoGroup), deleted, cancelled }

    let group: PhotoGroup
    var onFinish: (Result) -> Void

    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed
    @Environment(\.dismiss) private var dismiss

    @State private var species = ""
    @State private var rod = ""
    @State private var fly = ""
    @State private var order: PhotoGroup = []
    @State private var orderChanged = false
    @State private var addItem: PhotosPickerItem?
    @State private var adding = false
    @State private var saving = false
    @State private var confirmDelete = false
    @State private var error: String?

    private let catches = CatchService()
    private let uploads = UploadService()

    var body: some View {
        NavigationStack {
            Form {
                Section("Species") {
                    TextField("e.g. Brown Trout", text: $species).textInputAutocapitalization(.words)
                }
                Section("Gear") {
                    GearField(title: "Rod", value: $rod, suggestions: feed.gearSuggestions("rod", saved: auth.gearRods))
                    GearField(title: "Fly", value: $fly, suggestions: feed.gearSuggestions("fly", saved: auth.gearFlies))
                }
                Section {
                    ForEach(order, id: \.key) { p in
                        HStack(spacing: 12) {
                            ThumbImage(url: p.thumbUrl).frame(width: 56, height: 56)
                                .clipShape(.rect(cornerRadius: 8))
                            Text(p == order.first ? "Cover photo" : "Photo").font(Typography.body)
                        }
                    }
                    .onMove { from, to in order.move(fromOffsets: from, toOffset: to); orderChanged = true }
                    .onDelete(perform: removePhotos)
                    PhotosPicker(selection: $addItem, matching: .images) {
                        HStack {
                            if adding { PixelFishLoader(size: 22) } else { Image(systemName: "plus") }
                            Text("Add photo")
                        }
                    }
                    .disabled(adding)
                } header: { Text("Photos") } footer: { Text("Drag to reorder. The first photo is the cover.") }

                if let error { Section { Text(error).foregroundStyle(.red) } }

                Section {
                    Button("Delete Catch", role: .destructive) { confirmDelete = true }
                }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Edit Catch")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { onFinish(.cancelled); dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: save) { if saving { PixelFishLoader(size: 18) } else { Text("Save") } }
                        .disabled(saving)
                }
            }
            .confirmationDialog("Delete this catch?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete Catch", role: .destructive, action: deleteCatch)
            } message: { Text("All of its photos will be removed. This can't be undone.") }
            .task(id: addItem) { await addPhoto() }
            .onAppear {
                let lead = group[0]
                species = lead.species ?? ""
                rod = lead.rod ?? ""
                fly = lead.fly ?? ""
                order = group
            }
            .sensoryFeedback(.success, trigger: saving == false && error == nil)
        }
    }

    private func save() {
        guard let userId = auth.userId else { return }
        saving = true; error = nil
        Task {
            defer { saving = false }
            do {
                let result = try await catches.saveEdit(group: group, lead: group[0], species: species, rod: rod, fly: fly,
                                                        newOrder: orderChanged ? order : nil, userId: userId)
                feed.update(result.lead)
                if let reordered = result.reordered { feed.replaceGroupOrder(reordered) }
                let updated = result.reordered ?? group.map { $0.key == result.lead.key ? result.lead : $0 }
                feed.showToast("Changes saved")
                onFinish(.saved(updated))
                dismiss()
            } catch {
                self.error = "Failed to save changes"
            }
        }
    }

    private func removePhotos(_ offsets: IndexSet) {
        guard let userId = auth.userId else { return }
        let removed = offsets.map { order[$0] }
        order.remove(atOffsets: offsets)
        Task {
            do {
                try await catches.deletePhotos(removed, userId: userId)
                feed.remove(removed)
                feed.showToast("Photo removed")
                if order.isEmpty { onFinish(.deleted); dismiss() }
            } catch {
                self.error = "Failed to remove photo"
                order = group
            }
        }
    }

    private func addPhoto() async {
        guard let addItem, let userId = auth.userId else { return }
        adding = true
        defer { adding = false; self.addItem = nil }
        do {
            guard let data = try await addItem.loadTransferable(type: Data.self) else { return }
            let item = UploadService.Item(filename: UploadNaming.filename(for: addItem), data: data)
            let photo = try await uploads.addPhoto(item, to: order.first ?? group[0], userId: userId)
            feed.add([photo])
            order.append(photo)
            feed.showToast("Photo added")
        } catch {
            self.error = "Failed to add photo"
        }
    }

    private func deleteCatch() {
        guard let userId = auth.userId else { return }
        Task {
            do {
                try await catches.deletePhotos(group, userId: userId)
                feed.remove(group)
                feed.showToast("Catch deleted")
                onFinish(.deleted)
                dismiss()
            } catch {
                self.error = "Failed to delete catch"
            }
        }
    }
}

/// Filenames for picked photos. The picker doesn't expose originals' names, so each gets a
/// unique one (also the row's identity key with user_id, and the storage object name).
enum UploadNaming {
    static func filename(for item: PhotosPickerItem?) -> String {
        let stamp = Int(Date.now.timeIntervalSince1970 * 1000)
        return "IMG_\(stamp)_\(UUID().uuidString.prefix(8)).jpg"
    }
}
