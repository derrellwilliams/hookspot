import { extractExif, toDisplayBlob, resizeForStorage, resizeForThumbnail } from '../exif.js'
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
  const hasGps = !!(row.lat && row.lng)
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
    supabaseUrl: row.url ?? null,
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
  if (!photo.hasGps || !photo.exif?.latitude || !photo.exif?.longitude || photo.meta?.location || !user) return
  runGeoTask(() => reverseGeocode(photo.exif.latitude, photo.exif.longitude)
    .then(loc => loc && saveMeta(photo.name, 'location', loc, user.id))
    .catch(() => {}))
}

function maybeFetchWeather(photo) {
  if (!photo.isOwn) return
  const user = getUser()
  if (!photo.hasGps || !photo.time || !photo.exif?.latitude || !photo.exif?.longitude || photo.meta?.weather || !user) return
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
    // then continue with the rest in the background.
    await withConcurrency(toLoad.slice(0, 15).map(makeLoader), 8)
    flush()
    usePhotoStore.getState().setPhotosInitialized()

    await withConcurrency(toLoad.slice(15).map(makeLoader), 8)
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
  // Use thumb-prefixed cache key so old full-res entries are naturally evicted
  const cacheKey = `thumbs/${row.user_id}/${row.filename}`
  if (_failedKeys.has(cacheKey)) return null
  const cached = await getCached(cacheKey)
  if (cached) return buildPhoto(cached.blob, cached.exif, row, ownerProfile, currentUserId)

  // Prefer thumbnail URL; fall back to full-res for photos uploaded before thumbnails were added
  const fetchUrl = row.thumb_url || row.url
  let res = await fetch(fetchUrl)
  if (!res.ok && res.status < 500 && /\.(heic|heif)$/i.test(fetchUrl)) {
    res = await fetch(fetchUrl.replace(/\.(heic|heif)$/i, '.jpg'))
  }
  if (!res.ok) { _failedKeys.add(cacheKey); return null }
  const rawBlob = await res.blob()
  const file = new File([rawBlob], row.filename, { type: rawBlob.type || 'image/jpeg' })

  // Skip EXIF extraction for thumbnails — they're canvas-resized JPEGs with no EXIF;
  // all geodata comes from the DB row (lat/lng/time).
  const [blob, exif] = await Promise.all([
    toDisplayBlob(file),
    row.thumb_url ? Promise.resolve(null) : extractExif(file),
  ])
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

  const uploads = []
  let order = 0
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) continue
    if (existingNames.has(file.name) || _uploadingNames.has(file.name)) continue
    _uploadingNames.add(file.name)
    uploads.push(
      uploadPhoto(file, user, { ...meta, order: order++ }, displayBlobs[i])
        .catch(() => false)
        .finally(() => _uploadingNames.delete(file.name))
    )
  }
  const results = await Promise.all(uploads)
  return {
    added: results.filter(r => r === true).length,
    failed: results.filter(r => r === false).length,
  }
}

async function uploadPhoto(file, user, uploadMeta, displayBlob) {
  const storagePath = `${user.id}/${storageKey(file.name)}`

  const [blob, exif] = await Promise.all([
    displayBlob ? Promise.resolve(displayBlob) : toDisplayBlob(file),
    extractExif(file),
  ])
  const [storageBlob, thumbBlob] = await Promise.all([
    resizeForStorage(blob).catch(() => blob),
    resizeForThumbnail(blob).catch(() => blob),
  ])

  const { error: uploadError } = await supabase.storage
    .from('catches')
    .upload(storagePath, storageBlob, { upsert: false, contentType: 'image/jpeg' })
  if (uploadError) { console.error('[hookspot] storage upload failed', uploadError); return false }

  const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(storagePath)

  // Thumbnail is best-effort — failure must never block the catch from saving
  let thumbUrl = null
  try {
    const thumbPath = `${user.id}/thumbs/${storageKey(file.name)}`
    const { error: thumbError } = await supabase.storage
      .from('catches')
      .upload(thumbPath, thumbBlob, { upsert: false, contentType: 'image/jpeg' })
    if (!thumbError) {
      thumbUrl = supabase.storage.from('catches').getPublicUrl(thumbPath).data.publicUrl
    }
  } catch { /* thumbnail is optional */ }

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
    ...(thumbUrl !== null && { thumb_url: thumbUrl }),
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

  await setCached(`thumbs/${user.id}/${file.name}`, { blob: thumbBlob, exif })

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
  const [storageBlob, thumbBlob] = await Promise.all([
    resizeForStorage(blob).catch(() => blob),
    resizeForThumbnail(blob).catch(() => blob),
  ])

  const { error: uploadError } = await supabase.storage
    .from('catches')
    .upload(storagePath, storageBlob, { upsert: false, contentType: 'image/jpeg' })
  if (uploadError && uploadError.statusCode !== '409') throw new Error('Storage: ' + uploadError.message)

  const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(storagePath)

  // Thumbnail is best-effort — failure must never block the catch from saving
  let thumbUrl = null
  let thumbPath = null
  try {
    thumbPath = `${user.id}/thumbs/${storageKey(file.name)}`
    const { error: thumbError } = await supabase.storage
      .from('catches')
      .upload(thumbPath, thumbBlob, { upsert: false, contentType: 'image/jpeg' })
    if (!thumbError) {
      thumbUrl = supabase.storage.from('catches').getPublicUrl(thumbPath).data.publicUrl
    }
  } catch { /* thumbnail is optional */ }

  const row = {
    user_id: user.id,
    catch_id: groupLead.catchId ?? null,
    filename: file.name,
    storage_path: storagePath,
    url: publicUrl,
    ...(thumbUrl !== null && { thumb_url: thumbUrl }),
    species: null,
    lat: groupLead.exif?.latitude ?? null,
    lng: groupLead.exif?.longitude ?? null,
    time: groupLead.time ? new Date(groupLead.time).toISOString() : null,
    meta: {},
  }

  const { data: insertedRow, error: dbError } = await supabase.from('photos').insert(row).select('id').single()
  if (dbError) {
    const toRemove = thumbPath ? [storagePath, thumbPath] : [storagePath]
    await supabase.storage.from('catches').remove(toRemove)
    throw new Error('DB: ' + dbError.message)
  }
  row.id = insertedRow?.id ?? null

  await setCached(`thumbs/${user.id}/${file.name}`, { blob: thumbBlob, exif })
  const photo = buildPhoto(blob, exif, row, null, user.id)
  usePhotoStore.getState().addPhoto(photo)
  maybeFetchLocation(photo)
  return photo
}

export async function deletePhotos(toDelete) {
  const user = getUser()
  if (!user) return

  const list = Array.isArray(toDelete) ? toDelete : [toDelete]
  const paths = list.flatMap(p => {
    const full = p.storagePath ?? `${user.id}/${storageKey(p.name)}`
    // Derive thumb path from full path: insert 'thumbs/' before the filename
    const parts = full.split('/')
    const thumb = [...parts.slice(0, -1), 'thumbs', parts.at(-1)].join('/')
    return [full, thumb]
  })
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

  await Promise.all(list.map(p => setCached(`thumbs/${user.id}/${p.name}`, undefined)))
  usePhotoStore.getState().removePhotos(list)
}
