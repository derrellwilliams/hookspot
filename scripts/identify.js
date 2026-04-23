#!/usr/bin/env node
/**
 * Identify fish species in images using Claude.
 * Writes results to public/species.json.
 * Safe to re-run — skips already-identified images.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/identify.js
 */

import Anthropic from '@anthropic-ai/sdk'
import heicConvert from 'heic-convert'
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const imagesDir = resolve(__dirname, '../images')
const outputFile = resolve(__dirname, '../public/species.json')
const IMAGE_RE = /\.(heic|heif|png|jpg|jpeg)$/i

const client = new Anthropic()

// Load existing results so we can skip already-processed images
const results = existsSync(outputFile)
  ? JSON.parse(readFileSync(outputFile, 'utf8'))
  : {}

const allImages = readdirSync(imagesDir).filter(f => IMAGE_RE.test(f))
const pending = allImages.filter(f => !(f in results))

if (!pending.length) {
  console.log('All images already identified.')
  process.exit(0)
}

console.log(`Identifying ${pending.length} image(s) (${allImages.length - pending.length} already cached)...\n`)

for (const filename of pending) {
  const filepath = resolve(imagesDir, filename)
  const ext = extname(filename).toLowerCase()
  let imageBuffer = readFileSync(filepath)

  // Convert HEIC/HEIF to JPEG — Claude doesn't accept these formats natively
  if (ext === '.heic' || ext === '.heif') {
    try {
      imageBuffer = await heicConvert({ buffer: imageBuffer, format: 'JPEG', quality: 0.8 })
    } catch {
      // File may already be JPEG/PNG with a .HEIC extension — send as-is
    }
  }

  const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg'
  const imageData = Buffer.from(imageBuffer).toString('base64')

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageData },
          },
          {
            type: 'text',
            text: 'Is there a fish in this photo? If yes, identify the species as specifically as possible. If no fish is visible, reply with "none". Reply with only the species name or "none" — no other text.',
          },
        ],
      }],
    })

    const species = response.content[0].text.trim()
    results[filename] = species
    console.log(`  ${filename}: ${species}`)
  } catch (err) {
    console.error(`  ${filename}: ERROR — ${err.message}`)
    results[filename] = null
  }

  // Write after each image so progress is saved if interrupted
  writeFileSync(outputFile, JSON.stringify(results, null, 2))
}

console.log(`\nDone. Results saved to public/species.json`)
