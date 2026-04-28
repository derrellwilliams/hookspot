// Shared /identify request handler used by both the Vite dev proxy and the production server.
import Anthropic from '@anthropic-ai/sdk'
import { IDENTIFY_MODEL, IDENTIFY_PROMPT } from './identify-config.js'

export function createIdentifyHandler(anthropic) {
  return function handleIdentify(req, res) {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', async () => {
      const buf = Buffer.concat(chunks)
      const mediaType = (req.headers['content-type'] || 'image/jpeg').split(';')[0]
      try {
        const response = await anthropic.messages.create({
          model: IDENTIFY_MODEL,
          max_tokens: 64,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: buf.toString('base64') } },
              { type: 'text', text: IDENTIFY_PROMPT },
            ],
          }],
        })
        const species = response.content[0]?.text?.trim() ?? 'none'
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ species }))
      } catch (err) {
        console.error('[identify] error:', err.message)
        res.statusCode = err instanceof Anthropic.APIError ? err.status : 500
        res.end(JSON.stringify({ error: err.message }))
      }
    })
  }
}
