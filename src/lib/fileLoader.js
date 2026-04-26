import { extractExif, toDisplayBlob } from '../exif.js'
import { getCached, setCached, getMeta, setMeta } from '../cache.js'
import { identifySpecies } from '../identify.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { parseExifDate } from './formatters.js'
import imageList from 'virtual:images'

let metaSeed = {}
let speciesData = {}

function applySpecies(photo) {
  const s = photo.meta?.species || speciesData[photo.name]
  if (s && s !== 'none') photo.species = s
}

export async function initPhotos() {
  try {
    const [metaRes, speciesRes] = await Promise.all([
      fetch('/metadata.json').then(r => r.ok ? r.json() : {}),
      fetch('/species.json').then(r => r.ok ? r.json() : {}),
    ])
    metaSeed = metaRes
    speciesData = speciesRes
  } catch {}
  if (imageList.length) {
    await Promise.all(imageList.map(filename =>
      loadPhoto(filename).catch(e => console.error('[hookspot] failed to load', filename, e))
    ))
  }
}

export async function handleFiles(fileList, meta = {}, displayBlobs = []) {
  const existingNames = new Set(usePhotoStore.getState().photos.map(p => p.name))
  const files = Array.from(fileList)
  if (!files.length) return
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) continue
    if (existingNames.has(file.name)) continue
    await loadPhoto(file.name, file, meta, displayBlobs[i])
    fetch(`/images/${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'x-filename': file.name },
      body: file,
    }).catch(() => {})
  }
}

export async function loadPhoto(filename, file, uploadMeta = {}, displayBlob) {
  const { photos, addPhoto, updatePhoto } = usePhotoStore.getState()
  if (photos.find(p => p.name === filename)) return

  const [cached, meta] = await Promise.all([getCached(filename), getMeta(filename)])
  if (cached) {
    const photo = { ...cached, url: URL.createObjectURL(cached.blob), meta: { ...metaSeed[filename], ...meta } }
    applySpecies(photo)
    addPhoto(photo)
    return
  }

  if (!file) {
    const res = await fetch(`/images/${encodeURIComponent(filename)}`)
    if (!res.ok) return
    const blob = await res.blob()
    file = new File([blob], filename, { type: blob.type || 'image/heic' })
  }

  const [blob, exif] = await Promise.all([
    displayBlob ? Promise.resolve(displayBlob) : toDisplayBlob(file),
    extractExif(file),
  ])
  const time = exif?.DateTimeOriginal instanceof Date
    ? exif.DateTimeOriginal.getTime()
    : parseExifDate(exif?.DateTimeOriginal)

  const entry = { name: filename, blob, exif, hasGps: !!(exif?.latitude && exif?.longitude), time }
  await setCached(filename, entry)

  const defaultRod = uploadMeta.rod || (metaSeed[filename]?.rod ?? Object.values(metaSeed)[0]?.rod)
  const mergedMeta = { rod: defaultRod, ...uploadMeta }
  const photo = { ...entry, url: URL.createObjectURL(blob), meta: mergedMeta }
  if (uploadMeta.species) photo.species = uploadMeta.species
  else applySpecies(photo)
  if (Object.keys(mergedMeta).some(k => mergedMeta[k])) await setMeta(filename, mergedMeta)
  addPhoto(photo)

  if (!photo.species && !uploadMeta.identified) {
    const species = await identifySpecies(blob)
    if (species && species !== 'none') {
      const updatedPhoto = { ...photo, species, meta: { ...photo.meta, species } }
      await setMeta(filename, updatedPhoto.meta)
      updatePhoto(updatedPhoto)
    }
  }
}

export async function deletePhotos(toDelete) {
  const list = Array.isArray(toDelete) ? toDelete : [toDelete]
  await Promise.all(list.flatMap(p => [setCached(p.name, undefined), setMeta(p.name, undefined)]))
  list.forEach(p => fetch(`/images/${encodeURIComponent(p.name)}`, { method: 'DELETE' }).catch(() => {}))
  usePhotoStore.getState().removePhotos(list)
}
