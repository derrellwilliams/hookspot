/**
 * Production server for Hook Spot.
 * Handles the /identify API endpoint and serves the Vite build from dist/.
 *
 * Usage:
 *   npm run build
 *   node server.js          (uses ANTHROPIC_API_KEY from environment)
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { createIdentifyHandler } from './identify-handler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const PORT = process.env.PORT || 3000

// Startup check — synchronous here is fine (runs once before the server listens)
if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run "npm run build" first')
  process.exit(1)
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const handleIdentify = createIdentifyHandler(anthropic)

const MIME = {
  '.html':        'text/html; charset=utf-8',
  '.js':          'application/javascript',
  '.css':         'text/css',
  '.png':         'image/png',
  '.jpg':         'image/jpeg',
  '.webp':        'image/webp',
  '.svg':         'image/svg+xml',
  '.ico':         'image/x-icon',
  '.woff2':       'font/woff2',
  '.woff':        'font/woff',
  '.ttf':         'font/ttf',
  '.otf':         'font/otf',
  '.json':        'application/json',
  '.webmanifest': 'application/manifest+json',
  '.map':         'application/json',
}

const server = http.createServer(async (req, res) => {
  // POST /identify — species identification via Anthropic API
  if (req.method === 'POST' && req.url === '/identify') {
    handleIdentify(req, res)
    return
  }

  // Static file serving with SPA history fallback
  const urlPath = req.url.split('?')[0]
  let filePath = path.resolve(DIST, '.' + urlPath)

  // Prevent path traversal
  if (!filePath.startsWith(DIST + path.sep) && filePath !== DIST) {
    res.statusCode = 403; res.end(); return
  }

  // Async stat — fall back to index.html for SPA routes
  let stat
  try { stat = await fs.promises.stat(filePath) } catch { /* file not found */ }
  if (!stat || stat.isDirectory()) filePath = path.join(DIST, 'index.html')

  const ext = path.extname(filePath)
  res.setHeader('content-type', MIME[ext] || 'application/octet-stream')

  const stream = fs.createReadStream(filePath)
  stream.on('error', (err) => {
    console.error('[server] stream error:', err.message)
    if (!res.headersSent) { res.statusCode = 500; res.end() }
  })
  stream.pipe(res)
})

server.listen(PORT, () => {
  console.log(`Hook Spot running at http://localhost:${PORT}`)
})
