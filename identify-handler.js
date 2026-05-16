// Shared /identify request handler used by both the Vite dev proxy and the production server.
import Anthropic from '@anthropic-ai/sdk'
import { IDENTIFY_MODEL, IDENTIFY_PROMPT } from './identify-config.js'

const MAX_BODY_SIZE = 4 * 1024 * 1024 // 4 MB

export function createIdentifyHandler(anthropic, env) {
  return async function handleIdentify(req, res) {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }

    // Verify the caller holds a valid Supabase session
    if (env?.VITE_SUPABASE_URL && env?.SUPABASE_SERVICE_ROLE_KEY) {
      const auth = req.headers.authorization
      if (!auth?.startsWith('Bearer ')) {
        res.statusCode = 401; res.end(JSON.stringify({ error: 'Unauthorized' })); return
      }
      const userRes = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: auth },
      })
      if (!userRes.ok) {
        res.statusCode = 401; res.end(JSON.stringify({ error: 'Unauthorized' })); return
      }
    }

    // Read body with a hard size cap to prevent memory exhaustion
    const chunks = []
    let totalSize = 0
    try {
      await new Promise((resolve, reject) => {
        req.on('data', c => {
          totalSize += c.length
          if (totalSize > MAX_BODY_SIZE) {
            res.statusCode = 413; res.end(JSON.stringify({ error: 'Payload too large' }))
            req.destroy(); reject(new Error('too large')); return
          }
          chunks.push(c)
        })
        req.on('end', resolve)
        req.on('error', reject)
      })
    } catch { return }

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
  }
}
