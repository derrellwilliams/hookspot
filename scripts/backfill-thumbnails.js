#!/usr/bin/env node
// One-time script to generate thumbnails for all photos that don't have one yet.
// Requires: npm install --save-dev sharp
// Run: node scripts/backfill-thumbnails.js
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'

// Read .env manually (no dotenv dependency)
const env = Object.fromEntries(
  readFileSync(resolve(import.meta.dirname, '../.env'), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map((p, i) => i === 0 ? p.trim() : l.slice(l.indexOf('=') + 1).trim()))
)

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const THUMB_MAX_PX = 400
const THUMB_QUALITY = 72

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function thumbPathFromStorage(storagePath, userId, filename) {
  const path = storagePath ?? `${userId}/${filename.replace(/[^\w.\-]/g, '_').replace(/\.(heic|heif)$/i, '.jpg')}`
  const parts = path.split('/')
  return [...parts.slice(0, -1), 'thumbs', parts.at(-1)].join('/')
}

async function toJpegBuffer(buffer, filename) {
  if (!/\.(heic|heif)$/i.test(filename)) return buffer
  // Use macOS sips to convert HEIC (including HEVC-encoded) → JPEG
  const ts = Date.now()
  const inPath = join(tmpdir(), `hookspot_in_${ts}.heic`)
  const outPath = join(tmpdir(), `hookspot_out_${ts}.jpg`)
  try {
    writeFileSync(inPath, buffer)
    execSync(`sips -s format jpeg "${inPath}" --out "${outPath}"`, { stdio: 'pipe' })
    return readFileSync(outPath)
  } finally {
    try { unlinkSync(inPath) } catch {}
    try { unlinkSync(outPath) } catch {}
  }
}

async function resizeToThumb(buffer, filename) {
  const jpegBuffer = await toJpegBuffer(buffer, filename)
  const img = sharp(jpegBuffer)
  const { width, height } = await img.metadata()
  const scale = Math.min(1, THUMB_MAX_PX / Math.max(width, height))
  return img
    .resize(Math.round(width * scale), Math.round(height * scale))
    .jpeg({ quality: THUMB_QUALITY })
    .toBuffer()
}

async function main() {
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, user_id, filename, storage_path, url')
    .is('thumb_url', null)
    .not('url', 'is', null)
    .order('time', { ascending: false })

  if (error) { console.error('Failed to fetch photos:', error.message); process.exit(1) }
  console.log(`Found ${photos.length} photos without thumbnails\n`)

  let ok = 0, fail = 0
  for (const photo of photos) {
    const thumbPath = thumbPathFromStorage(photo.storage_path, photo.user_id, photo.filename)
    try {
      let res = await fetch(photo.url)
      // Some old HEIC files were stored with a .jpg extension via storageKey normalization
      if (!res.ok && /\.(heic|heif)$/i.test(photo.url)) {
        res = await fetch(photo.url.replace(/\.(heic|heif)$/i, '.jpg'))
      }
      if (!res.ok) throw new Error(`Download HTTP ${res.status}`)
      const buffer = Buffer.from(await res.arrayBuffer())

      const thumbBuffer = await resizeToThumb(buffer, photo.filename)

      const { error: uploadError } = await supabase.storage
        .from('catches')
        .upload(thumbPath, thumbBuffer, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw new Error('Upload: ' + uploadError.message)

      const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(thumbPath)

      const { error: updateError } = await supabase
        .from('photos')
        .update({ thumb_url: publicUrl })
        .eq('id', photo.id)
      if (updateError) throw new Error('DB: ' + updateError.message)

      console.log(`✓ ${photo.filename}`)
      ok++
    } catch (err) {
      console.error(`✗ ${photo.filename}: ${err.message}`)
      fail++
    }
  }

  console.log(`\nDone: ${ok} OK, ${fail} failed`)
}

main()
