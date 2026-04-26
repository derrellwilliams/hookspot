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
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
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

    // Unmount old popup roots and remove markers
    markersRef.current.forEach(({ marker, popup, root }) => {
      popup.remove()
      root.unmount()
      marker.remove()
    })
    markersRef.current = []

    const markerByPhoto = new Map()

    for (const group of groups) {
      const lng = avg(group.map(p => p.exif.longitude))
      const lat = avg(group.map(p => p.exif.latitude))
      const lnglat = [lng, lat]

      // Create React root for popup content
      const el = document.createElement('div')
      const root = createRoot(el)
      root.render(
        <PopupCarousel
          initialGroup={group}
          onDelete={async (toDelete) => {
            markersRef.current.forEach(({ popup }) => popup.remove())
            await deletePhotos(toDelete)
          }}
        />
      )

      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '461px',
        offset: 12,
      }).setDOMContent(el).setLngLat(lnglat)

      const marker = new mapboxgl.Marker({ color: '#000000' })
        .setLngLat(lnglat)
        .addTo(map)

      marker.getElement().style.cursor = 'pointer'
      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation()
        setActiveGroup(group)
        flyToPhotoFn(group[0])
      })

      markersRef.current.push({ marker, popup, root })

      const groupIdx = markersRef.current.length - 1
      for (const photo of group) {
        markerByPhoto.set(photo, groupIdx)
      }
    }

    function flyToPhotoFn(photo) {
      const idx = markerByPhoto.get(photo)
      if (idx === undefined) return
      const { marker, popup } = markersRef.current[idx]

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
        map.panBy([0, -(popupEl.offsetHeight / 2)], { duration: 0 })
      })
    }

    setFlyToPhoto(flyToPhotoFn)
  }, [groups, mapReady])

  // Fit bounds once on initial load
  useEffect(() => {
    if (!mapReady || groups.length === 0 || fitted) return
    const map = mapRef.current
    const lngs = groups.flatMap(g => g.map(p => p.exif.longitude))
    const lats = groups.flatMap(g => g.map(p => p.exif.latitude))
    const bounds = new mapboxgl.LngLatBounds(
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
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
