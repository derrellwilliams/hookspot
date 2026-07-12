// Mobile port of src/lib/waterbody.js (import.meta.env → expo config)
import Constants from 'expo-constants'

const TOKEN = Constants.expoConfig?.extra?.mapboxToken
const TILESET = 'mapbox.mapbox-streets-v8'
const WATER_CLASSES = new Set(['water', 'stream', 'river', 'canal', 'reservoir'])

async function query(lat, lng, radius) {
  const url = `https://api.mapbox.com/v4/${TILESET}/tilequery/${lng},${lat}.json?radius=${radius}&limit=50&layers=natural_label&access_token=${TOKEN}`
  const res = await fetch(url)
  if (!res.ok) return null
  const { features } = await res.json()
  const best = (features ?? [])
    .filter(f => f.properties?.name && WATER_CLASSES.has(f.properties?.class))
    .sort((a, b) => a.properties.tilequery.distance - b.properties.tilequery.distance)[0]
  return best ? { name: best.properties.name, class: best.properties.class } : null
}

export async function findNearestWaterBody(lat, lng) {
  if (!TOKEN) return null
  return (await query(lat, lng, 800)) ?? (await query(lat, lng, 8000))
}
