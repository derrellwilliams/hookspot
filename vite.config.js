import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import Anthropic from '@anthropic-ai/sdk'
import { createIdentifyHandler } from './identify-handler.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'identify-proxy',
        configureServer(server) {
          const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
          server.middlewares.use('/identify', createIdentifyHandler(anthropic))
        },
      },
    ],
  }
})
