import exifr from 'exifr'
import heic2any from 'heic2any'

const STORAGE_MAX_PX = 2048
const STORAGE_QUALITY = 0.85
const DISPLAY_MAX_PX = 1200

// iOS Safari natively decodes HEIC in <img> and canvas; heic2any (pure-JS
// decoder) can spike to 300-500MB and crash the tab on low-memory devices.
function isNativeHeicBrowser() {
  const ua = navigator.userAgent
  return /iPhone|iPad/i.test(ua) && /WebKit/i.test(ua) && !/CriOS|FxiOS/i.test(ua)
}

export async function extractExif(file) {
  try {
    const result = await exifr.parse(file, { gps: true, tiff: true, ifd0: true, exif: true }) ?? null
    if (result?.latitude != null) return result
    // Retry with full parse for HEIC files that need it
    const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif'
    if (isHeic) return await exifr.parse(file) ?? null
    return result
  } catch {
    return null
  }
}

export async function toDisplayBlob(file) {
  const knownType = file.type && file.type !== ''
  const isHeic = knownType
    ? (file.type === 'image/heic' || file.type === 'image/heif')
    : (/\.heic$/i.test(file.name) || /\.heif$/i.test(file.name))

  if (isHeic) {
    // iOS Safari can display HEIC natively — skip the JS decoder entirely.
    if (isNativeHeicBrowser()) return file
    try {
      const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 })
      const converted = Array.isArray(result) ? result[0] : result
      return resizeBlob(converted, DISPLAY_MAX_PX, 0.82).catch(() => converted)
    } catch (e) {
      console.warn('[exif] HEIC conversion failed for', file.name, e)
    }
  }

  // Resize large images for display so <img> preview doesn't decode a full 12MP
  // photo into memory — the canvas resize in resizeForStorage already handles
  // the stored copy separately.
  return resizeBlob(file, DISPLAY_MAX_PX, 0.82).catch(() => file)
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
