import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = 'pk.eyJ1IjoiZGVycmVsbHdpbGxpYW1zIiwiYSI6IkhWNGhGd00ifQ.lTp8_tfHS5K866hGOkkhaw'

const allMarkers = []
let allPopups = []

export function initMap() {
  mapboxgl.accessToken = MAPBOX_TOKEN
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/derrellwilliams/cmoc96j0y000i01r90nqr62du',
    center: [-111.1, 39.5],
    zoom: 7,
  })
  map.addControl(new mapboxgl.NavigationControl(), 'top-right')
  map.on('click', () => allPopups.forEach(p => p.remove()))
  return map
}

export function rebuildMarkers(map, groups, onGroupSelect, onUpdate, onDelete) {
  allMarkers.forEach(m => m.remove())
  allMarkers.length = 0
  allPopups.forEach(p => p.remove())
  allPopups = []

  const markerByPhoto = new Map()
  const goToByPhoto = new Map()

  for (const group of groups) {
    const lng = avg(group.map(p => p.exif.longitude))
    const lat = avg(group.map(p => p.exif.latitude))
    const lnglat = [lng, lat]

    const { el, goTo } = makePopup(group, onUpdate, onDelete)

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
    marker.getElement().addEventListener('click', () => {
      onGroupSelect(group)
      flyToPhoto(group[0])
    })

    allMarkers.push(marker)
    allPopups.push(popup)

    for (const photo of group) {
      markerByPhoto.set(photo, { marker, popup })
      goToByPhoto.set(photo, () => goTo(group.indexOf(photo)))
    }
  }

  function flyToPhoto(photo) {
    const entry = markerByPhoto.get(photo)
    if (!entry) return
    const { marker, popup } = entry

    goToByPhoto.get(photo)?.()

    if (popup.isOpen()) return

    allPopups.forEach(p => p.remove())

    const lnglat = marker.getLngLat()
    const zoom = Math.max(map.getZoom(), 13)

    map.flyTo({ center: lnglat, zoom, duration: 600, essential: true })
    map.once('moveend', () => {
      popup.addTo(map)
      requestAnimationFrame(() => {
        const popupEl = popup.getElement()
        if (!popupEl) return
        map.panBy([0, -(popupEl.offsetHeight / 2)], { duration: 200 })
      })
    })
  }

  return flyToPhoto
}

export function fitToGroups(map, groups) {
  if (!groups.length) return
  const lngs = groups.flatMap(g => g.map(p => p.exif.longitude))
  const lats = groups.flatMap(g => g.map(p => p.exif.latitude))
  const bounds = new mapboxgl.LngLatBounds(
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  )
  const doFit = () => map.fitBounds(bounds, {
    padding: { top: 80, bottom: 60, left: 320, right: 60 },
    maxZoom: 16,
    duration: 0,
  })
  if (map.loaded()) doFit()
  else map.once('load', doFit)
}

function makePopup(group, onUpdate, onDelete) {
  const el = document.createElement('div')
  el.className = 'popup-carousel'

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
    const d = photo.time ? new Date(photo.time) : null
    const dateStr = d ? `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}` : null
    const timeStr = d ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null

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
        ${dateStr ? `<div class="popup-detail popup-mono">${dateStr} ${timeStr}</div>` : '<div class="popup-detail">Unknown date</div>'}
        ${photo.meta?.rod ? `<div class="popup-detail popup-mono">${photo.meta.rod}</div>` : ''}
        ${photo.meta?.fly ? `<div class="popup-detail popup-mono">${photo.meta.fly}</div>` : ''}
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

export function fitToGroupsOnLoad(map, groups) {
  fitToGroups(map, groups)
}

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
