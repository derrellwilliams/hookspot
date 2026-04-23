import { initMap, rebuildMarkers, fitToGroups } from './map.js'
import { extractExif, toDisplayBlob } from './exif.js'
import { getCached, setCached, getMeta, setMeta } from './cache.js'
import { identifySpecies } from './identify.js'
import imageList from 'virtual:images'

const fileInput = document.getElementById('file-input')
const photoList = document.getElementById('photo-list')
const noPhotos = document.getElementById('no-photos')
const dropOverlay = document.getElementById('drop-overlay')
const map = initMap()

export const photos = []

// Species + metadata seeds — loaded once, applied to photos whenever either is ready
let speciesData = {}
let metaSeed = {}

fetch('/metadata.json')
  .then(r => r.ok ? r.json() : {})
  .then(d => { metaSeed = d })
  .catch(() => {})

function applySpecies(photo) {
  const s = photo.meta?.species || speciesData[photo.name]
  if (s && s !== 'none') photo.species = s
}

fetch('/species.json')
  .then(r => r.ok ? r.json() : {})
  .then(d => {
    speciesData = d
    photos.forEach(applySpecies)
    if (photos.length) refresh()
  })
  .catch(() => {})

// ── Auto-load images from /images folder ──────────────────────────────────────

async function loadFolderImages() {
  if (!imageList.length) return

  for (const filename of imageList) {
    try {
      await loadPhoto(filename)
      refresh()
    } catch (e) {
      console.error('[fishmap] failed to load', filename, e)
    }
  }
}

loadFolderImages().then(() => fitToGroups(map, currentGroups))

// ── File handling ─────────────────────────────────────────────────────────────

fileInput.addEventListener('change', async (e) => {
  await handleFiles(e.target.files)
  fileInput.value = ''
})

