// Background weather / place / water-body enrichment for own photos.
// Mobile port of the enrichment half of src/lib/fileLoader.js, adapted to the
// mobile row shape (normalized photos rows: id, user_id, lat, lng, time-in-ms,
// meta). Results are written into photos.meta and pushed into the store.
import { supabase } from './supabase'
import { fetchWeather } from './weather'
import { reverseGeocode } from './geocode'
import { findNearestWaterBody } from './waterbody'
import { usePhotoStore } from '../store/usePhotoStore'

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

async function saveMeta(photoId, key, value) {
  const current = usePhotoStore.getState().photos.find(p => p.id === photoId)
  if (!current) return
  const meta = { ...current.meta, [key]: value }
  const { error } = await supabase.from('photos').update({ meta }).eq('id', photoId)
  if (!error) usePhotoStore.getState().updatePhoto({ ...current, meta })
}

function hasGps(photo) {
  return photo.lat != null && photo.lng != null
}

function maybeFetchLocation(photo) {
  if (!hasGps(photo) || photo.meta?.location) return
  runGeoTask(() => reverseGeocode(photo.lat, photo.lng)
    .then(loc => loc && saveMeta(photo.id, 'location', loc))
    .catch(() => {}))
}

function maybeFetchWaterBody(photo) {
  if (!hasGps(photo) || photo.meta?.waterBody) return
  runGeoTask(() => findNearestWaterBody(photo.lat, photo.lng)
    .then(wb => wb && saveMeta(photo.id, 'waterBody', wb))
    .catch(() => {}))
}

function maybeFetchWeather(photo) {
  if (!hasGps(photo) || !photo.time || photo.meta?.weather) return
  runGeoTask(() => fetchWeather(photo.lat, photo.lng, photo.time)
    .then(weather => weather && saveMeta(photo.id, 'weather', weather))
    .catch(() => {}))
}

// Enrich the given photos (own photos only — RLS blocks meta writes on others').
// Safe to call repeatedly; each fetch is skipped once meta has the key.
export function enrichPhotos(photos, ownUserId) {
  for (const photo of photos ?? []) {
    if (!photo?.id || photo.user_id !== ownUserId) continue
    maybeFetchWeather(photo)
    maybeFetchLocation(photo)
    maybeFetchWaterBody(photo)
  }
}
