#!/usr/bin/env node
/**
 * Identify fish species for all photos in Supabase without a species set.
 * Updates each photo row in the DB directly.
 *
 * Usage: npm run identify
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import heicConvert from 'heic-convert'
import { IDENTIFY_MODEL, IDENTIFY_PROMPT } from '../identify-config.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const { data: photos, error } = await supabase
  .from('photos')
  .select('id, filename, url, storage_path')
  .or('species.is.null,species.eq.none')

if (error) { console.error('Failed to fetch photos:', error.message); process.exit(1) }
if (!photos?.length) { console.log('All photos already identified.'); process.exit(0) }

console.log(`Identifying ${photos.length} photo(s)...\n`)

for (const photo of photos) {
  try {
    const { data: fileData, error: dlError } = await supabase.storage
      .from('catches')
      .download(photo.storage_path)
    if (dlError || !fileData) { console.error(`  ${photo.filename}: download failed — ${dlError?.message}`); continue }

    let buffer = Buffer.from(await fileData.arrayBuffer())

    if (/\.(heic|heif)$/i.test(photo.filename)) {
      try { buffer = await heicConvert({ buffer, format: 'JPEG', quality: 0.8 }) } catch {}
    }

    const mediaType = /\.png$/i.test(photo.filename) ? 'image/png' : 'image/jpeg'

    const response = await anthropic.messages.create({
      model: IDENTIFY_MODEL,
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
          { type: 'text', text: IDENTIFY_PROMPT },
        ],
      }],
    })

    const species = response.content[0].text.trim()
    if (species && species !== 'none') {
      await supabase.from('photos').update({ species }).eq('id', photo.id)
    }
    console.log(`  ${photo.filename}: ${species}`)
  } catch (err) {
    console.error(`  ${photo.filename}: ERROR — ${err.message}`)
  }
}

console.log('\nDone.')
