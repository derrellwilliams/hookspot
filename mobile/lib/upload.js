import { supabase } from './supabase'
import { storageKey } from './storage'

// expo-image-picker v56 returns GPS in asset.exif with various key formats
// depending on platform and iOS photo authorization level.
export function parseGpsFromAsset(asset) {
  const exif = asset.exif
  if (!exif) return null

  // iOS: nested under GPS key
  const gps = exif.GPS || exif['{GPS}']
  if (gps?.Latitude != null && gps?.Longitude != null) {
    const lat = gps.Latitude * (gps.LatitudeRef === 'S' ? -1 : 1)
    const lng = gps.Longitude * (gps.LongitudeRef === 'W' ? -1 : 1)
    if (isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng }
  }

  // Android / flat format
  if (exif.GPSLatitude != null && exif.GPSLongitude != null) {
    const lat = Number(exif.GPSLatitude) * (exif.GPSLatitudeRef === 'S' ? -1 : 1)
    const lng = Number(exif.GPSLongitude) * (exif.GPSLongitudeRef === 'W' ? -1 : 1)
    if (isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng }
  }

  // Decimal already normalized by some parsers
  if (exif.latitude != null && exif.longitude != null) {
    return { lat: exif.latitude, lng: exif.longitude }
  }

  return null
}

function parseTimeFromAsset(asset) {
  const exif = asset.exif
  const raw =
    exif?.DateTimeOriginal ||
    exif?.['{Exif}']?.DateTimeOriginal ||
    exif?.DateTime
  if (!raw || typeof raw !== 'string') return null
  // EXIF: "2024:05:10 14:32:00" → ISO
  const iso = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d.getTime()
}

/**
 * Upload a catch (assets from expo-image-picker) to Supabase.
 * Returns an array of normalized photo rows for adding to the store.
 */
export async function uploadCatch(assets, { species, rod, fly, manualLat, manualLng }, user) {
  const firstAsset = assets[0]
  const exifGps = parseGpsFromAsset(firstAsset)
  const lat = exifGps?.lat ?? manualLat ?? null
  const lng = exifGps?.lng ?? manualLng ?? null
  const catchTime = parseTimeFromAsset(firstAsset) ?? Date.now()

  const { data: catchRow, error: catchError } = await supabase
    .from('catches')
    .insert({
      user_id: user.id,
      species: species || null,
      rod: rod || null,
      fly: fly || null,
      lat,
      lng,
      time: new Date(catchTime).toISOString(),
    })
    .select('id')
    .single()

  if (catchError) throw new Error('Failed to create catch: ' + catchError.message)
  const catchId = catchRow.id

  const photos = []
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    // expo-image-picker returns fileName on iOS, name on Android, or we generate one
    const rawName = asset.fileName || asset.name || `catch_${Date.now()}_${i}.jpg`
    const filename = rawName.replace(/[^\w.\-]/g, '_').replace(/\.(heic|heif)$/i, '.jpg')
    const storagePath = `${user.id}/${catchId}/${storageKey(filename)}`
    const assetGps = parseGpsFromAsset(asset) ?? (lat != null ? { lat, lng } : null)
    const assetTime = parseTimeFromAsset(asset) ?? catchTime

    const { error: uploadError } = await supabase.storage
      .from('catches')
      .upload(storagePath, { uri: asset.uri, name: filename, type: 'image/jpeg' }, {
        upsert: false,
        contentType: 'image/jpeg',
      })

    if (uploadError) {
      console.error('[upload] storage error for', filename, uploadError)
      continue
    }

    const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(storagePath)

    const { data: photoRow, error: dbError } = await supabase
      .from('photos')
      .insert({
        user_id: user.id,
        catch_id: catchId,
        filename: rawName,
        storage_path: storagePath,
        url: publicUrl,
        species: species || null,
        lat: assetGps?.lat ?? null,
        lng: assetGps?.lng ?? null,
        time: new Date(assetTime).toISOString(),  // ISO for DB
        meta: { order: i, rod: rod || null, fly: fly || null, identified: false },
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('[upload] db error for', filename, dbError)
      await supabase.storage.from('catches').remove([storagePath])
      continue
    }

    photos.push({
      id: photoRow.id,
      filename: rawName,
      user_id: user.id,
      catch_id: catchId,
      catchId,
      lat: assetGps?.lat ?? null,
      lng: assetGps?.lng ?? null,
      species: species || null,
      time: assetTime,  // ms number, matching normalize() in store
      meta: { order: i, rod: rod || null, fly: fly || null, identified: false },
      storage_path: storagePath,
      url: publicUrl,
    })
  }

  if (photos.length === 0) {
    await supabase.from('catches').delete().eq('id', catchId)
    throw new Error('All photo uploads failed')
  }

  return photos
}

/**
 * Upload additional photos into an existing catch group.
 * Inherits location, species, rod, fly from the group lead.
 */
export async function addPhotosToGroup(assets, groupLead, user) {
  const catchId = groupLead.catchId
  if (!catchId) throw new Error('Cannot add photos to a catch without an ID')

  const photos = []
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    const base = asset.fileName || asset.name || `photo.jpg`
    // Prefix with timestamp+index so re-adding the same photo never collides
    const rawName = `${Date.now()}_${i}_${base}`
    const filename = rawName.replace(/[^\w.\-]/g, '_').replace(/\.(heic|heif)$/i, '.jpg')
    const storagePath = `${user.id}/${catchId}/${storageKey(filename)}`
    const assetTime = parseTimeFromAsset(asset) ?? groupLead.time ?? Date.now()

    const { error: uploadError } = await supabase.storage
      .from('catches')
      .upload(storagePath, { uri: asset.uri, name: filename, type: 'image/jpeg' }, {
        upsert: false,
        contentType: 'image/jpeg',
      })

    if (uploadError) {
      console.error('[addPhotos] storage error for', filename, uploadError)
      continue
    }

    const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(storagePath)

    const { data: photoRow, error: dbError } = await supabase
      .from('photos')
      .insert({
        user_id: user.id,
        catch_id: catchId,
        filename: rawName,
        storage_path: storagePath,
        url: publicUrl,
        species: groupLead.species || null,
        lat: groupLead.lat ?? null,
        lng: groupLead.lng ?? null,
        time: new Date(assetTime).toISOString(),
        meta: { rod: groupLead.meta?.rod || null, fly: groupLead.meta?.fly || null },
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('[addPhotos] db error for', filename, dbError)
      await supabase.storage.from('catches').remove([storagePath])
      continue
    }

    photos.push({
      id: photoRow.id,
      filename: rawName,
      user_id: user.id,
      catch_id: catchId,
      catchId,
      lat: groupLead.lat ?? null,
      lng: groupLead.lng ?? null,
      species: groupLead.species || null,
      time: assetTime,
      meta: { rod: groupLead.meta?.rod || null, fly: groupLead.meta?.fly || null },
      storage_path: storagePath,
      url: publicUrl,
    })
  }

  if (photos.length === 0) throw new Error('All photo uploads failed')
  return photos
}
