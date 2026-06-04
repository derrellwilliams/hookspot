import { supabase } from './supabase'

export function storageKey(filename) {
  return filename.replace(/[^\w.\-]/g, '_').replace(/\.(heic|heif)$/i, '.jpg')
}

export function photoUrl(userId, filename, storagePath) {
  const path = storagePath ?? `${userId}/${storageKey(filename)}`
  return supabase.storage.from('catches').getPublicUrl(path).data.publicUrl
}
