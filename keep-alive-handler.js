import { serviceHeaders, sendJson } from './handler-utils.js'

// Vercel Cron hits this on a schedule so Supabase sees API activity and
// never auto-pauses the free-tier project for inactivity.
export function createKeepAliveHandler(env) {
  return async function handleKeepAlive(req, res) {
    if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
    try {
      const response = await fetch(
        `${env.VITE_SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`,
        { headers: serviceHeaders(env) }
      )
      if (!response.ok) throw new Error(`Supabase error: ${response.status}`)
      sendJson(res, { ok: true, pinged: new Date().toISOString() })
    } catch (err) {
      console.error('[keep-alive] error:', err.message)
      sendJson(res, { error: err.message }, 500)
    }
  }
}
