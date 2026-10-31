import SwiftUI
import PhotosUI

/// UploadDialog: pick/take photos → pin location (only when the first photo has no GPS) →
/// details (species pre-filled by Claude, rod/fly, hide time) → Add Catch. The sheet closes on
/// submit and the upload runs in the background, finishing with a toast — same as web.
struct UploadView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(FeedStore.self) private var feed
    @Environment(\.dismiss) private var dismiss

    enum Step: Hashable { case location, details }

    @State private var path: [Step] = []
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var pickingMore = false
    @State private var items: [PendingPhoto] = []
    @State private var loading = false
    @State private var showCamera = false
    @State private var pin: Coordinate?
    @State private var species = ""
    @State private var rod = ""
    @State private var fly = ""
    @State private var hideTime = false
    @State private var identifying = false
    @State private var speciesEdited = false

    struct PendingPhoto: Identifiable {
        let id = UUID()
        let item: UploadService.Item
        let preview: Image
        let exif: ImageProcessing.Exif
    }

    var body: some View {
        NavigationStack(path: $path) {
            chooseStep
                .navigationTitle("Add a catch")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { closeButton }
                .navigationDestination(for: Step.self) { step in
                    switch step {
                    case .location: locationStep
                    case .details: detailsStep
                    }
                }
        }
        .presentationDetents([.large])
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { data in
                showCamera = false
                if let data { Task { await load([data]) } }
            }
            .ignoresSafeArea()
        }
        .task(id: pickerItems) {
            guard !pickerItems.isEmpty else { return }
            var datas: [Data] = []
            loading = true
            for item in pickerItems {
                if let d = try? await item.loadTransferable(type: Data.self) { datas.append(d) }
            }
            pickerItems = []
            await load(datas)
        }
    }

    @ToolbarContentBuilder private var closeButton: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button { dismiss() } label: { Icon.xmark.view(18) }.accessibilityLabel("Close")
        }
    }

    // MARK: Step 1 — choose

    private var chooseStep: some View {
        VStack(spacing: 18) {
            Spacer()
            if loading {
                PixelFishLoader(size: 64)
            } else {
                Icon.mediaImage.view(28).foregroundStyle(Theme.darkMuted.opacity(0.6))
                PhotosPicker(selection: $pickerItems, maxSelectionCount: 10, matching: .images, photoLibrary: .shared()) {
                    Text("Choose photos")
                }
                .buttonStyle(.primary())
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button("Take photo") { showCamera = true }
                        .buttonStyle(.tinted)
                }
            }
            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Theme.uiBg)
    }

    /// Decode previews + EXIF, then go to the location step only if the first photo has no GPS.
    private func load(_ datas: [Data]) async {
        loading = true
        defer { loading = false }
        var loaded: [PendingPhoto] = []
        for data in datas {
            guard let preview = try? await ImageProcessing.displayJPEG(data), let ui = UIImage(data: preview) else { continue }
            loaded.append(PendingPhoto(item: .init(filename: UploadNaming.filename(for: nil), data: data),
                                       preview: Image(uiImage: ui), exif: ImageProcessing.exif(from: data)))
        }
        guard !loaded.isEmpty else { feed.showToast("Couldn't read those photos."); return }
        let wasEmpty = items.isEmpty
        items += loaded
        guard wasEmpty else { return } // adding more from the details step
        pin = nil
        path = [items[0].exif.coordinate == nil ? .location : .details]
        identifyFirst()
    }

    private func identifyFirst() {
        guard let first = items.first else { return }
        identifying = true
        Task {
            defer { identifying = false }
            guard let jpeg = try? await ImageProcessing.identifyJPEG(first.item.data) else { return }
            let s = await APIClient().identify(jpeg: jpeg, token: await SupabaseService.accessToken())
            if let s, !speciesEdited, species.isEmpty { species = Formatters.cleanSpecies(s) ?? s }
        }
    }

    // MARK: Step 2 — location

    private var locationStep: some View {
        VStack(spacing: 0) {
            Text("No GPS data found — pin your catch location")
                .font(Typography.caption).foregroundStyle(Theme.darkText)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(Theme.tint, in: Capsule())
                .padding(.vertical, 10)
            PinDropMap(pin: $pin, start: PhotoGrouping.homeCenter(feed.photos))
                .clipShape(.rect(cornerRadius: Theme.cardRadius, style: .continuous))
                .padding(.horizontal, 12)
            Button("Next") { path.append(.details) }
                .buttonStyle(.primary())
                .disabled(pin == nil)
                .padding(16)
        }
        .background(Theme.uiBg)
        .navigationTitle("Location")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.selection, trigger: pin)
    }

    // MARK: Step 3 — details

    private var detailsStep: some View {
        Form {
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(items) { p in
                            p.preview.resizable().scaledToFill()
                                .frame(width: 72, height: 72)
                                .clipShape(.rect(cornerRadius: 10, style: .continuous))
                                .overlay(alignment: .topLeading) {
                                    if p.id == items.first?.id {
                                        Text("Cover").font(Typography.font(.condensed, 10, .medium, relativeTo: .caption2))
                                            .padding(.horizontal, 5).padding(.vertical, 2)
                                            .background(.black.opacity(0.6), in: Capsule()).padding(4)
                                    }
                                }
                                .contextMenu {
                                    if p.id != items.first?.id {
                                        Button("Make cover photo") { makeCover(p) }
                                    }
                                    Button("Remove", role: .destructive) { remove(p) }
                                }
                                .accessibilityLabel(p.id == items.first?.id ? "Cover photo" : "Photo")
                        }
                        Button { pickingMore = true } label: {
                            Icon.plus.view(22).frame(width: 72, height: 72)
                                .background(Theme.darkSurface, in: .rect(cornerRadius: 10, style: .continuous))
                        }
                        .buttonStyle(.pressable)
                        .photosPicker(isPresented: $pickingMore, selection: $pickerItems, maxSelectionCount: 10, matching: .images)
                        .accessibilityLabel("Add more photos")
                    }
                    .padding(.vertical, 4)
                }
            } footer: { Text("Touch and hold a photo to make it the cover or remove it.") }

            Section("Species") {
                HStack {
                    TextField(identifying ? "Identifying…" : "e.g. Brown Trout", text: $species)
                        .textInputAutocapitalization(.words)
                        .disabled(identifying)
                        .onChange(of: species) { _, _ in if !identifying { speciesEdited = true } }
                    if identifying { PixelFishLoader(size: 14) }
                }
            }
            Section("Gear") {
                GearField(title: "Rod", value: $rod, suggestions: feed.gearSuggestions("rod", saved: auth.gearRods))
                GearField(title: "Fly", value: $fly, suggestions: feed.gearSuggestions("fly", saved: auth.gearFlies))
            }
            Section {
                Toggle("Hide time of catch", isOn: $hideTime)
            }
            Section {
                Button("Add Catch", action: submit)
                    .buttonStyle(.primary())
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .disabled(items.isEmpty)
            }
        }
        .navigationTitle("Details")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func makeCover(_ p: PendingPhoto) {
        guard let i = items.firstIndex(where: { $0.id == p.id }) else { return }
        items.insert(items.remove(at: i), at: 0)
    }

    private func remove(_ p: PendingPhoto) {
        items.removeAll { $0.id == p.id }
        if items.isEmpty { path = [] }
    }

    // MARK: Submit

    private func submit() {
        guard let userId = auth.userId, !items.isEmpty else { return }
        let details = UploadService.CatchDetails(species: species.trimmingCharacters(in: .whitespacesAndNewlines),
                                                 rod: rod, fly: fly, hideTime: hideTime, manualPin: pin)
        let uploadItems = items.map(\.item)
        let existing = feed.existingOwnNames
        let (savedRods, savedFlies) = (auth.gearRods, auth.gearFlies)
        dismiss()
        Task { [feed, auth] in
            do {
                let result = try await UploadService().addCatch(uploadItems, details: details, userId: userId, existingNames: existing)
                feed.add(result.photos)
                result.photos.forEach { feed.enrich($0, userId: userId) }
                feed.showToast(result.failed > 0 ? "Catch added (\(result.failed) photo\(result.failed == 1 ? "" : "s") failed)" : "Catch added!", .success)
                if let user = try? await ProfileService().appendGear(rod: Formatters.cleanGear(details.rod), fly: Formatters.cleanGear(details.fly),
                                                                     currentRods: savedRods, currentFlies: savedFlies) {
                    auth.applyUser(user)
                }
            } catch {
                feed.showToast("Failed to add catch.")
            }
        }
    }
}

/// Camera capture (input capture="environment" on web). Returns JPEG data, or nil if cancelled.
struct CameraPicker: UIViewControllerRepresentable {
    var onFinish: (Data?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onFinish: (Data?) -> Void
        init(onFinish: @escaping (Data?) -> Void) { self.onFinish = onFinish }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            onFinish((info[.originalImage] as? UIImage)?.jpegData(compressionQuality: 0.92))
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { onFinish(nil) }
    }
}
