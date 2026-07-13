import { serviceHeaders, sendJson } from './handler-utils.js'

// Searches everyone's catch photos by species / rod / fly / location (water body,
// city, state) text and date range.
// GET /api/search-catches?q=<text>&userId=<uuid>&mine=true|false&from=YYYY-MM-DD&to=YYYY-MM-DD
// → { rows, profiles } (same shape as /api/photos)
//
// NOTE: `mine` trusts the userId param. Fine while all photos/profiles are
// public; a future privacy model must derive the caller from the auth token.
export function createSearchCatchesHandler(env) {
  return async function handleSearchCatches(req, res) {
    if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
    const url = new URL(req.url, 'http://localhost')
    // Commas/parens/percent break the PostgREST or=() filter grammar
    const q = (url.searchParams.get('q') || '').replace(/[,()%]/g, '').trim()
    const userId = url.searchParams.get('userId')
    const mine = url.searchParams.get('mine') === 'true'
    // from/to come from <input type="date">; reject anything that isn't a
    // plain date so it can't break out of the and=() filter grammar below.
    const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v)
    const fromRaw = url.searchParams.get('from')
    const toRaw = url.searchParams.get('to')
    const from = isDate(fromRaw) ? fromRaw : null
    const to = isDate(toRaw) ? toRaw : null
    if (!q && !from && !to) { sendJson(res, { rows: [], profiles: [] }); return }
    const headers = serviceHeaders(env)
    try {
      const params = ['select=*', 'order=time.desc', 'limit=301']
      if (q) {
        params.push(`or=${encodeURIComponent(`(species.ilike.*${q}*,meta->>rod.ilike.*${q}*,meta->>fly.ilike.*${q}*,meta->waterBody->>name.ilike.*${q}*,meta->location->>city.ilike.*${q}*,meta->location->>state.ilike.*${q}*)`)}`)
      }
      if (mine && userId) params.push(`user_id=eq.${encodeURIComponent(userId)}`)
      const timeFilters = []
      if (from) timeFilters.push(`time.gte.${from}T00:00:00`)
      if (to) timeFilters.push(`time.lte.${to}T23:59:59`)
      if (timeFilters.length) params.push(`and=${encodeURIComponent(`(${timeFilters.join(',')})`)}`)

      const photosRes = await fetch(
        `${env.VITE_SUPABASE_URL}/rest/v1/photos?${params.join('&')}`,
        { headers }
      )
      if (!photosRes.ok) throw new Error(`Supabase error: ${photosRes.status}`)
      let rows = await photosRes.json()
      if (!Array.isArray(rows) || !rows.length) {
        sendJson(res, { rows: [], profiles: [] })
        return
      }
      // limit=301 above fetches one past the 300 cap so we can tell "exactly
      // 300 matches" apart from "more than 300 exist" and surface that to the
      // client instead of implying there's nothing more to load.
      const truncated = rows.length > 300
      if (truncated) rows = rows.slice(0, 300)

      // Pull in sibling photos of matched catches so the carousel shows the
      // whole catch, not just the photo that matched the text filter.
      const catchIds = [...new Set(rows.filter(r => r.catch_id).map(r => r.catch_id))]
      if (catchIds.length > 0) {
        const siblingsRes = await fetch(
          `${env.VITE_SUPABASE_URL}/rest/v1/photos?select=*&catch_id=in.(${catchIds.join(',')})`,
          { headers }
        )
        if (siblingsRes.ok) {
          const siblings = await siblingsRes.json()
          if (Array.isArray(siblings)) {
            const seen = new Set(rows.map(r => r.id))
            rows = [...rows, ...siblings.filter(s => !seen.has(s.id))]
          }
        }
      }
      // No time/lat backfill from the catches table here (unlike /api/photos):
      // rows with null time just sort last and never match date filters.

      const userIds = [...new Set(rows.map(r => r.user_id))]
      const profilesRes = await fetch(
        `${env.VITE_SUPABASE_URL}/rest/v1/profiles?select=id,username,display_name,avatar_url&id=in.(${userIds.map(encodeURIComponent).join(',')})`,
        { headers }
      )
      if (!profilesRes.ok) throw new Error(`Supabase profiles error: ${profilesRes.status}`)
      const profiles = await profilesRes.json()
      sendJson(res, { rows, profiles: Array.isArray(profiles) ? profiles : [], truncated })
    } catch (err) {
      console.error('[search-catches] error:', err.message)
      sendJson(res, { error: err.message }, 500)
    }
  }
}
