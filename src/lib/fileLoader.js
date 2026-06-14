import { extractExif, toDisplayBlob, resizeForStorage } from '../exif.js'
import { getCached, setCached } from '../cache.js'
import { identifySpecies } from '../identify.js'
import { fetchWeather } from './weather.js'
import { reverseGeocode } from './geocode.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { supabase } from '../lib/supabase.js'
import { parseExifDate } from './formatters.js'

function getUser() {
  return useAuthStore.getState().user
}

// Supabase Storage rejects spaces and special chars in object keys.
// Also normalize HEIC/HEIF → jpg since we always store JPEG content.
function storageKey(filename) {
  return filename.replace(/[^\w.\-]/g, '_').replace(/\.(heic|heif)$/i, '.jpg')
}

function buildPhoto(blob, exif, row, ownerProfile, currentUserId) {
  const time = row.time ? new Date(row.time).getTime() : null
  const hasGps = row.lat != null && row.lng != null
  // Always ensure latitude/longitude are set when the DB has GPS coords.
  // Using ?? alone isn't enough — exif may be a non-null object without GPS fields.
  const effectiveExif = hasGps
    ? { ...exif, latitude: exif?.latitude ?? row.lat, longitude: exif?.longitude ?? row.lng }
    : exif ?? null
  return {
    id: row.id ?? null,
    name: row.filename,
    storagePath: row.storage_path ?? null,
    userId: row.user_id,
    catchId: row.catch_id ?? null,
    isOwn: row.user_id === currentUserId,
    ownerProfile: ownerProfile ?? null,
    blob,
    exif: effectiveExif,
    hasGps,
    time,
    url: URL.createObjectURL(blob),
    meta: row.meta || {},
    species: row.species || undefined,
  }
}

async function withConcurrency(fns, limit) {
  const queue = [...fns]
  await Promise.all(Array.from({ length: Math.min(limit, fns.length) }, async () => {
    while (queue.length) await queue.shift()()
  }))
}

function makeSemaphore(limit) {
  let active = 0
  const pending = []
  function run(fn) {
    active++
    Promise.resolve().then(fn).finally(() => { active--; if (pending.length) run(pending.shift()) })
  }
  return fn => { if (active < limit) run(fn); else pending.push(fn) }
}
const runGeoTask = makeSemaphore(3)

async function saveMeta(photoName, key, value, userId) {
  const current = usePhotoStore.getState().photos.find(p => p.name === photoName && p.userId === userId)
  if (!current) return
  const meta = { ...current.meta, [key]: value }
  const { error } = await supabase.from('photos').update({ meta }).eq('filename', photoName).eq('user_id', userId)
  if (!error) usePhotoStore.getState().updatePhoto({ ...current, meta })
}

function maybeFetchLocation(photo) {
  if (!photo.isOwn) return
  const user = getUser()
  if (!photo.hasGps || photo.exif?.latitude == null || photo.exif?.longitude == null || photo.meta?.location || !user) return
  runGeoTask(() => reverseGeocode(photo.exif.latitude, photo.exif.longitude)
    .then(loc => loc && saveMeta(photo.name, 'location', loc, user.id))
    .catch(() => {}))
}

function maybeFetchWeather(photo) {
  if (!photo.isOwn) return
  const user = getUser()
  if (!photo.hasGps || !photo.time || photo.exif?.latitude == null || photo.exif?.longitude == null || photo.meta?.weather || !user) return
  runGeoTask(() => fetchWeather(photo.exif.latitude, photo.exif.longitude, photo.time)
    .then(weather => weather && saveMeta(photo.name, 'weather', weather, user.id))
    .catch(() => {}))
}

let _initInProgress = false
let _initQueued = false
const _failedKeys = new Set()
const _uploadingNames = new Set()

export function clearUploadingNames() {
  _uploadingNames.clear()
}

