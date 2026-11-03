// Shared /identify request handler used by both the Vite dev proxy and the production server.
import Anthropic from '@anthropic-ai/sdk'
import { buildIdentifyRequest, extractSpecies } from './identify-config.js'
import { readBody, sendJson, serviceHeaders } from './handler-utils.js'

const MAX_BODY_SIZE = 4 * 1024 * 1024 // 4 MB
const DAILY_LIMIT = 100 // identify calls per user per UTC day

export function createIdentifyHandler(anthropic, env) {
  return async function handleIdentify(req, res) {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }

    // Fail closed: without Supabase config there's no way to check the caller
    if (!env?.VITE_SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
      sendJson(res, { error: 'Server misconfigured' }, 500); return
    }

    // Verify the caller holds a valid Supabase session
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) { sendJson(res, { error: 'Unauthorized' }, 401); return }
    const userRes = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: auth },
    })
    if (!userRes.ok) { sendJson(res, { error: 'Unauthorized' }, 401); return }
    const { id: userId } = await userRes.json()

    // Per-user daily cap so one account can't run up the Anthropic bill
    // (migration 007). Counted before the call, so failed calls count too.
    const usageRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/bump_identify_usage`, {
      method: 'POST',
      headers: serviceHeaders(env, true),
      body: JSON.stringify({ uid: userId }),
    })
    if (!usageRes.ok) { sendJson(res, { error: 'Rate limit check failed' }, 503); return }
    if (await usageRes.json() > DAILY_LIMIT) { sendJson(res, { error: 'Daily identify limit reached' }, 429); return }

    // Read body with a hard size cap to prevent memory exhaustion
    const buf = await readBody(req, res, MAX_BODY_SIZE)
    if (buf === null) return
    const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const rawMediaType = (req.headers['content-type'] || 'image/jpeg').split(';')[0].trim()
    const mediaType = ALLOWED_MEDIA_TYPES.includes(rawMediaType) ? rawMediaType : 'image/jpeg'
    const base64Data = buf.toString('base64')
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
