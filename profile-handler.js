import { serviceHeaders, sendJson } from './handler-utils.js'

export function createProfileHandler(env) {
  return async function handleProfile(req, res) {
    if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
    const url = new URL(req.url, 'http://localhost')
    const userId = url.searchParams.get('userId')
    if (!userId) { sendJson(res, { error: 'userId required' }, 400); return }
    try {
      const response = await fetch(
        `${env.VITE_SUPABASE_URL}/rest/v1/profiles?select=username&id=eq.${encodeURIComponent(userId)}&limit=1`,
        { headers: serviceHeaders(env) }
      )
      if (!response.ok) throw new Error(`Supabase error: ${response.status}`)
      const data = await response.json()
      sendJson(res, { username: data[0]?.username ?? null })
    } catch (err) {
      console.error('[profile] error:', err.message)
      sendJson(res, { error: err.message }, 500)
    }
  }
}
