#!/usr/bin/env node
// One-time script that repairs legacy photos and (re)generates thumbnails.
//
// Two things happen per photo, as needed:
//  1. Root fix: some legacy rows have a raw, unconverted HEIC file sitting at
//     `storage_path` (served as content-type image/heic, which most non-Safari
//     browsers can't render in <img>). We detect this by content-type — not
//     filename, since many ".HEIC"-named objects were already converted to
//     real JPEG bytes by a later upload path — and re-upload a resized JPEG
//     to the SAME storage_path (Supabase Storage serves whatever content-type
//     is set at upload time regardless of key extension, so no URL/DB change
//     needed).
//  2. Thumbnail generation: writes a small JPEG to storage_path's `thumbs/`
//     sibling and records it in the (currently unused) `photos.thumb_url`
//     column, so grid views can request a lighter image than the full photo.
//
// Requires: npm install --save-dev sharp (already a devDependency)
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
// Matches STORAGE_MAX_PX / STORAGE_QUALITY in src/exif.js so repaired
// full-size images stay consistent with what normal uploads produce.
const STORAGE_MAX_PX = 2048
const STORAGE_QUALITY = 85

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

function isHeicName(filename) {
  return /\.(heic|heif)$/i.test(filename)
}

// Use macOS sips to convert HEIC (including HEVC-encoded) → JPEG
function heicBufferToJpeg(buffer) {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2)
  const inPath = join(tmpdir(), `hookspot_in_${ts}_${rand}.heic`)
  const outPath = join(tmpdir(), `hookspot_out_${ts}_${rand}.jpg`)
  try {
    writeFileSync(inPath, buffer)
    execSync(`sips -s format jpeg "${inPath}" --out "${outPath}"`, { stdio: 'pipe' })
    return readFileSync(outPath)
  } finally {
    try { unlinkSync(inPath) } catch {}
    try { unlinkSync(outPath) } catch {}
  }
}

async function resizeJpeg(jpegBuffer, maxPx, quality) {
  const img = sharp(jpegBuffer)
  const { width, height } = await img.metadata()
  const scale = Math.min(1, maxPx / Math.max(width, height))
  return img
    .resize(Math.round(width * scale), Math.round(height * scale))
    .jpeg({ quality })
    .toBuffer()
}

async function main() {
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, user_id, filename, storage_path, url, thumb_url')
    .not('url', 'is', null)
    .order('time', { ascending: false })

  if (error) { console.error('Failed to fetch photos:', error.message); process.exit(1) }
  console.log(`Checking ${photos.length} photos\n`)

  let repaired = 0, thumbed = 0, skippedOk = 0, missingObject = 0, fail = 0

  for (const photo of photos) {
    try {
      let res = await fetch(photo.url)
      // Some old HEIC files were stored with a .jpg extension via storageKey normalization
      if (!res.ok && isHeicName(photo.filename)) {
        res = await fetch(photo.url.replace(/\.(heic|heif)$/i, '.jpg'))
      }
      if (!res.ok) {
        if (res.status === 400 || res.status === 404) {
          missingObject++
          console.warn(`⚠ ${photo.filename}: object not found in storage (orphaned row, id=${photo.id})`)
          continue
        }
        throw new Error(`Download HTTP ${res.status}`)
      }
      const contentType = res.headers.get('content-type')
      const buffer = Buffer.from(await res.arrayBuffer())
      const needsRootFix = contentType === 'image/heic' || contentType === 'image/heif'
      const needsThumb = !photo.thumb_url

      if (!needsRootFix && !needsThumb) { skippedOk++; continue }

      // Decode HEIC once and reuse for both the root fix and the thumbnail.
      const jpegBuffer = (contentType === 'image/heic' || contentType === 'image/heif')
        ? heicBufferToJpeg(buffer)
        : buffer

      if (needsRootFix) {
        const storageBuffer = await resizeJpeg(jpegBuffer, STORAGE_MAX_PX, STORAGE_QUALITY)
        const { error: uploadError } = await supabase.storage
          .from('catches')
          .upload(photo.storage_path, storageBuffer, { upsert: true, contentType: 'image/jpeg' })
        if (uploadError) throw new Error('Root upload: ' + uploadError.message)
        console.log(`✓ repaired ${photo.filename}`)
        repaired++
      }

      if (needsThumb) {
        const thumbPath = thumbPathFromStorage(photo.storage_path, photo.user_id, photo.filename)
        const thumbBuffer = await resizeJpeg(jpegBuffer, THUMB_MAX_PX, THUMB_QUALITY)
        const { error: thumbUploadError } = await supabase.storage
          .from('catches')
          .upload(thumbPath, thumbBuffer, { upsert: true, contentType: 'image/jpeg' })
        if (thumbUploadError) throw new Error('Thumb upload: ' + thumbUploadError.message)

        const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(thumbPath)
        const { error: updateError } = await supabase
          .from('photos')
          .update({ thumb_url: publicUrl })
          .eq('id', photo.id)
        if (updateError) throw new Error('DB: ' + updateError.message)
        console.log(`✓ thumbnail ${photo.filename}`)
        thumbed++
      }
    } catch (err) {
      console.error(`✗ ${photo.filename}: ${err.message}`)
      fail++
    }
  }

  console.log(`\nDone: ${repaired} repaired, ${thumbed} thumbnails written, ${skippedOk} already fine, ${missingObject} orphaned rows (no storage object), ${fail} failed`)
}

main()
