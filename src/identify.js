import { resizeBlob } from './exif.js'
import { supabase } from './lib/supabase.js'

export async function identifySpecies(blob) {
  try {
    const [small, { data: { session } }] = await Promise.all([
      resizeBlob(blob, 1024, 0.85),
      supabase.auth.getSession(),
    ])
    const headers = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}
    const res = await fetch('/identify', { method: 'POST', body: small, headers })
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
