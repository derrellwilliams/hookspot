import { supabase } from './supabase.js'

function resizeToBlob(file, size = 128, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      const s = Math.min(img.width, img.height)
      const sx = (img.width - s) / 2
      const sy = (img.height - s) / 2
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Could not encode image'))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')) }
    img.src = url
  })
}

export async function uploadAvatar(userId, file) {
  const blob = await resizeToBlob(file)
  const storagePath = `${userId}/avatar.jpg`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(storagePath, blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(storagePath).data.publicUrl
}
