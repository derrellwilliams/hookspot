import exifr from 'exifr'
import heic2any from 'heic2any'

export async function extractExif(file) {
  try {
    return await exifr.parse(file, { gps: true }) ?? null
  } catch {
    return null
  }
}

export async function toDisplayBlob(file) {
  const isHeic = file.type === 'image/heic'
    || file.type === 'image/heif'
    || /\.heic$/i.test(file.name)
    || /\.heif$/i.test(file.name)

  if (isHeic) {
    try {
      const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 })
      return Array.isArray(result) ? result[0] : result
    } catch (e) {
      console.warn('[exif] HEIC conversion failed for', file.name, e)
    }
  }

  return file
}
