import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

// Fetches the profiles a user follows (tab = 'following') or is followed by
// (tab = 'followers'), with a two-query fallback if join disambiguation fails.
export function useFollowList(profileId, tab) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!profileId) { setList([]); return }
    let cancelled = false
    setLoading(true)
    setList([])
    ;(async () => {
      try {
        const col = tab === 'followers' ? 'following_id' : 'follower_id'
        const joinCol = tab === 'followers' ? 'follower_id' : 'following_id'
        const { data, error } = await supabase
          .from('follows')
          .select(`profiles!${joinCol}(id,username,display_name,avatar_url)`)
          .eq(col, profileId)
        if (cancelled) return
        if (!error && data) {
          setList(data.map(r => r.profiles).filter(Boolean))
        } else {
          const idsRes = await supabase.from('follows').select(joinCol).eq(col, profileId)
          const ids = (idsRes.data || []).map(r => r[joinCol])
          if (ids.length > 0) {
            const profilesRes = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', ids)
            if (!cancelled) setList(profilesRes.data || [])
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [profileId, tab])

  return { list, loading }
}
