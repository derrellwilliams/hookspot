import { defineConfig } from 'vite'
import { readdirSync, createReadStream, statSync, createWriteStream, unlinkSync } from 'fs'
import { resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const MIME = { '.heic': 'image/heic', '.heif': 'image/heif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }
function lookup(f) { return MIME[extname(f).toLowerCase()] }

const __dirname = dirname(fileURLToPath(import.meta.url))
const imagesDir = resolve(__dirname, 'images')
const IMAGE_RE = /\.(heic|heif|png|jpg|jpeg|gif|webp)$/i

export default defineConfig({
  plugins: [
    {
      name: 'image-manifest',

      resolveId(id) {
        if (id === 'virtual:images') return '\0virtual:images'
      },
      load(id) {
        if (id !== '\0virtual:images') return
        const files = readdirSync(imagesDir).filter(f => IMAGE_RE.test(f))
        return `export default ${JSON.stringify(files)}`
      },

      configureServer(server) {
        // Proxy /identify → Anthropic API (keeps key server-side)
        server.middlewares.use('/identify', async (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
          const chunks = []
          req.on('data', c => chunks.push(c))
          req.on('end', async () => {
            const base64 = Buffer.concat(chunks).toString('base64')
            try {
              const r = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'x-api-key': process.env.ANTHROPIC_API_KEY,
                  'anthropic-version': '2023-06-01',
                  'content-type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'claude-haiku-4-5-20251001',
                  max_tokens: 64,
                  messages: [{
                    role: 'user',
                    content: [
                      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
                      { type: 'text', text: 'Is there a fish in this photo? If yes, identify the species as specifically as possible. If no fish is visible, reply with "none". Reply with only the species name or "none" — no other text.' },
                    ],
                  }],
                }),
              })
              const data = await r.json()
              const species = data.content?.[0]?.text?.trim() ?? 'none'
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ species }))
            } catch (e) {
              res.statusCode = 500; res.end(JSON.stringify({ error: e.message }))
            }
          })
        })

        // Serve /images/* from the images directory
        server.middlewares.use('/images', (req, res, next) => {
          const safe = (filepath) => filepath.startsWith(imagesDir + '/')

          if (req.method === 'DELETE') {
            const filename = decodeURIComponent(req.url.replace(/^\//, '').split('?')[0])
            if (!filename) { res.statusCode = 400; res.end(); return }
            const filepath = resolve(imagesDir, filename)
            if (!safe(filepath)) { res.statusCode = 400; res.end('Bad path'); return }
            try {
              unlinkSync(filepath)
              const mod = server.moduleGraph.getModuleById('\0virtual:images')
              if (mod) server.moduleGraph.invalidateModule(mod)
              res.statusCode = 200; res.end('ok')
            } catch { res.statusCode = 500; res.end('error') }
            return
          }

          if (req.method === 'POST') {
            const filename = decodeURIComponent(req.headers['x-filename'] || '')
            if (!filename || !IMAGE_RE.test(filename)) {
              res.statusCode = 400; res.end('Bad filename'); return
            }
            const dest = resolve(imagesDir, filename)
            if (!safe(dest)) { res.statusCode = 400; res.end('Bad path'); return }
            const out = createWriteStream(dest)
            req.pipe(out)
            out.on('finish', () => {
              // Invalidate virtual module so HMR picks up the new file
              const mod = server.moduleGraph.getModuleById('\0virtual:images')
              if (mod) server.moduleGraph.invalidateModule(mod)
              server.hot.send({ type: 'full-reload' })
              res.statusCode = 200; res.end('ok')
            })
            out.on('error', () => { res.statusCode = 500; res.end('error') })
            return
          }

          const filename = decodeURIComponent(req.url.replace(/^\//, '').split('?')[0])
          if (!filename) return next()
          const filepath = resolve(imagesDir, filename)
          if (!safe(filepath)) return next()
          let stat
          try { stat = statSync(filepath) } catch { return next() }
          if (!stat.isFile()) return next()

          const mime = lookup(filename) || 'application/octet-stream'
          res.setHeader('Content-Type', mime)
          res.setHeader('Content-Length', stat.size)
          createReadStream(filepath).pipe(res)
        })
      },
    },
  ],
})