async function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'))
  if (!files.length) return
  for (const file of files) {
    if (photos.find(p => p.name === file.name)) continue
    await loadPhoto(file.name, file)
    refresh()
    // Save to images/ folder so it persists on reload
    fetch(`/images/${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'x-filename': file.name },
      body: file,
    }).catch(() => {})
  }
}

async function loadPhoto(filename, file) {
  // Return early if already loaded this session
  if (photos.find(p => p.name === filename)) return

  // Check IndexedDB cache
  const [cached, meta] = await Promise.all([getCached(filename), getMeta(filename)])
  if (cached) {
    const photo = { ...cached, url: URL.createObjectURL(cached.blob), meta: { ...metaSeed[filename], ...meta } }
    applySpecies(photo)
    photos.push(photo)
    return
  }

  // Fetch if not a File object already (i.e. loading from folder)
  if (!file) {
    const res = await fetch(`/images/${encodeURIComponent(filename)}`)
    if (!res.ok) return
    const blob = await res.blob()
    file = new File([blob], filename, { type: blob.type || 'image/heic' })
  }

  const [blob, exif] = await Promise.all([toDisplayBlob(file), extractExif(file)])
  const time = exif?.DateTimeOriginal instanceof Date
    ? exif.DateTimeOriginal.getTime()
    : parseExifDate(exif?.DateTimeOriginal)

  const entry = { name: filename, blob, exif, hasGps: !!(exif?.latitude && exif?.longitude), time }
  await setCached(filename, entry)

  // Default meta: use seed for this file, or fall back to the rod from any seed entry
  const defaultRod = metaSeed[filename]?.rod ?? Object.values(metaSeed)[0]?.rod
  const photo = { ...entry, url: URL.createObjectURL(blob), meta: { rod: defaultRod } }
  applySpecies(photo)
  photos.push(photo)

  // If no species from species.json, ask Claude
  if (!photo.species) {
    const species = await identifySpecies(blob)
    if (species && species !== 'none') {
      photo.species = species
      photo.meta = { ...photo.meta, species }
      await setMeta(filename, photo.meta)
      refresh()
    }
  }
}

// ── Refresh after any photo change ────────────────────────────────────────────

let flyToPhoto = () => {}
let currentGroups = []

function refresh() {
  currentGroups = groupByTime(photos.filter(p => p.hasGps))
  flyToPhoto = rebuildMarkers(map, currentGroups, selectGroup, renderPhotoList, deletePhoto)
  renderPhotoList()
}

// ── Group photos within 3 minutes of each other ───────────────────────────────

function groupByTime(gpsPhotos) {
  if (!gpsPhotos.length) return []
  const sorted = [...gpsPhotos].sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
  const groups = []

  for (const photo of sorted) {
    const last = groups[groups.length - 1]
    const lastTime = last?.[last.length - 1]?.time ?? null
    if (last && lastTime !== null && photo.time !== null && photo.time - lastTime <= 3 * 60 * 1000) {
      last.push(photo)
    } else {
      groups.push([photo])
    }
  }

  return groups
}

// ── Sidebar list ──────────────────────────────────────────────────────────────

function renderPhotoList() {
  noPhotos.classList.toggle('hidden', photos.length > 0)
  photoList.innerHTML = ''

  // Sort groups newest-first by the first photo in each group
  const sorted = [...currentGroups].sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0))

  for (const group of sorted) {
    const lead = group.find(p => p.species) ?? group[0]
    const item = document.createElement('div')
    item.className = 'photo-item'
    item.dataset.name = lead.name

    item.innerHTML = `
      <div class="photo-thumb-wrap">
        <img class="photo-thumb" src="${lead.url}" alt="${lead.name}" loading="lazy" />
      </div>
      <div class="photo-meta">
        ${lead.species && lead.species !== 'none' ? `<div class="photo-species">${lead.species.replace(/\s*\(.*?\)/g, '').trim()}</div>` : ''}
        ${lead.time ? `<div class="photo-date">${formatDay(lead.time)} &middot; ${formatTime(lead.time)}</div>` : '<div class="photo-date">No date</div>'}
        ${lead.meta?.rod ? `<div class="photo-gear">${lead.meta.rod}</div>` : ''}
        ${lead.meta?.fly ? `<div class="photo-gear">${lead.meta.fly}</div>` : ''}
      </div>
    `

    item.addEventListener('click', () => {
      document.querySelectorAll('.photo-item').forEach(el => el.classList.remove('active'))
      item.classList.add('active')
      flyToPhoto(group[0])
    })

    photoList.appendChild(item)
  }
}

async function deletePhoto(photo) {
  map.closePopup()
  photos.splice(photos.indexOf(photo), 1)
  await Promise.all([setCached(photo.name, undefined), setMeta(photo.name, undefined)])
  refresh()
}

function selectGroup(group) {
  // Highlight the first photo in group in sidebar
  const first = group[0]
  document.querySelectorAll('.photo-item').forEach(el => el.classList.remove('active'))
  const item = photoList.querySelector(`[data-name="${CSS.escape(first.name)}"]`)
  if (item) {
    item.classList.add('active')
    item.scrollIntoView({ block: 'nearest' })
  }
}

// ── Drag and drop ─────────────────────────────────────────────────────────────

let dragCount = 0

document.addEventListener('dragenter', (e) => {
  if (e.dataTransfer?.types.includes('Files')) {
    dragCount++
    dropOverlay.classList.add('active')
  }
})

document.addEventListener('dragleave', () => {
  if (--dragCount <= 0) {
    dragCount = 0
    dropOverlay.classList.remove('active')
  }
})

document.addEventListener('dragover', (e) => e.preventDefault())

document.addEventListener('drop', async (e) => {
  e.preventDefault()
  dragCount = 0
  dropOverlay.classList.remove('active')
  if (e.dataTransfer?.files) await handleFiles(e.dataTransfer.files)
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseExifDate(dt) {
  if (!dt) return null
  const str = String(dt).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
  const d = new Date(str)
  return isNaN(d) ? null : d.getTime()
}

function formatDay(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  })
}
