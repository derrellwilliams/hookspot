import SwiftUI
import MapboxMaps

extension Coordinate {
    var cl: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}

enum HookSpotMapStyle {
    static var style: MapStyle { MapStyle(uri: StyleURI(rawValue: AppConfig.mapStyleURI) ?? .dark) }
}

/// Non-interactive mini map in the catch sheet (PopupCarousel MiniMap), zoom 11, black pin.
struct MiniMap: View {
    let coordinate: Coordinate

    var body: some View {
        Map(initialViewport: .camera(center: coordinate.cl, zoom: 11)) {
            MapViewAnnotation(coordinate: coordinate.cl) {
                Icon.mapPin.view(28).foregroundStyle(.black)
                    .accessibilityHidden(true)
            }
        }
        .mapStyle(HookSpotMapStyle.style)
        .ornamentOptions(OrnamentOptions(scaleBar: ScaleBarViewOptions(visibility: .hidden),
                                         compass: CompassViewOptions(visibility: .hidden)))
        .allowsHitTesting(false)
        .accessibilityLabel("Map of catch location")
    }
}

/// Feed map mode: one pin per catch group. Stays mounted while the list shows, so
/// the camera survives toggling (MapPage keeps its map mounted the same way).
struct FeedMapView: View {
    let groups: [PhotoGroup]
    var onSelect: (PhotoGroup) -> Void

    @State private var viewport: Viewport = .styleDefault
    @State private var didFit = false

    private var pins: [(id: String, coord: Coordinate, group: PhotoGroup)] {
        groups.compactMap { g in g.first?.coordinate.map { (g[0].key, $0, g) } }
    }

    var body: some View {
        Map(viewport: $viewport) {
            ForEvery(pins, id: \.id) { pin in
                MapViewAnnotation(coordinate: pin.coord.cl) {
                    Button { onSelect(pin.group) } label: { MapPin(photo: pin.group.lead ?? pin.group[0]) }
                        .buttonStyle(.pressable)
                }
                .allowOverlap(true)
            }
        }
        .mapStyle(HookSpotMapStyle.style)
        .ornamentOptions(OrnamentOptions(scaleBar: ScaleBarViewOptions(visibility: .hidden)))
        .onAppear(perform: fitIfNeeded)
        .onChange(of: groups.count) { fitIfNeeded() }
    }

    private func fitIfNeeded() {
        guard !didFit, !pins.isEmpty else { return }
        didFit = true
        let coords = pins.map(\.coord.cl)
        viewport = coords.count == 1
            ? .camera(center: coords[0], zoom: 9)
            : .overview(geometry: MultiPoint(coords), geometryPadding: EdgeInsets(top: 80, leading: 40, bottom: 140, trailing: 40))
    }
}

/// Round thumbnail pin.
private struct MapPin: View {
    let photo: Photo
    var body: some View {
        ThumbImage(url: photo.thumbUrl)
            .frame(width: 44, height: 44)
            .clipShape(.circle)
            .overlay(Circle().stroke(.white, lineWidth: 2))
            .shadow(color: .black.opacity(0.35), radius: 4, y: 2)
            .accessibilityLabel(Formatters.cleanSpecies(photo.species).map { "\($0) catch" } ?? "Catch")
    }
}
