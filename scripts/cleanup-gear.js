// One-off: normalize whitespace in rod/fly across `catches` and `photos.meta`.
// Dry run by default; pass --apply to write changes.
//   node scripts/cleanup-gear.js [--apply]
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_BASE = env.VITE_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

function cleanGear(s) {
  const t = s?.replace(/\s+/g, ' ').trim()
  return t || null
}

async function fetchAll(path) {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${URL_BASE}/rest/v1/${path}&limit=1000&offset=${offset}`, { headers })
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

async function patch(table, id, body) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${table}/${id}: ${res.status} ${await res.text()}`)
}

const show = v => JSON.stringify(v)

// ── catches.rod / catches.fly ─────────────────────────────────────────────────
const catches = await fetchAll('catches?select=id,rod,fly&or=(rod.not.is.null,fly.not.is.null)')
let catchChanges = 0
for (const c of catches) {
  const rod = cleanGear(c.rod)
  const fly = cleanGear(c.fly)
  if (rod === c.rod && fly === c.fly) continue
  catchChanges++
  console.log(`catches ${c.id}: rod ${show(c.rod)} -> ${show(rod)}, fly ${show(c.fly)} -> ${show(fly)}`)
  if (APPLY) await patch('catches', c.id, { rod, fly })
}

// ── photos.meta.rod / photos.meta.fly ────────────────────────────────────────
const photos = await fetchAll('photos?select=id,meta&meta=not.is.null')
let photoChanges = 0
for (const p of photos) {
  const rod = cleanGear(p.meta?.rod)
  const fly = cleanGear(p.meta?.fly)
  if (rod === (p.meta?.rod ?? null) && fly === (p.meta?.fly ?? null)) continue
  photoChanges++
  console.log(`photos ${p.id}: rod ${show(p.meta?.rod)} -> ${show(rod)}, fly ${show(p.meta?.fly)} -> ${show(fly)}`)
  if (APPLY) await patch('photos', p.id, { meta: { ...p.meta, rod, fly } })
}

console.log(`\n${APPLY ? 'Updated' : 'Would update'} ${catchChanges} catches row(s), ${photoChanges} photos row(s) (of ${catches.length} catches, ${photos.length} photos scanned)`)
if (!APPLY && (catchChanges || photoChanges)) console.log('Re-run with --apply to write these changes.')
