import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import Anthropic from '@anthropic-ai/sdk'
import { createIdentifyHandler } from './identify-handler.js'
import { createCheckUsernameHandler } from './check-username-handler.js'
import { createSaveProfileHandler } from './save-profile-handler.js'
import { createProfileHandler } from './profile-handler.js'
import { createPhotosHandler } from './photos-handler.js'
import { createSearchUsersHandler } from './search-users-handler.js'
import { createSearchCatchesHandler } from './search-catches-handler.js'
import { createKeepAliveHandler } from './keep-alive-handler.js'
import { buildCatchMeta, parseCatchShareUrl, injectMeta } from './catch-meta-handler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'api-handlers',
        configureServer(server) {
          const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
          server.middlewares.use('/identify', createIdentifyHandler(anthropic, env))
          server.middlewares.use('/api/check-username', createCheckUsernameHandler(env))
          server.middlewares.use('/api/save-profile', createSaveProfileHandler(env))
          server.middlewares.use('/api/profile', createProfileHandler(env))
          server.middlewares.use('/api/photos', createPhotosHandler(env))
          server.middlewares.use('/api/search-users', createSearchUsersHandler(env))
          server.middlewares.use('/api/search-catches', createSearchCatchesHandler(env))
          server.middlewares.use('/api/keep-alive', createKeepAliveHandler(env))

          // Shared catch links (`/user/:username?catch=<id>`) need real OG
          // meta tags for iMessage/Slack/etc. link previews — everything
          // else stays the plain SPA shell, so this only intercepts that
          // one query-param shape and falls through otherwise.
          server.middlewares.use(async (req, res, next) => {
            if (req.method !== 'GET') return next()
            const url = new URL(req.url, 'http://localhost')
            const parsed = parseCatchShareUrl(url.pathname, url.searchParams)
            if (!parsed) return next()
            try {
              const meta = await buildCatchMeta(env, parsed.username, parsed.catchParam)
              if (!meta) return next()
              const proto = req.headers['x-forwarded-proto'] || 'http'
              meta.url = `${proto}://${req.headers.host}${url.pathname}${url.search}`
              const raw = await fs.promises.readFile(path.resolve(__dirname, 'index.html'), 'utf-8')
              const transformed = await server.transformIndexHtml(req.url, raw)
              res.statusCode = 200
              res.setHeader('content-type', 'text/html; charset=utf-8')
              res.end(injectMeta(transformed, meta))
            } catch (err) {
              console.error('[catch-meta] error:', err.message)
              next()
            }
          })
        },
      },
    ],
  }
})
