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
import { parseCatchShareUrl, renderCatchShare } from './catch-meta-handler.js'

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

          // Shared catch links (`/user/:username?catch=<id>`) need real OG
          // meta tags for iMessage/Slack/etc. link previews — everything
          // else stays the plain SPA shell, so this only intercepts that
          // one query-param shape and falls through otherwise.
          server.middlewares.use(async (req, res, next) => {
            if (req.method !== 'GET') return next()
            const url = new URL(req.url, 'http://localhost')
            if (!parseCatchShareUrl(url.pathname, url.searchParams)) return next()
            try {
              const raw = await fs.promises.readFile(path.resolve(__dirname, 'index.html'), 'utf-8')
              const transformed = await server.transformIndexHtml(req.url, raw)
              const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
              const html = await renderCatchShare(env, transformed, { pathname: url.pathname, searchParams: url.searchParams, origin })
              if (!html) return next()
              res.statusCode = 200
              res.setHeader('content-type', 'text/html; charset=utf-8')
              res.end(html)
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
