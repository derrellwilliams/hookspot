import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { deletePhotos } from '../../lib/fileLoader.js'
import { PopupCarousel } from './PopupCarousel.jsx'
import styles from './Map.module.css'
import { MAPBOX_TOKEN, MAP_STYLE } from '../../lib/mapbox.js'

const MAP_CENTER = [-111.891, 40.760]
const MAP_ZOOM = 11
const MARKER_COLOR = '#000000'
const POPUP_MAX_WIDTH = '484px'
const MIN_FLY_ZOOM = 13
const POPUP_PAN_FACTOR = 0.65
const BOUNDS_PADDING_DEGREES = 0.008  // ~0.55 miles
const INITIAL_FIT_COUNT = 10
const DEFAULT_SIDEBAR_RIGHT = 260

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

export function MapView({ active }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])  // { key, marker, popup, root }
  const markerByNameRef = useRef(new Map())
  const [mapReady, setMapReady] = useState(false)
  const [fitted, setFitted] = useState(false)
  const savedViewRef = useRef(null)

  const groups = usePhotoStore(s => s.groups)
  const photosInitialized = usePhotoStore(s => s.photosInitialized)
  const ownOnly = usePhotoStore(s => s.ownOnly)
  const setFlyToPhoto = usePhotoStore(s => s.setFlyToPhoto)
  const setActiveGroup = usePhotoStore(s => s.setActiveGroup)

  const visibleGroups = useMemo(
    () => ownOnly ? groups.filter(g => g.some(p => p.isOwn)) : groups,
    [groups, ownOnly]
  )

  // Init map once. flyToPhotoFn is defined here so it only enters the store once,
  // reading current marker state via markerByNameRef on each call.
  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
    })
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
    map.on('click', () => {
      markersRef.current.forEach(({ popup }) => popup.remove())
    })
    map.on('load', () => {
      setFlyToPhoto((photo) => {
        const entry = markerByNameRef.current.get(photo.name)
        if (!entry) return
        const { marker, popup } = entry
        markersRef.current.forEach(m => m.popup.remove())
        const lnglat = marker.getLngLat()
        const zoom = Math.max(map.getZoom(), MIN_FLY_ZOOM)
        const sidebarRight = DEFAULT_SIDEBAR_RIGHT
        map.jumpTo({ center: lnglat, zoom, padding: { left: sidebarRight, right: 0, top: 0, bottom: 0 } })
        popup.addTo(map)
        requestAnimationFrame(() => {
          const popupEl = popup.getElement()
          if (!popupEl) return
          map.panBy([0, -(popupEl.offsetHeight * POPUP_PAN_FACTOR)], { duration: 0 })
        })
      })
      setMapReady(true)
    })
    mapRef.current = map
    return () => {
      markersRef.current.forEach(({ root }) => root.unmount())
      markersRef.current = []
      map.remove()
    }
  }, [setFlyToPhoto])

  // Rebuild markers when groups or filter change
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current

    const groupKey = (group) => group.map(p => p.name).sort().join('|')
    const newKeySet = new Set(visibleGroups.map(groupKey))

    // If a group gained or lost photos, its key changes. Update the entry's key in place
    // so the marker and open popup are preserved rather than destroyed and recreated.
    for (const entry of markersRef.current) {
      if (newKeySet.has(entry.key)) continue
      const oldNames = new Set(entry.key.split('|'))
      for (const newKey of newKeySet) {
        const newNames = new Set(newKey.split('|'))
        const grew = [...oldNames].every(n => newNames.has(n))   // old ⊆ new
        const shrank = [...newNames].every(n => oldNames.has(n)) // new ⊆ old
        if (grew || shrank) { entry.key = newKey; break }
      }
    }

    const existingByKey = new Map(markersRef.current.map(m => [m.key, m]))

    // Remove markers for deleted/hidden groups
    markersRef.current.forEach(({ key, marker, popup, root }) => {
      if (!newKeySet.has(key)) { root.unmount(); popup.remove(); marker.remove() }
    })
    markersRef.current = markersRef.current.filter(m => newKeySet.has(m.key))

    // Add markers for new groups
    for (const group of visibleGroups) {
      const key = groupKey(group)
      if (existingByKey.has(key)) continue

      const lng = avg(group.map(p => p.exif.longitude))
      const lat = avg(group.map(p => p.exif.latitude))
      if (isNaN(lng) || isNaN(lat)) continue
      const lnglat = [lng, lat]

      const el = document.createElement('div')
      const root = createRoot(el)

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: POPUP_MAX_WIDTH,
        offset: 12,
      }).setDOMContent(el).setLngLat(lnglat)

      root.render(
        <PopupCarousel
          initialGroup={group}
          onClose={() => popup.remove()}
          onDelete={async (toDelete) => {
            markersRef.current.forEach(({ popup: p }) => p.remove())
            await deletePhotos(toDelete)
            usePhotoStore.getState().showToast('Catch deleted')
          }}
        />
      )

      const marker = new mapboxgl.Marker({ color: MARKER_COLOR })
        .setLngLat(lnglat)
        .addTo(map)
      marker.getElement().style.cursor = 'pointer'

      markersRef.current.push({ key, marker, popup, root })
    }

    // Rebuild name→entry lookup and refresh click handlers
    const finalByKey = new Map(markersRef.current.map(m => [m.key, m]))
    const markerByName = new Map()
    for (const group of visibleGroups) {
      const key = groupKey(group)
      const entry = finalByKey.get(key)
      if (!entry) continue
      for (const photo of group) markerByName.set(photo.name, entry)

      const el = entry.marker.getElement()
      if (entry._clickHandler) el.removeEventListener('click', entry._clickHandler)
      entry._clickHandler = (e) => {
        e.stopPropagation()
        setActiveGroup(group)
        usePhotoStore.getState().flyToPhoto?.(group[0])
      }
      el.addEventListener('click', entry._clickHandler)
    }

    // Publish updated lookup so flyToPhotoFn (in init effect) sees current markers
    markerByNameRef.current = markerByName
  }, [visibleGroups, mapReady, setActiveGroup])

  // Resize map when it becomes visible (e.g. navigating from /profile to /).
  // Save/restore center+zoom because the hidden container collapses to 0×0 and
  // Mapbox recalculates zoom relative to that, zooming out to the whole world.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (active) {
      map.resize()
      if (savedViewRef.current) {
        map.jumpTo(savedViewRef.current)
        savedViewRef.current = null
      }
    } else {
      savedViewRef.current = { center: map.getCenter(), zoom: map.getZoom() }
    }
  }, [active])

  // Fit bounds once on initial load to the 15 most recent catches (everyone tab).
  // Falls back to Salt Lake region when the user has no visible catches.
  useEffect(() => {
    if (!mapReady || fitted || !photosInitialized) return

    const map = mapRef.current

    if (groups.length === 0) {
      map.jumpTo({ center: MAP_CENTER, zoom: MAP_ZOOM })
      setFitted(true)
      return
    }

    const recent = [...groups]
      .sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0))
      .slice(0, INITIAL_FIT_COUNT)

    const points = recent.map(g => ({
      lng: avg(g.map(p => p.exif.longitude)),
      lat: avg(g.map(p => p.exif.latitude)),
    }))

    const lngs = points.map(p => p.lng)
    const lats = points.map(p => p.lat)
    const bounds = new mapboxgl.LngLatBounds(
      [Math.min(...lngs) - BOUNDS_PADDING_DEGREES, Math.min(...lats) - BOUNDS_PADDING_DEGREES],
      [Math.max(...lngs) + BOUNDS_PADDING_DEGREES, Math.max(...lats) + BOUNDS_PADDING_DEGREES]
    )
    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 60, left: 376, right: 60 },
      maxZoom: 16,
      duration: 0,
    })
    setFitted(true)
  }, [groups, mapReady, fitted, photosInitialized])

  return <div ref={containerRef} className={styles.map} />
}
