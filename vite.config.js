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
        },
      },
    ],
  }
})
