// Shared /identify request handler used by both the Vite dev proxy and the production server.
import Anthropic from '@anthropic-ai/sdk'
import { buildIdentifyRequest, extractSpecies } from './identify-config.js'
import { readBody } from './handler-utils.js'

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
    const buf = await readBody(req, res, MAX_BODY_SIZE)
    if (buf === null) return
    const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const rawMediaType = (req.headers['content-type'] || 'image/jpeg').split(';')[0].trim()
    const mediaType = ALLOWED_MEDIA_TYPES.includes(rawMediaType) ? rawMediaType : 'image/jpeg'
    // Mobile clients send pre-encoded base64 (avoids Blob API incompatibility in React Native)
    const base64Data = req.headers['x-content-encoding'] === 'base64'
      ? buf.toString('utf8').trim()
      : buf.toString('base64')
    try {
      const response = await anthropic.beta.messages.create(buildIdentifyRequest(mediaType, base64Data))
      const species = extractSpecies(response)
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ species }))
    } catch (err) {
      console.error('[identify] error:', err.message)
      res.statusCode = err instanceof Anthropic.APIError ? err.status : 500
      res.end(JSON.stringify({ error: err.message }))
    }
  }
}
