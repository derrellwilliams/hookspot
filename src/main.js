import { initMap, rebuildMarkers, fitToGroups, closeAllPopups } from './map.js'
import { extractExif, toDisplayBlob } from './exif.js'
import { getCached, setCached, getMeta, setMeta } from './cache.js'
import { identifySpecies } from './identify.js'
import { renderStats } from './stats.js'
import imageList from 'virtual:images'

const fileInput = document.getElementById('file-input')
const photoList = document.getElementById('photo-list')
const noPhotos = document.getElementById('no-photos')
const dropOverlay = document.getElementById('drop-overlay')
const fabAdd = document.getElementById('fab-add')
const navDropdownBtn = document.getElementById('nav-dropdown-btn')
const navDropdownMenu = document.getElementById('nav-dropdown-menu')
const mainView = document.getElementById('main')
const statsView = document.getElementById('stats-view')
const map = initMap()

// ── Upload dialog ──────────────────────────────────────────────────────────────

const uploadDialog     = document.getElementById('upload-dialog')
const uploadBackdrop   = document.getElementById('upload-backdrop')
const uploadPreviewImg = document.getElementById('upload-preview-img')
const uploadFileCount  = document.getElementById('upload-file-count')

let pendingFiles = null
let previewBlobUrl = null

function showUploadStep(n) {
  document.getElementById('upload-step-1').classList.toggle('hidden', n !== 1)
  document.getElementById('upload-step-2').classList.toggle('hidden', n !== 2)
}

function openUploadDialog() {
  document.getElementById('upload-species').value = ''
  document.getElementById('upload-rod').value = ''
  document.getElementById('upload-fly').value = ''
  uploadPreviewImg.src = ''
  pendingFiles = null
  showUploadStep(1)
  uploadDialog.classList.remove('hidden')
}

function closeUploadDialog() {
  uploadDialog.classList.add('hidden')
  if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); previewBlobUrl = null }
  uploadPreviewImg.src = ''
  pendingFiles = null
  fileInput.value = ''
}

function showToast(msg) {
  const toast = document.getElementById('upload-toast')
  toast.textContent = msg
  toast.classList.remove('hidden')
  requestAnimationFrame(() => {
    toast.classList.add('show')
    setTimeout(() => {
      toast.classList.remove('show')
      setTimeout(() => toast.classList.add('hidden'), 200)
    }, 3000)
  })
}

async function goToStep2(files) {
  pendingFiles = files
  const first = files[0]
  if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl)
  previewBlobUrl = URL.createObjectURL(first)
  uploadPreviewImg.src = previewBlobUrl
  uploadFileCount.textContent = files.length > 1 ? `${files.length} photos` : ''
  uploadFileCount.style.display = files.length > 1 ? '' : 'none'
  const speciesInput = document.getElementById('upload-species')
  const identifyingEl = document.getElementById('upload-identifying')
  speciesInput.value = ''
  document.getElementById('upload-rod').value = ''
  document.getElementById('upload-fly').value = ''
  speciesInput.placeholder = 'Identifying…'
  speciesInput.disabled = true
  identifyingEl.classList.remove('hidden')
  showUploadStep(2)
  try {
    const blob = await toDisplayBlob(first)
    const species = await identifySpecies(blob)
    if (species) speciesInput.value = species
    speciesInput.placeholder = 'e.g. Brown Trout'
  } catch {
    speciesInput.placeholder = 'e.g. Brown Trout'
  } finally {
    identifyingEl.classList.add('hidden')
    speciesInput.disabled = false
    speciesInput.focus()
  }
}

document.getElementById('upload-close-btn').addEventListener('click', closeUploadDialog)
document.getElementById('upload-cancel-btn').addEventListener('click', closeUploadDialog)
uploadBackdrop.addEventListener('click', closeUploadDialog)

document.getElementById('upload-browse-btn').addEventListener('click', () => fileInput.click())

const dialogDropZone = document.getElementById('upload-drop-zone')
dialogDropZone.addEventListener('dragover', e => e.preventDefault())
dialogDropZone.addEventListener('dragenter', e => { e.preventDefault(); dialogDropZone.classList.add('drag-over') })
dialogDropZone.addEventListener('dragleave', () => dialogDropZone.classList.remove('drag-over'))
dialogDropZone.addEventListener('drop', e => {
  e.preventDefault()
  dialogDropZone.classList.remove('drag-over')
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
  if (files.length) goToStep2(files)
})

