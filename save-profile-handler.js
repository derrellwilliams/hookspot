import { serviceHeaders, sendJson } from './handler-utils.js'
import { USERNAME_RE } from './src/lib/validation.js'

export function createSaveProfileHandler(env) {
  return async function handleSaveProfile(req, res) {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }

    try {
      const chunks = []
      await new Promise(resolve => { req.on('data', c => chunks.push(c)); req.on('end', resolve) })
      const { token, username, displayName, bio, avatarUrl } = JSON.parse(Buffer.concat(chunks).toString())

      if (!token) { sendJson(res, { error: 'Unauthorized' }, 401); return }
      if (!USERNAME_RE.test(username)) { sendJson(res, { error: 'Invalid username' }, 400); return }

      // Verify token and get user ID
      const userRes = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
      })
      const userData = await userRes.json()
      if (!userRes.ok) throw new Error(userData.message || 'Invalid token')
      const userId = userData.id

      const updateData = {}
      if (displayName) updateData.display_name = displayName
      if (bio) updateData.bio = bio
      if (avatarUrl) updateData.avatar_url = avatarUrl

      // Upsert profile and update auth metadata in parallel
      const jsonHeaders = serviceHeaders(env, true)
      const tasks = [
        fetch(`${env.VITE_SUPABASE_URL}/rest/v1/profiles`, {
          method: 'POST',
          headers: { ...jsonHeaders, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ id: userId, username, display_name: displayName || null, avatar_url: avatarUrl || null, bio: bio || null }),
        }),
      ]
      if (Object.keys(updateData).length > 0) {
        tasks.push(fetch(`${env.VITE_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify({ user_metadata: updateData }),
        }))
      }

      const [profileRes, metaRes] = await Promise.all(tasks)
      if (!profileRes.ok) {
        const err = await profileRes.json()
        throw new Error(err.message || 'Profile save failed')
      }
      if (metaRes && !metaRes.ok) {
        const err = await metaRes.json()
        throw new Error(err.message || 'Metadata update failed')
      }

      sendJson(res, { user: { id: userId, user_metadata: updateData } })
    } catch (err) {
      console.error('[save-profile] error:', err.message)
      sendJson(res, { error: err.message }, 500)
    }
  }
}
