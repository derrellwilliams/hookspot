import { extractExif, toDisplayBlob } from '../exif.js'
import { getCached, setCached } from '../cache.js'
import { identifySpecies } from '../identify.js'
import { fetchWeather } from './weather.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { supabase } from '../lib/supabase.js'
import { parseExifDate } from './formatters.js'

function getUser() {
  return useAuthStore.getState().user
}

// Supabase Storage rejects spaces and some special chars in object keys
function storageKey(filename) {
  return filename.replace(/\s/g, '_')
}

function buildPhoto(blob, exif, row) {
  const time = row.time ? new Date(row.time).getTime() : null
  const hasGps = !!(row.lat && row.lng)
  const effectiveExif = exif ?? (hasGps ? { latitude: row.lat, longitude: row.lng } : null)
  return {
    name: row.filename,
    blob,
    exif: effectiveExif,
    hasGps,
    time,
    url: URL.createObjectURL(blob),
    meta: row.meta || {},
    species: row.species || undefined,
  }
}

function maybeFetchWeather(photo) {
  const user = getUser()
  if (!photo.hasGps || !photo.time || photo.meta?.weather || !user) return
  fetchWeather(photo.exif.latitude, photo.exif.longitude, photo.time)
    .then(weather => {
      if (!weather) return
      const meta = { ...photo.meta, weather }
      supabase.from('photos').update({ meta }).eq('filename', photo.name).eq('user_id', user.id)
      usePhotoStore.getState().updatePhoto({ ...photo, meta })
    })
    .catch(() => {})
}

export async function initPhotos() {
  const user = getUser()
  if (!user) return

  const { data: rows, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', user.id)
    .order('time', { ascending: false })

  if (error || !rows?.length) return

  await Promise.all(rows.map(row =>
    loadPhotoFromRow(row).catch(e => console.error('[hookspot] failed to load', row.filename, e))
  ))
}

async function loadPhotoFromRow(row) {
  const { photos, addPhoto } = usePhotoStore.getState()
  if (photos.find(p => p.name === row.filename)) return

  const cached = await getCached(row.filename)
  if (cached) {
    const photo = buildPhoto(cached.blob, cached.exif, row)
    addPhoto(photo)
    maybeFetchWeather(photo)
    return
  }

  const res = await fetch(row.url)
  if (!res.ok) return
  const rawBlob = await res.blob()
  const file = new File([rawBlob], row.filename, { type: rawBlob.type || 'image/heic' })

  const [blob, exif] = await Promise.all([toDisplayBlob(file), extractExif(file)])
  await setCached(row.filename, { blob, exif })

  const photo = buildPhoto(blob, exif, row)
  addPhoto(photo)
  maybeFetchWeather(photo)
}

export async function handleFiles(fileList, meta = {}, displayBlobs = []) {
  const user = getUser()
  if (!user) return

  const existingNames = new Set(usePhotoStore.getState().photos.map(p => p.name))
  const files = Array.from(fileList)
  if (!files.length) return

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) continue
    if (existingNames.has(file.name)) continue
    await uploadPhoto(file, user, meta, displayBlobs[i])
  }
}

async function uploadPhoto(file, user, uploadMeta, displayBlob) {
  const storagePath = `${user.id}/${storageKey(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from('catches')
    .upload(storagePath, file, { upsert: false })
  if (uploadError) { console.error('[hookspot] storage upload failed', uploadError); return }

  const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(storagePath)

  const [blob, exif] = await Promise.all([
    displayBlob ? Promise.resolve(displayBlob) : toDisplayBlob(file),
    extractExif(file),
  ])

  const time = exif?.DateTimeOriginal instanceof Date
    ? exif.DateTimeOriginal.getTime()
    : parseExifDate(exif?.DateTimeOriginal)

  const row = {
    user_id: user.id,
    filename: file.name,
    storage_path: storagePath,
    url: publicUrl,
    species: uploadMeta.species || null,
    lat: exif?.latitude || null,
    lng: exif?.longitude || null,
    time: time ? new Date(time).toISOString() : null,
    meta: uploadMeta,
  }

  const { error: dbError } = await supabase.from('photos').insert(row)
  if (dbError) {
    await supabase.storage.from('catches').remove([storagePath])
    console.error('[hookspot] db insert failed', dbError)
    return
  }

  await setCached(file.name, { blob, exif })

  const photo = buildPhoto(blob, exif, row)
  if (uploadMeta.species) photo.species = uploadMeta.species
  usePhotoStore.getState().addPhoto(photo)
  maybeFetchWeather(photo)

  if (!photo.species && !uploadMeta.identified) {
    const species = await identifySpecies(blob)
    if (species && species !== 'none') {
      await supabase.from('photos').update({ species }).eq('filename', file.name).eq('user_id', user.id)
      usePhotoStore.getState().updatePhoto({ ...photo, species, meta: { ...photo.meta, species } })
    }
  }
}

export async function uploadPhotoToGroup(file, groupLead) {
  const user = getUser()
  if (!user) throw new Error('Not signed in')

  const storagePath = `${user.id}/${storageKey(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from('catches')
    .upload(storagePath, file, { upsert: true })
  if (uploadError) throw new Error('Storage: ' + uploadError.message)

  const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(storagePath)
  const [blob, exif] = await Promise.all([toDisplayBlob(file), extractExif(file)])

  const row = {
    user_id: user.id,
    filename: file.name,
    storage_path: storagePath,
    url: publicUrl,
    species: null,
    lat: groupLead.exif?.latitude ?? null,
    lng: groupLead.exif?.longitude ?? null,
    time: groupLead.time ? new Date(groupLead.time).toISOString() : null,
    meta: {},
  }

  const { error: dbError } = await supabase.from('photos').insert(row)
  if (dbError) {
    await supabase.storage.from('catches').remove([storagePath])
    throw new Error('DB: ' + dbError.message)
  }

  await setCached(file.name, { blob, exif })
  const photo = buildPhoto(blob, exif, row)
  usePhotoStore.getState().addPhoto(photo)
  return photo
}

export async function deletePhotos(toDelete) {
  const user = getUser()
  if (!user) return

  const list = Array.isArray(toDelete) ? toDelete : [toDelete]
  const paths = list.map(p => `${user.id}/${storageKey(p.name)}`)
  const filenames = list.map(p => p.name)

  await Promise.all([
    supabase.storage.from('catches').remove(paths),
    supabase.from('photos').delete().in('filename', filenames).eq('user_id', user.id),
    ...list.map(p => setCached(p.name, undefined)),
  ])

  usePhotoStore.getState().removePhotos(list)
}
