/**
 * Production server for Hook Spot.
 * Handles API endpoints and serves the Vite build from dist/.
 *
 * Usage:
 *   npm run build
 *   node server.js          (uses env vars from environment)
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { createIdentifyHandler } from './identify-handler.js'
import { createSaveProfileHandler } from './save-profile-handler.js'
import { createProfileHandler } from './profile-handler.js'
import { createPhotosHandler } from './photos-handler.js'
import { createCheckUsernameHandler } from './check-username-handler.js'
import { createSearchUsersHandler } from './search-users-handler.js'
import { buildCatchMeta, parseCatchShareUrl, injectMeta } from './catch-meta-handler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const PORT = process.env.PORT || 3000

// Startup check — synchronous here is fine (runs once before the server listens)
if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run "npm run build" first')
  process.exit(1)
}

const env = process.env
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
const handleIdentify = createIdentifyHandler(anthropic, env)
const handleSaveProfile = createSaveProfileHandler(env)
const handleProfile = createProfileHandler(env)
const handlePhotos = createPhotosHandler(env)
const handleCheckUsername = createCheckUsernameHandler(env)
const handleSearchUsers = createSearchUsersHandler(env)
const INDEX_HTML = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8')

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
  const urlPath = req.url.split('?')[0]

  // API routes
  if (urlPath === '/identify') { handleIdentify(req, res); return }
  if (urlPath === '/api/save-profile') { handleSaveProfile(req, res); return }
  if (urlPath === '/api/profile') { handleProfile(req, res); return }
  if (urlPath === '/api/photos') { handlePhotos(req, res); return }
  if (urlPath === '/api/check-username') { handleCheckUsername(req, res); return }
  if (urlPath === '/api/search-users') { handleSearchUsers(req, res); return }

  // Shared catch links (`/user/:username?catch=<id>`) get real OG meta tags
  // injected into the SPA shell so iMessage/Slack/etc. previews show the
  // catch photo — everything else falls through to the static file serving
  // below unchanged.
  if (urlPath.startsWith('/user/')) {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const parsed = parseCatchShareUrl(url.pathname, url.searchParams)
    if (parsed) {
      try {
        const meta = await buildCatchMeta(env, parsed.username, parsed.catchParam)
        if (meta) {
          const proto = req.headers['x-forwarded-proto'] || 'https'
          meta.url = `${proto}://${req.headers.host}${url.pathname}${url.search}`
          res.statusCode = 200
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.end(injectMeta(INDEX_HTML, meta))
          return
        }
      } catch (err) {
        console.error('[catch-meta] error:', err.message)
      }
    }
  }

  // Static file serving with SPA history fallback
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
