#!/usr/bin/env node
// Backfill photos.meta.waterBody for existing photos that have GPS coordinates.
// Mirrors src/lib/waterbody.js's Tilequery lookup (duplicated here since that
// module reads import.meta.env, which isn't available under plain Node).
//
// Usage:
//   node --env-file=.env scripts/backfill-waterbody.mjs --user <user_id>
//   node --env-file=.env scripts/backfill-waterbody.mjs --all
//
// Always run --user on a test account first and spot-check a few rows in the
// Supabase dashboard before running --all.

import { createClient } from '@supabase/supabase-js'

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_MAPBOX_TOKEN } = process.env

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}
if (!VITE_MAPBOX_TOKEN) {
  console.error('Missing VITE_MAPBOX_TOKEN in environment.')
  process.exit(1)
}

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TILESET = 'mapbox.mapbox-streets-v8'
const WATER_CLASSES = new Set(['water', 'stream', 'river', 'canal', 'reservoir'])
const CONCURRENCY = 5

async function queryTilequery(lat, lng, radius) {
  const url = `https://api.mapbox.com/v4/${TILESET}/tilequery/${lng},${lat}.json?radius=${radius}&limit=50&layers=natural_label&access_token=${VITE_MAPBOX_TOKEN}`
  const res = await fetch(url)
  if (!res.ok) return null
  const { features } = await res.json()
  const best = (features ?? [])
    .filter(f => f.properties?.name && WATER_CLASSES.has(f.properties?.class))
    .sort((a, b) => a.properties.tilequery.distance - b.properties.tilequery.distance)[0]
  return best ? { name: best.properties.name, class: best.properties.class } : null
}

async function findNearestWaterBody(lat, lng) {
  return (await queryTilequery(lat, lng, 800)) ?? (await queryTilequery(lat, lng, 8000))
}

const args = process.argv.slice(2)
const userFlagIdx = args.indexOf('--user')
const runAll = args.includes('--all')

if (!runAll && userFlagIdx === -1) {
  console.error('Usage: --user <user_id> | --all')
  process.exit(1)
}

async function fetchCandidates(userId) {
  const PAGE = 1000
  const rows = []
  let from = 0
  while (true) {
    let query = supabase
      .from('photos')
      .select('id, lat, lng, meta')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .range(from, from + PAGE - 1)
    if (userId) query = query.eq('user_id', userId)
    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch photos: ${error.message}`)
    if (!data.length) break
    rows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows.filter(r => !r.meta?.waterBody)
}

async function withConcurrency(items, limit, fn) {
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      await fn(item)
    }
  }))
}

async function backfill(userId) {
  console.log(userId ? `\nUser: ${userId}` : '\nAll users')
  const candidates = await fetchCandidates(userId)
  console.log(`  ${candidates.length} photos with GPS missing waterBody`)

  let updated = 0
  let resolved = 0
  await withConcurrency(candidates, CONCURRENCY, async (photo) => {
    try {
      const wb = await findNearestWaterBody(photo.lat, photo.lng)
      if (!wb) return
      resolved++
      const { error } = await supabase
        .from('photos')
        .update({ meta: { ...photo.meta, waterBody: wb } })
        .eq('id', photo.id)
      if (error) { console.error(`  update error (photo ${photo.id}): ${error.message}`); return }
      updated++
    } catch (err) {
      console.error(`  lookup error (photo ${photo.id}): ${err.message}`)
    }
  })

  console.log(`  resolved ${resolved}, updated ${updated} of ${candidates.length}`)
}

async function main() {
  await backfill(runAll ? null : args[userFlagIdx + 1])
  console.log('\nDone.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