export async function initPhotos() {
  if (_initInProgress) {
    _initQueued = true
    return
  }
  _initInProgress = true
  _initQueued = false
  let fetchAttempted = false
  try {
    const user = getUser()
    if (!user) return

    fetchAttempted = true
    const res = await fetch(`/api/photos?userId=${user.id}`)
    if (!res.ok) throw new Error(`Photos fetch error: ${res.status}`)
    const { rows, profiles: profileRows, error } = await res.json()

    if (error || !rows?.length) return

    const profileMap = Object.fromEntries((profileRows ?? []).map(p => [p.id, p]))
    const existing = new Set(usePhotoStore.getState().photos.map(p => `${p.userId}/${p.name}`))

    const toLoad = rows.filter(row => !existing.has(`${row.user_id}/${row.filename}`))
    const pending = []
    const flush = () => {
      if (!pending.length) return
      const batch = pending.splice(0)
      usePhotoStore.getState().batchAddPhotos(batch)
      batch.forEach(photo => { maybeFetchWeather(photo); maybeFetchLocation(photo) })
    }
    const makeLoader = row => () =>
      loadPhotoFromRow(row, profileMap[row.user_id] ?? null, user.id)
        .then(photo => { if (photo) { pending.push(photo); if (pending.length >= 4) flush() } })
        .catch(e => console.error('[hookspot] failed to load', row.filename, e))

    // Load the 15 most recent first so the sidebar becomes interactive quickly,
    // then continue with the rest in the background. Cap at 3 concurrent to avoid
    // stacking too many canvas decodes on low-memory iOS devices.
    await withConcurrency(toLoad.slice(0, 15).map(makeLoader), 3)
    flush()
    usePhotoStore.getState().setPhotosInitialized()

    await withConcurrency(toLoad.slice(15).map(makeLoader), 3)
    flush()
  } finally {
    if (fetchAttempted) usePhotoStore.getState().setPhotosInitialized()
    _initInProgress = false
    if (_initQueued) {
      _initQueued = false
      await initPhotos()
    }
  }
}

async function loadPhotoFromRow(row, ownerProfile, currentUserId) {
  const cacheKey = `${row.user_id}/${row.filename}`
  if (_failedKeys.has(cacheKey)) return null
  const cached = await getCached(cacheKey)
  if (cached) return buildPhoto(cached.blob, cached.exif, row, ownerProfile, currentUserId)

  let res = await fetch(row.url)
  if (!res.ok && res.status < 500 && /\.(heic|heif)$/i.test(row.url)) {
    res = await fetch(row.url.replace(/\.(heic|heif)$/i, '.jpg'))
  }
  if (!res.ok) { _failedKeys.add(cacheKey); return null }
  const rawBlob = await res.blob()
  const file = new File([rawBlob], row.filename, { type: rawBlob.type || 'image/heic' })

  const [blob, exif] = await Promise.all([toDisplayBlob(file), extractExif(file)])
  await setCached(cacheKey, { blob, exif })

  return buildPhoto(blob, exif, row, ownerProfile, currentUserId)
}

export async function handleFiles(fileList, meta = {}, displayBlobs = []) {
  const user = getUser()
  if (!user) return { added: 0, failed: 0 }

  const existingNames = new Set(
    usePhotoStore.getState().photos.filter(p => p.isOwn).map(p => p.name)
  )
  const files = Array.from(fileList)
  if (!files.length) return { added: 0, failed: 0 }

  const queue = []
  let order = 0
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) continue
    if (existingNames.has(file.name) || _uploadingNames.has(file.name)) continue
    _uploadingNames.add(file.name)
    queue.push({ file, taskMeta: { ...meta, order: order++ }, displayBlob: displayBlobs[i] })
  }

  // Process one at a time — canvas resize + storage upload for a single 12MP photo
  // can peak at ~60MB; running them in parallel on iOS causes memory crashes.
  let added = 0, failed = 0
  for (const { file, taskMeta, displayBlob } of queue) {
    const ok = await uploadPhoto(file, user, taskMeta, displayBlob)
      .catch(() => false)
      .finally(() => _uploadingNames.delete(file.name))
    if (ok) added++; else failed++
  }
  return { added, failed }
}

