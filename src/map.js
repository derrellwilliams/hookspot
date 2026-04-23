import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

const markers = []

export function initMap() {
  const map = L.map('map').setView([39.5, -111.1], 7)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)
  return map
}

// Returns flyToPhoto(photo) so callers don't need globals
export function rebuildMarkers(map, groups, onGroupSelect, onUpdate, onDelete) {
  markers.forEach(m => m.remove())
  markers.length = 0

  const markerByPhoto = new Map()
  const goToByPhoto = new Map()

  for (const group of groups) {
    const lat = avg(group.map(p => p.exif.latitude))
    const lng = avg(group.map(p => p.exif.longitude))

    const { el, goTo } = makePopup(group, onUpdate, onDelete)
    const marker = L.marker([lat, lng], { icon: makeIcon() }).addTo(map)
    marker.bindPopup(el, { maxWidth: 240, minWidth: 220 })
    marker.on('click', () => onGroupSelect(group))

    markers.push(marker)
    for (const photo of group) {
      markerByPhoto.set(photo, marker)
      goToByPhoto.set(photo, () => goTo(group.indexOf(photo)))
    }
  }

  return function flyToPhoto(photo) {
    const marker = markerByPhoto.get(photo)
    if (!marker) return

    goToByPhoto.get(photo)?.()

    // Already showing this popup — nothing to do
    if (marker.isPopupOpen()) return

    // Another popup is open — switch, pan if far from center, then vertically center popup
    if (map._popup?.isOpen()) {
      map.closePopup()
      const latlng = marker.getLatLng()
      const markerPt = map.latLngToContainerPoint(latlng)
      const size = map.getSize()
      const dx = Math.abs(markerPt.x - size.x / 2)
      const dy = Math.abs(markerPt.y - size.y / 2)
      const threshold = Math.min(size.x, size.y) * 0.3

      const openAndCenter = () => {
        marker.openPopup()
        requestAnimationFrame(() => {
          const popupEl = marker.getPopup()?.getElement()
          if (!popupEl) return
          const popupHeight = popupEl.offsetHeight
          const markerY = map.latLngToContainerPoint(latlng).y
          const targetY = map.getSize().y / 2 + popupHeight / 2 + 7
          const shift = Math.round(markerY - targetY)
          if (Math.abs(shift) > 5) map.panBy([0, shift], { animate: true, duration: 0.3 })
        })
      }

      if (dx > threshold || dy > threshold) {
        map.panTo(latlng, { animate: true, duration: 0.65 })
        map.once('moveend', openAndCenter)
      } else {
        openAndCenter()
      }
      return
    }

    const latlng = marker.getLatLng()
    const zoom = Math.max(map.getZoom(), 13)

    map.once('moveend', () => {
      marker.openPopup()

      requestAnimationFrame(() => {
        const popupEl = marker.getPopup()?.getElement()
        if (!popupEl) return

        const popupHeight = popupEl.offsetHeight
        const viewHeight = map.getSize().y
        const markerY = map.latLngToContainerPoint(latlng).y
        const tipOffset = 7
        const targetY = viewHeight / 2 + popupHeight / 2 + tipOffset
        const dy = Math.round(markerY - targetY)

        if (Math.abs(dy) > 5) map.panBy([0, dy], { animate: true, duration: 0.3 })
      })
    })

    map.flyTo(latlng, zoom, { duration: 0.8 })
  }
}

