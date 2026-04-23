/**
 * Identify fish species in an image via the local Vite dev server proxy.
 * The proxy calls the Anthropic API server-side so the key is never exposed.
 */
export async function identifySpecies(blob) {
  try {
    // Convert to JPEG blob if needed (proxy expects image/jpeg)
    const res = await fetch('/identify', { method: 'POST', body: blob })
    if (!res.ok) return null
    const { species } = await res.json()
    return species && species !== 'none' ? species : null
  } catch {
    return null
  }
}
