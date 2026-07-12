// Mobile port of src/lib/geocode.js (import.meta.env → expo config)
import Constants from 'expo-constants'

const TOKEN = Constants.expoConfig?.extra?.mapboxToken

export async function reverseGeocode(lat, lng) {
  if (!TOKEN) return null
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,region&limit=1&access_token=${TOKEN}`
  )
  if (!res.ok) return null
  const { features } = await res.json()
  const f = features?.[0]
  if (!f) return null
  const city = f.text ?? null
  const state = f.context?.find(c => c.id?.startsWith('region.'))?.text ?? null
  return { city, state }
}
