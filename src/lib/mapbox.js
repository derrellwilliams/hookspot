export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
export const MAP_STYLE = 'mapbox://styles/derrellwilliams/cmoc96j0y000i01r90nqr62du'

const LOAD_ATTEMPTS = 3

let mapboxPromise = null
export let loadedMapbox = null

// Mapbox GL is ~1.7MB — loading it on first use keeps it out of the main bundle
// so the feed can render before the map library arrives. Resolves to `mapboxgl`.
// Components should use the useMapbox() hook rather than calling this directly.
// (Its CSS is imported statically in main.jsx to keep stylesheet order stable.)
export function loadMapbox() {
  mapboxPromise ??= (async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        const { default: mapboxgl } = await import('mapbox-gl')
        mapboxgl.accessToken = MAPBOX_TOKEN
        loadedMapbox = mapboxgl
        return mapboxgl
      } catch (e) {
        if (attempt >= LOAD_ATTEMPTS) {
          mapboxPromise = null  // let a later map try again
          throw e
        }
        await new Promise(r => setTimeout(r, 1000 * attempt))
      }
    }
  })()
  return mapboxPromise
}
