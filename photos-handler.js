import { serviceHeaders, sendJson } from './handler-utils.js'

export function createPhotosHandler(env) {
  return async function handlePhotos(req, res) {
    if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
    const url = new URL(req.url, 'http://localhost')
    const userId = url.searchParams.get('userId')
    const ownOnly = url.searchParams.get('ownOnly') === 'true'
    if (!userId) { sendJson(res, { error: 'userId required' }, 400); return }
    const headers = serviceHeaders(env)
    try {
      let allUserIds = [userId]
      if (!ownOnly) {
        // Fetch the list of users this person follows (feed mode)
        const followsRes = await fetch(
          `${env.VITE_SUPABASE_URL}/rest/v1/follows?select=following_id&follower_id=eq.${encodeURIComponent(userId)}`,
          { headers }
        )
        if (!followsRes.ok) throw new Error(`Supabase follows error: ${followsRes.status}`)
        const follows = await followsRes.json()
        const followingIds = Array.isArray(follows) ? follows.map(f => f.following_id) : []
        allUserIds = [userId, ...followingIds].slice(0, 100)
      }

      const idFilter = `user_id=in.(${allUserIds.map(encodeURIComponent).join(',')})`
      const photosRes = await fetch(
        `${env.VITE_SUPABASE_URL}/rest/v1/photos?select=*&${idFilter}&order=time.desc&limit=500`,
        { headers }
      )
      if (!photosRes.ok) throw new Error(`Supabase error: ${photosRes.status}`)
      let rows = await photosRes.json()
      if (!Array.isArray(rows) || !rows.length) {
        sendJson(res, { rows: [], profiles: [] })
        return
      }

      // Backfill time and/or lat/lng from catches for photos missing either field.
      // Null time happens when EXIF has GPS but no timestamp (old data).
      // Null lat/lng happens when a secondary photo had no EXIF GPS and the catch
      // coordinates weren't propagated (old data, fixed in upload flow).
      const needsCatchData = [...new Set(
        rows.filter(r => (!r.time || !r.lat) && r.catch_id).map(r => r.catch_id)
      )]
      if (needsCatchData.length > 0) {
        const catchesRes = await fetch(
          `${env.VITE_SUPABASE_URL}/rest/v1/catches?select=id,time,lat,lng&id=in.(${needsCatchData.join(',')})`,
          { headers }
        )
        if (catchesRes.ok) {
          const catches = await catchesRes.json()
          if (Array.isArray(catches) && catches.length) {
            const catchMap = Object.fromEntries(catches.map(c => [c.id, c]))
            rows = rows.map(r => {
              if (!r.catch_id || !catchMap[r.catch_id]) return r
              const c = catchMap[r.catch_id]
              const patch = {}
              if (!r.time && c.time) patch.time = c.time
              if (!r.lat && c.lat) { patch.lat = c.lat; patch.lng = c.lng }
              return Object.keys(patch).length ? { ...r, ...patch } : r
            })
          }
        }
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
