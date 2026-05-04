import { serviceHeaders, sendJson } from './handler-utils.js'
import { USERNAME_RE } from './src/lib/validation.js'

export function createCheckUsernameHandler(env) {
  return async function handleCheckUsername(req, res) {
    if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
    const url = new URL(req.url, 'http://localhost')
    const username = url.searchParams.get('username')
    if (!username) { sendJson(res, { error: 'username required' }, 400); return }
    if (!USERNAME_RE.test(username)) { sendJson(res, { available: false }); return }
    try {
      const response = await fetch(
        `${env.VITE_SUPABASE_URL}/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(username)}&limit=1`,
        { headers: serviceHeaders(env) }
      )
      if (!response.ok) throw new Error(`Supabase error: ${response.status}`)
      const data = await response.json()
      sendJson(res, { available: Array.isArray(data) && data.length === 0 })
    } catch (err) {
      console.error('[check-username] error:', err.message)
      sendJson(res, { error: err.message }, 500)
    }
  }
}
