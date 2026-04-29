import exifr from 'exifr'
import heic2any from 'heic2any'

const STORAGE_MAX_PX = 2048
const STORAGE_QUALITY = 0.85

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

export async function resizeBlob(blob, maxPx, quality = 0.85) {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url })
  URL.revokeObjectURL(url)

  const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight))
  if (scale === 1 && blob.type === 'image/jpeg') return blob

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', quality)
  )
}

export function resizeForStorage(blob) {
  return resizeBlob(blob, STORAGE_MAX_PX, STORAGE_QUALITY)
}
