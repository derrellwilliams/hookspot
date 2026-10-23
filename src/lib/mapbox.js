export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
export const MAP_STYLE = 'mapbox://styles/derrellwilliams/cmoc96j0y000i01r90nqr62du'

let mapboxPromise = null

// Mapbox GL is ~1.7MB — loading it on first use keeps it out of the main bundle
// so the feed can render before the map library arrives. Shared by every map
// (home, catch popup mini-map, upload location picker); resolves to `mapboxgl`.
export function loadMapbox() {
  mapboxPromise ??= Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')])
    .then(([{ default: mapboxgl }]) => {
      mapboxgl.accessToken = MAPBOX_TOKEN
      return mapboxgl
    })
    .catch(e => {
      mapboxPromise = null  // let the next map retry (e.g. after a flaky network)
      throw e
    })
  return mapboxPromise
}
