/**
 * Identify fish species in an image via the local Vite dev server proxy.
 * The proxy calls the Anthropic API server-side so the key is never exposed.
 */

async function resizeForIdentify(blob) {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url })
  URL.revokeObjectURL(url)
  const MAX = 1024
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
}

export async function identifySpecies(blob) {
  try {
    const small = await resizeForIdentify(blob)
    const res = await fetch('/identify', { method: 'POST', body: small })
    if (!res.ok) return null
    const { species } = await res.json()
    return species && species !== 'none' ? species : null
  } catch {
    return null
  }
}
