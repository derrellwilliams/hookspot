import { resizeBlob } from './exif.js'

export async function identifySpecies(blob) {
  try {
    const small = await resizeBlob(blob, 1024, 0.85)
    const res = await fetch('/identify', { method: 'POST', body: small })
    if (res.status === 404) {
      console.warn('[identify] /identify endpoint not found — species identification requires a server (not available in static builds)')
      return null
    }
    if (!res.ok) return null
    const { species } = await res.json()
    return species && species !== 'none' ? species : null
  } catch {
    return null
  }
}