function makePopup(group, onUpdate, onDelete) {
  const el = document.createElement('div')
  el.className = 'popup-carousel'

  // Build persistent DOM — toggle visibility instead of replacing innerHTML
  const viewPanel = document.createElement('div')
  const editPanel = document.createElement('div')
  editPanel.className = 'popup-edit-form'
  editPanel.style.display = 'none'
  el.append(viewPanel, editPanel)

  let current = 0
  let editing = false

  function showView() {
    editing = false
    const photo = group[current]
    const hasMultiple = group.length > 1
    const date = photo.time
      ? new Date(photo.time).toLocaleString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : 'Unknown date'

    viewPanel.innerHTML = `
      <div class="popup-img-wrapper">
        <img class="popup-img" src="${photo.url}" alt="${photo.name}" />
        ${hasMultiple ? `
          <div class="popup-counter">${current + 1} / ${group.length}</div>
          <button class="popup-prev" ${current === 0 ? 'disabled' : ''}>&#8249;</button>
          <button class="popup-next" ${current === group.length - 1 ? 'disabled' : ''}>&#8250;</button>
        ` : ''}
      </div>
      <div class="popup-body">
        <div class="popup-title-row">
          <div class="popup-species">${photo.species && photo.species !== 'none' ? photo.species : '—'}</div>
          <button class="popup-edit-btn" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
        <div class="popup-detail">${date}</div>
        ${photo.meta?.rod ? `<div class="popup-detail"><strong>Rod:</strong> ${photo.meta.rod}</div>` : ''}
        ${photo.meta?.fly ? `<div class="popup-detail"><strong>Fly:</strong> ${photo.meta.fly}</div>` : ''}
      </div>
    `

    viewPanel.style.display = ''
    editPanel.style.display = 'none'

    if (hasMultiple) {
      viewPanel.querySelector('.popup-prev').addEventListener('click', (e) => {
        e.stopPropagation()
        if (current > 0) { current--; showView() }
      })
      viewPanel.querySelector('.popup-next').addEventListener('click', (e) => {
        e.stopPropagation()
        if (current < group.length - 1) { current++; showView() }
      })
    }

    viewPanel.querySelector('.popup-edit-btn').addEventListener('click', (e) => {
      e.stopPropagation()
      showEdit()
    })
  }

  function showEdit() {
    editing = true
    const photo = group[current]
    const m = photo.meta ?? {}

    editPanel.innerHTML = `
      <label>Species</label>
      <input class="edit-species" type="text" value="${photo.species ?? ''}" placeholder="e.g. Brown Trout" />
      <label>Rod</label>
      <input class="edit-rod" type="text" value="${m.rod ?? ''}" placeholder="e.g. 9ft 5wt" />
      <label>Fly</label>
      <input class="edit-fly" type="text" value="${m.fly ?? ''}" placeholder="e.g. Elk Hair Caddis #14" />
      <div class="edit-actions">
        <button class="edit-save">Save</button>
        <button class="edit-cancel">Cancel</button>
      </div>
      <button class="edit-delete">Delete photo</button>
    `

    viewPanel.style.display = 'none'
    editPanel.style.display = ''

    editPanel.querySelector('.edit-cancel').addEventListener('click', () => showView())

    editPanel.querySelector('.edit-delete').addEventListener('click', () => {
      const photo = group[current]
      fetch(`/images/${encodeURIComponent(photo.name)}`, { method: 'DELETE' }).catch(() => {})
      onDelete?.(photo)
    })

    editPanel.querySelector('.edit-save').addEventListener('click', async () => {
      const species = editPanel.querySelector('.edit-species').value.trim()
      const rod = editPanel.querySelector('.edit-rod').value.trim()
      const fly = editPanel.querySelector('.edit-fly').value.trim()

      if (species) photo.species = species
      photo.meta = { ...photo.meta, rod, fly, species: species || undefined }

      const { setMeta } = await import('./cache.js')
      await setMeta(photo.name, photo.meta)

      showView()
      onUpdate?.()
    })
  }

  showView()
  return {
    el,
    goTo(idx) { current = idx; editing ? showEdit() : showView() }
  }
}

function makeIcon() {
  return new L.Icon.Default()
}

export function fitToGroups(map, groups) {
  if (!groups.length) return
  const latlngs = groups.map(g => [avg(g.map(p => p.exif.latitude)), avg(g.map(p => p.exif.longitude))])
  map.fitBounds(latlngs, { padding: [40, 40] })
}

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