async function uploadPhoto(file, user, uploadMeta, displayBlob) {
  const storagePath = `${user.id}/${storageKey(file.name)}`

  const [blob, exif] = await Promise.all([
    displayBlob ? Promise.resolve(displayBlob) : toDisplayBlob(file),
    extractExif(file),
  ])
  // Resize from the original file so storage quality stays at STORAGE_MAX_PX (2048px)
  // regardless of how toDisplayBlob resized the preview. Falls back to display blob
  // if the original can't be decoded (e.g. HEIC on non-native browsers).
  const storageBlob = await resizeForStorage(file).catch(() => resizeForStorage(blob).catch(() => blob))

  const { error: uploadError } = await supabase.storage
    .from('catches')
    .upload(storagePath, storageBlob, { upsert: false, contentType: 'image/jpeg' })
  if (uploadError) { console.error('[hookspot] storage upload failed', uploadError); return false }

  const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(storagePath)

  const exifTime = exif?.DateTimeOriginal instanceof Date
    ? exif.DateTimeOriginal.getTime()
    : parseExifDate(exif?.DateTimeOriginal)
  // Always fall back to upload time so catches sort to the top of recent activity
  const time = exifTime ?? Date.now()

  const { catchId: _catchId, manualLat: _mlat, manualLng: _mlng, ...storedMeta } = uploadMeta
  const row = {
    user_id: user.id,
    catch_id: uploadMeta.catchId ?? null,
    filename: file.name,
    storage_path: storagePath,
    url: publicUrl,
    species: uploadMeta.species || null,
    lat: exif?.latitude ?? uploadMeta.manualLat ?? null,
    lng: exif?.longitude ?? uploadMeta.manualLng ?? null,
    time: time ? new Date(time).toISOString() : null,
    meta: storedMeta,
  }

  const { data: insertedRow, error: dbError } = await supabase.from('photos').insert(row).select('id').single()
  if (dbError) {
    await supabase.storage.from('catches').remove([storagePath])
    console.error('[hookspot] db insert failed', dbError)
    return false
  }
  row.id = insertedRow?.id ?? null

  await setCached(`${user.id}/${file.name}`, { blob, exif })

  const photo = buildPhoto(blob, exif, row, null, user.id)
  if (uploadMeta.species) photo.species = uploadMeta.species
  usePhotoStore.getState().addPhoto(photo)
  maybeFetchWeather(photo)
  maybeFetchLocation(photo)

  if (!photo.species && !uploadMeta.identified) {
    const species = await identifySpecies(blob)
    if (species && species !== 'none') {
      await supabase.from('photos').update({ species }).eq('filename', file.name).eq('user_id', user.id)
      const current = usePhotoStore.getState().photos.find(p => p.name === file.name && p.userId === user.id)
      if (current) usePhotoStore.getState().updatePhoto({ ...current, species, meta: { ...current.meta, species } })
    }
  }
  return true
}

export async function uploadPhotoToGroup(file, groupLead) {
  // Use getUser() (server-verified) so user_id exactly matches auth.uid() in RLS
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Not signed in')

  const storagePath = `${user.id}/${storageKey(file.name)}`

  const [blob, exif] = await Promise.all([toDisplayBlob(file), extractExif(file)])
  const storageBlob = await resizeForStorage(blob).catch(() => blob)

  const { error: uploadError } = await supabase.storage
    .from('catches')
    .upload(storagePath, storageBlob, { upsert: false, contentType: 'image/jpeg' })
  if (uploadError && uploadError.statusCode !== '409') throw new Error('Storage: ' + uploadError.message)

  const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(storagePath)

  const row = {
    user_id: user.id,
    catch_id: groupLead.catchId ?? null,
    filename: file.name,
    storage_path: storagePath,
    url: publicUrl,
    species: null,
    lat: groupLead.exif?.latitude ?? null,
    lng: groupLead.exif?.longitude ?? null,
    time: groupLead.time ? new Date(groupLead.time).toISOString() : null,
    meta: {},
  }

  const { data: insertedRow, error: dbError } = await supabase.from('photos').insert(row).select('id').single()
  if (dbError) {
    await supabase.storage.from('catches').remove([storagePath])
    throw new Error('DB: ' + dbError.message)
  }
  row.id = insertedRow?.id ?? null

  await setCached(`${user.id}/${file.name}`, { blob, exif })
  const photo = buildPhoto(blob, exif, row, null, user.id)
  usePhotoStore.getState().addPhoto(photo)
  maybeFetchLocation(photo)
  return photo
}

export async function deletePhotos(toDelete) {
  const user = getUser()
  if (!user) return

  const list = Array.isArray(toDelete) ? toDelete : [toDelete]
  const paths = list.map(p => p.storagePath ?? `${user.id}/${storageKey(p.name)}`)
  const filenames = list.map(p => p.name)

  const withId = list.filter(p => p.id)
  const withoutId = list.filter(p => !p.id)
  let dbError
  if (withId.length) {
    const { error } = await supabase.from('photos').delete().in('id', withId.map(p => p.id))
    if (error) dbError = error
  }
  if (withoutId.length) {
    const { error } = await supabase.from('photos').delete().in('filename', withoutId.map(p => p.name)).eq('user_id', user.id)
    if (error) dbError = error
  }
  if (dbError) { console.error('[hookspot] db delete failed', dbError); return }

  const { error: storageError } = await supabase.storage.from('catches').remove(paths)
  if (storageError) console.error('[hookspot] storage delete failed', storageError)

  await Promise.all(list.map(p => setCached(`${user.id}/${p.name}`, undefined)))
  usePhotoStore.getState().removePhotos(list)
}
