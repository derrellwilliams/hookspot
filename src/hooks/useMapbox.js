import { useEffect, useState } from 'react'
import { loadMapbox, loadedMapbox } from '../lib/mapbox.js'

// Returns the lazily loaded `mapboxgl` module, or null until it's ready.
// Pass `enabled = false` to hold off starting the download.
export function useMapbox(enabled = true) {
  const [mapboxgl, setMapboxgl] = useState(loadedMapbox)
  useEffect(() => {
    if (!enabled || mapboxgl) return
    let cancelled = false
    loadMapbox()
      .then(m => { if (!cancelled) setMapboxgl(m) })
      .catch(e => console.error('[hookspot] failed to load map', e))
    return () => { cancelled = true }
  }, [enabled, mapboxgl])
  return mapboxgl
}
