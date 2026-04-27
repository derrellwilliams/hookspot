import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { deletePhotos } from '../../lib/fileLoader.js'
import { PopupCarousel } from './PopupCarousel.jsx'
import styles from './Map.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

export function MapView() {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])  // { marker, popup, root }
  const [mapReady, setMapReady] = useState(false)
  const [fitted, setFitted] = useState(false)

  const groups = usePhotoStore(s => s.groups)
  const setFlyToPhoto = usePhotoStore(s => s.setFlyToPhoto)
  const setActiveGroup = usePhotoStore(s => s.setActiveGroup)

  // Init map once
  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/derrellwilliams/cmoc96j0y000i01r90nqr62du',
      center: [-111.1, 39.5],
      zoom: 7,
    })
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
    map.on('click', () => {
      markersRef.current.forEach(({ popup }) => popup.remove())
    })
    map.on('load', () => setMapReady(true))
    mapRef.current = map
    return () => map.remove()
  }, [])

  // Rebuild markers when groups change
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current

    const groupKey = (group) => group.map(p => p.name).sort().join('|')
    const newKeySet = new Set(groups.map(groupKey))

    // If a group gained photos, its key changes (superset). Update the entry's key in place
    // so the marker and open popup are preserved rather than destroyed and recreated.
    for (const entry of markersRef.current) {
      if (newKeySet.has(entry.key)) continue
      const oldNames = entry.key.split('|')
      for (const newKey of newKeySet) {
        const newNames = new Set(newKey.split('|'))
        if (oldNames.every(n => newNames.has(n))) { entry.key = newKey; break }
      }
    }

    const existingByKey = new Map(markersRef.current.map(m => [m.key, m]))

    // Remove markers for deleted groups
    markersRef.current.forEach(({ key, marker, popup, root }) => {
      if (!newKeySet.has(key)) { popup.remove(); root.unmount(); marker.remove() }
    })
    markersRef.current = markersRef.current.filter(m => newKeySet.has(m.key))

    // Add markers for new groups
    for (const group of groups) {
      const key = groupKey(group)
      if (existingByKey.has(key)) continue

      const lng = avg(group.map(p => p.exif.longitude))
      const lat = avg(group.map(p => p.exif.latitude))
      const lnglat = [lng, lat]

      const el = document.createElement('div')
      const root = createRoot(el)

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '484px',
        offset: 12,
      }).setDOMContent(el).setLngLat(lnglat)

      root.render(
        <PopupCarousel
          initialGroup={group}
          onClose={() => popup.remove()}
          onDelete={async (toDelete) => {
            markersRef.current.forEach(({ popup: p }) => p.remove())
            await deletePhotos(toDelete)
          }}
        />
      )

      const marker = new mapboxgl.Marker({ color: '#000000' })
        .setLngLat(lnglat)
        .addTo(map)
      marker.getElement().style.cursor = 'pointer'

      markersRef.current.push({ key, marker, popup, root })
    }

    // Rebuild name→marker lookup and refresh click handlers
    const markerByName = new Map()
    for (const group of groups) {
      const key = groupKey(group)
      const entry = markersRef.current.find(m => m.key === key)
      if (!entry) continue
      for (const photo of group) markerByName.set(photo.name, entry)

      const el = entry.marker.getElement()
      if (entry._clickHandler) el.removeEventListener('click', entry._clickHandler)
      entry._clickHandler = (e) => {
        e.stopPropagation()
        setActiveGroup(group)
        flyToPhotoFn(group[0])
      }
      el.addEventListener('click', entry._clickHandler)
    }

    function flyToPhotoFn(photo) {
      const entry = markerByName.get(photo.name)
      if (!entry) return
      const { marker, popup } = entry

      markersRef.current.forEach(m => m.popup.remove())

      const lnglat = marker.getLngLat()
      const zoom = Math.max(map.getZoom(), 13)

      const sidebar = document.getElementById('sidebar')
      const sidebarRight = sidebar ? Math.ceil(sidebar.getBoundingClientRect().right) : 260

      map.jumpTo({ center: lnglat, zoom, padding: { left: sidebarRight, right: 0, top: 0, bottom: 0 } })
      popup.addTo(map)
      requestAnimationFrame(() => {
        const popupEl = popup.getElement()
        if (!popupEl) return
        map.panBy([0, -(popupEl.offsetHeight * 0.65)], { duration: 0 })
      })
    }

    setFlyToPhoto(flyToPhotoFn)
  }, [groups, mapReady])

  // Fit bounds once on initial load (closest 80% of catches by distance from centroid)
  useEffect(() => {
    if (!mapReady || groups.length === 0 || fitted) return
    const map = mapRef.current

    const points = groups.map(g => ({
      lng: avg(g.map(p => p.exif.longitude)),
      lat: avg(g.map(p => p.exif.latitude)),
    }))

    const cLng = avg(points.map(p => p.lng))
    const cLat = avg(points.map(p => p.lat))

    const count = Math.max(1, Math.ceil(points.length * 0.8))
    const subset = points
      .map(p => ({ ...p, d: (p.lng - cLng) ** 2 + (p.lat - cLat) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count)

    const lngs = subset.map(p => p.lng)
    const lats = subset.map(p => p.lat)
    const MILE = 0.008 // ~0.5 mile in degrees
    const bounds = new mapboxgl.LngLatBounds(
      [Math.min(...lngs) - MILE, Math.min(...lats) - MILE],
      [Math.max(...lngs) + MILE, Math.max(...lats) + MILE]
    )
    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 60, left: 320, right: 60 },
      maxZoom: 16,
      duration: 0,
    })
    setFitted(true)
  }, [groups, mapReady, fitted])

  return <div ref={containerRef} className={styles.map} />
}
