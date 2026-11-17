import { serviceHeaders, sendJson, searchPattern } from './handler-utils.js'

export function createSearchUsersHandler(env) {
  return async function handleSearchUsers(req, res) {
    if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
    const url = new URL(req.url, 'http://localhost')
    const q = url.searchParams.get('q')
    if (!q || q.trim().length === 0) { sendJson(res, { results: [] }); return }
    if (q.length > 200) { sendJson(res, { error: 'Invalid search query' }, 400); return }
    try {
      const filter = encodeURIComponent(`(username.ilike.${searchPattern(q.trim())},display_name.ilike.${searchPattern(q.trim())})`)
      const response = await fetch(
        `${env.VITE_SUPABASE_URL}/rest/v1/profiles?select=id,username,display_name,avatar_url&or=${filter}&limit=20`,
        { headers: serviceHeaders(env) }
      )
      if (!response.ok) throw new Error(`Supabase error: ${response.status}`)
      const data = await response.json()
      sendJson(res, { results: Array.isArray(data) ? data : [] })
    } catch (err) {
      console.error('[search-users] error:', err.message)
      sendJson(res, { error: err.message }, 500)
    }
  }
}
