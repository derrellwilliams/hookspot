import SwiftUI
import MapboxMaps

extension Coordinate {
    var cl: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}

enum HookSpotMapStyle {
    /// Same style as the web, with basemap place labels on (MapView sets showPlaceLabels).
    static var style: MapStyle {
        MapStyle(uri: StyleURI(rawValue: AppConfig.mapStyleURI) ?? .dark, configuration: ["showPlaceLabels": true])
    }
}

/// Mapbox's default marker (the pin mapbox-gl draws on web), black like MARKER_COLOR.
/// Laid out so the pin's tip sits at the view's center — MapViewAnnotation's default anchor.
struct CatchPin: View {
    var body: some View {
        Image("mapbox.marker")
            .resizable()
            .frame(width: 27, height: 41)
            .frame(width: 44, height: 70, alignment: .top) // tip (y≈35) at center; 44pt tap width
            .contentShape(Rectangle().size(width: 44, height: 50)) // pin only, not the empty half below the tip
    }
}

/// Non-interactive mini map in the catch sheet (PopupCarousel MiniMap), zoom 11, black pin.
struct MiniMap: View {
    let coordinate: Coordinate

    var body: some View {
        Map(initialViewport: .camera(center: coordinate.cl, zoom: 11)) {
            MapViewAnnotation(coordinate: coordinate.cl) {
                CatchPin().accessibilityHidden(true)
            }
        }
        .mapStyle(HookSpotMapStyle.style)
        .ornamentOptions(OrnamentOptions(scaleBar: ScaleBarViewOptions(visibility: .hidden),
                                         compass: CompassViewOptions(visibility: .hidden)))
        .allowsHitTesting(false)
        .accessibilityLabel("Map of catch location")
    }
}

/// Feed map mode, matching MapView.jsx: Mapbox default pins (one per catch, at the average
/// of its photos' coordinates), starts on Salt Lake City at zoom 11, and tapping a pin jumps
/// to it (zoom ≥ 13) with 65% bottom padding so it sits above the catch sheet. Stays mounted
/// while the list shows, so the camera survives toggling.
struct FeedMapView: View {
    let groups: [PhotoGroup]
    var onSelect: (PhotoGroup) -> Void

    static let initialCenter = CLLocationCoordinate2D(latitude: 40.760, longitude: -111.891)
    static let initialZoom = 11.0
    static let minFlyZoom = 13.0

    @State private var viewport: Viewport = .camera(center: initialCenter, zoom: initialZoom)
    @State private var zoom = initialZoom

    private var pins: [(id: String, coord: Coordinate, group: PhotoGroup)] {
        groups.compactMap { g in
            let coords = g.compactMap(\.coordinate)
            guard !coords.isEmpty else { return nil }
            let n = Double(coords.count)
            let avg = Coordinate(latitude: coords.map(\.latitude).reduce(0, +) / n,
                                 longitude: coords.map(\.longitude).reduce(0, +) / n)
            return (g[0].key, avg, g)
        }
    }

    var body: some View {
        GeometryReader { geo in
            Map(viewport: $viewport) {
                ForEvery(pins, id: \.id) { pin in
                    MapViewAnnotation(coordinate: pin.coord.cl) {
                        Button {
                            viewport = Viewport.camera(center: pin.coord.cl, zoom: max(zoom, Self.minFlyZoom))
                                .padding(.bottom, (geo.size.height * 0.65).rounded())
                            onSelect(pin.group)
                        } label: { CatchPin() }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Formatters.cleanSpecies(pin.group.lead?.species).map { "\($0) catch" } ?? "Catch")
                    }
                    .allowOverlap(true)
                }
            }
            .mapStyle(HookSpotMapStyle.style)
            .onCameraChanged { zoom = $0.cameraState.zoom }
            .ornamentOptions(OrnamentOptions(scaleBar: ScaleBarViewOptions(visibility: .hidden)))
        }
    }
}
