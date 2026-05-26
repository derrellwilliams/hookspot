#!/usr/bin/env node
// Backfill catches rows for legacy photos (catch_id === null).
//
// Usage:
//   node --env-file=.env scripts/backfill-catches.mjs --user <user_id>
//   node --env-file=.env scripts/backfill-catches.mjs --all
//
// Always run --user on a test account first and verify groupings in the
// Supabase dashboard before running --all.
//
// After a successful full backfill:
//   - Delete src/lib/groupByTime.js
//   - Remove the groupByTime fallback + import from src/lib/groupPhotos.js

import { createClient } from '@supabase/supabase-js'
import { groupByTime } from '../src/lib/groupByTime.js'

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const args = process.argv.slice(2)
const userFlagIdx = args.indexOf('--user')
const runAll = args.includes('--all')

if (!runAll && userFlagIdx === -1) {
  console.error('Usage: --user <user_id> | --all')
  process.exit(1)
}

async function backfillUser(userId) {
  console.log(`\nUser: ${userId}`)

  // Fetch all null-catch_id photos regardless of GPS so groups stay intact.
  // The catches INSERT uses lead lat/lng which may be null for GPS-less groups.
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, species, lat, lng, time, meta')
    .eq('user_id', userId)
    .is('catch_id', null)
    .order('time', { ascending: true })

  if (error) {
    console.error(`  fetch error: ${error.message}`)
    return
  }

  if (!photos.length) {
    console.log('  no legacy photos — skipping')
    return
  }

  console.log(`  ${photos.length} legacy photos`)

  // groupByTime does arithmetic on time so convert ISO → ms
  const photosMs = photos.map(p => ({
    ...p,
    time: p.time ? new Date(p.time).getTime() : null,
  }))

  const groups = groupByTime(photosMs)
  console.log(`  ${groups.length} groups`)

  let catchesCreated = 0
  let photosUpdated = 0

  for (const group of groups) {
    const lead = group[0]

    const { data: catchRow, error: insertErr } = await supabase
      .from('catches')
      .insert({
        user_id: userId,
        species: lead.species ?? null,
        rod: lead.meta?.rod ?? null,
        fly: lead.meta?.fly ?? null,
        lat: lead.lat ?? null,
        lng: lead.lng ?? null,
        time: lead.time ? new Date(lead.time).toISOString() : null,
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error(`  insert error: ${insertErr.message}`)
      continue
    }

    catchesCreated++

    const { error: updateErr } = await supabase
      .from('photos')
      .update({ catch_id: catchRow.id })
      .in('id', group.map(p => p.id))

    if (updateErr) {
      console.error(`  update error: ${updateErr.message}`)
      continue
    }

    photosUpdated += group.length
  }

  console.log(`  created ${catchesCreated} catches, linked ${photosUpdated} photos`)
}

async function getUsersWithLegacyPhotos() {
  // Page through photos to collect distinct user_ids without pulling all columns.
  const PAGE = 1000
  const userIds = new Set()
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('photos')
      .select('user_id')
      .is('catch_id', null)
      .range(from, from + PAGE - 1)

    if (error) throw new Error(`Failed to fetch user list: ${error.message}`)
    if (!data.length) break

    data.forEach(r => userIds.add(r.user_id))
    if (data.length < PAGE) break
    from += PAGE
  }

  return [...userIds]
}

async function main() {
  if (runAll) {
    const userIds = await getUsersWithLegacyPhotos()
    console.log(`Found ${userIds.length} users with legacy photos`)
    for (const uid of userIds) {
      await backfillUser(uid)
    }
  } else {
    await backfillUser(args[userFlagIdx + 1])
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