document.getElementById('upload-submit-btn').addEventListener('click', async () => {
  const species = document.getElementById('upload-species').value.trim()
  const rod     = document.getElementById('upload-rod').value.trim()
  const fly     = document.getElementById('upload-fly').value.trim()
  const files   = pendingFiles
  closeUploadDialog()
  await handleFiles(files, { species, rod, fly })
  showToast('Catch added!')
})

// ── Nav dropdown + view switching ─────────────────────────────────────────────

fabAdd.addEventListener('click', openUploadDialog)

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
  if (files.length) goToStep2(files)
})

const navDropdownWrap = document.getElementById('nav-dropdown-wrap')

navDropdownBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  navDropdownWrap.classList.toggle('open')
  navDropdownMenu.classList.toggle('open')
})

document.addEventListener('click', () => {
  navDropdownWrap.classList.remove('open')
  navDropdownMenu.classList.remove('open')
})

navDropdownMenu.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-option')
  if (!btn) return
  const view = btn.dataset.view
  document.querySelectorAll('.nav-option').forEach(el => el.classList.toggle('active', el.dataset.view === view))
  mainView.style.display = view === 'map' ? 'flex' : 'none'
  statsView.style.display = view === 'stats' ? 'block' : 'none'
  if (view === 'stats') renderStats(currentGroups)
  navDropdownWrap.classList.remove('open')
  navDropdownMenu.classList.remove('open')
})

export const photos = []

function esc(str) {
  const d = document.createElement('div')
  d.textContent = str ?? ''
  return d.innerHTML
}

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

async function handleFiles(fileList, meta = {}) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'))
  if (!files.length) return
  for (const file of files) {
    if (photos.find(p => p.name === file.name)) continue
    await loadPhoto(file.name, file, meta)
    refresh()
    fetch(`/images/${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'x-filename': file.name },
      body: file,
    }).catch(() => {})
  }
}

async function loadPhoto(filename, file, uploadMeta = {}) {
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

  // Default meta: use upload meta, then seed, then fallback rod
  const defaultRod = uploadMeta.rod || (metaSeed[filename]?.rod ?? Object.values(metaSeed)[0]?.rod)
  const mergedMeta = { rod: defaultRod, ...uploadMeta }
  const photo = { ...entry, url: URL.createObjectURL(blob), meta: mergedMeta }
  if (uploadMeta.species) photo.species = uploadMeta.species
  else applySpecies(photo)
  if (Object.keys(mergedMeta).some(k => mergedMeta[k])) await setMeta(filename, mergedMeta)
  photos.push(photo)

  // If no species from species.json or upload, ask Claude
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

  // Add button card
  const addCard = document.createElement('div')
  addCard.className = 'photo-item photo-item-add'
  addCard.innerHTML = `<span class="photo-item-add-icon">+</span><span class="photo-item-add-label">Add a catch</span>`
  addCard.addEventListener('click', openUploadDialog)
  photoList.appendChild(addCard)

  // Sort groups newest-first by the first photo in each group
  const sorted = [...currentGroups].sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0))

  for (const group of sorted) {
    const lead = group.find(p => p.species) ?? group[0]
    const item = document.createElement('div')
    item.className = 'photo-item'
    item.dataset.name = lead.name

    item.innerHTML = `
      <div class="photo-thumb-wrap">
        <img class="photo-thumb" src="${lead.url}" alt="${esc(lead.name)}" loading="lazy" />
      </div>
      <div class="photo-meta">
        ${lead.species && lead.species !== 'none' ? `<div class="photo-species">${esc(lead.species.replace(/\s*\(.*?\)/g, '').trim())}</div>` : ''}
        ${lead.time ? `<div class="photo-date"><span class="photo-date-mono">${formatDay(lead.time)} ${formatTime(lead.time)}</span></div>` : '<div class="photo-date">No date</div>'}
        ${lead.meta?.fly ? `<div class="photo-gear">${esc(lead.meta.fly)}</div>` : ''}
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
  closeAllPopups()
  if (photo.url?.startsWith('blob:')) URL.revokeObjectURL(photo.url)
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
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  })
}
