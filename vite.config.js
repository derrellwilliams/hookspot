import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'identify-proxy',
        configureServer(server) {
          server.middlewares.use('/identify', async (req, res) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
            const chunks = []
            req.on('data', c => chunks.push(c))
            req.on('end', async () => {
              const buf = Buffer.concat(chunks)
              const base64 = buf.toString('base64')
              const mediaType = (req.headers['content-type'] || 'image/jpeg').split(';')[0]
              try {
                const r = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'x-api-key': env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 64,
                    messages: [{
                      role: 'user',
                      content: [
                        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
                        { type: 'text', text: 'Is there a fish in this photo? If yes, identify the species as specifically as possible. If no fish is visible, reply with "none". Reply with only the species name or "none" — no other text.' },
                      ],
                    }],
                  }),
                })
                const data = await r.json()
                if (!r.ok) {
                  console.error('[identify] Anthropic error', r.status, JSON.stringify(data))
                  res.statusCode = 500; res.end(JSON.stringify({ error: data.error?.message ?? 'API error' })); return
                }
                const species = data.content?.[0]?.text?.trim() ?? 'none'
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify({ species }))
              } catch (e) {
                console.error('[identify] fetch error:', e.message)
                res.statusCode = 500; res.end(JSON.stringify({ error: e.message }))
              }
            })
          })
        },
      },
    ],
  }
})
