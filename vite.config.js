import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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
      },
    },
  ],
})
