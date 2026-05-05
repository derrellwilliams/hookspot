import { serviceHeaders, sendJson } from './handler-utils.js'

export function createPhotosHandler(env) {
  return async function handlePhotos(req, res) {
    if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
    const url = new URL(req.url, 'http://localhost')
    const userId = url.searchParams.get('userId')
    if (!userId) { sendJson(res, { error: 'userId required' }, 400); return }
    const headers = serviceHeaders(env)
    try {
      // Fetch the list of users this person follows
      const followsRes = await fetch(
        `${env.VITE_SUPABASE_URL}/rest/v1/follows?select=following_id&follower_id=eq.${encodeURIComponent(userId)}`,
        { headers }
      )
      if (!followsRes.ok) throw new Error(`Supabase follows error: ${followsRes.status}`)
      const follows = await followsRes.json()
      const followingIds = Array.isArray(follows) ? follows.map(f => f.following_id) : []

      // Fetch photos from self + followed users
      const allUserIds = [userId, ...followingIds]
      const idFilter = `user_id=in.(${allUserIds.map(encodeURIComponent).join(',')})`
      const photosRes = await fetch(
        `${env.VITE_SUPABASE_URL}/rest/v1/photos?select=*&${idFilter}&order=time.desc&limit=500`,
        { headers }
      )
      if (!photosRes.ok) throw new Error(`Supabase error: ${photosRes.status}`)
      const rows = await photosRes.json()
      if (!Array.isArray(rows) || !rows.length) {
        sendJson(res, { rows: [], profiles: [] })
        return
      }
      const userIds = [...new Set(rows.map(r => r.user_id))]
      const profilesRes = await fetch(
        `${env.VITE_SUPABASE_URL}/rest/v1/profiles?select=id,username,display_name,avatar_url&id=in.(${userIds.map(encodeURIComponent).join(',')})`,
        { headers }
      )
      if (!profilesRes.ok) throw new Error(`Supabase profiles error: ${profilesRes.status}`)
      const profiles = await profilesRes.json()
      sendJson(res, { rows, profiles: Array.isArray(profiles) ? profiles : [] })
    } catch (err) {
      console.error('[photos] error:', err.message)
      sendJson(res, { error: err.message }, 500)
    }
  }
}
