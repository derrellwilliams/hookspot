import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { initPhotos } from '../lib/fileLoader.js'
import styles from './UserProfilePage.module.css'


export function UserProfilePage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const myUser = useAuthStore(s => s.user)
  const removeUserPhotos = usePhotoStore(s => s.removeUserPhotos)
  const showToast = usePhotoStore(s => s.showToast)

  const [profile, setProfile] = useState(null)
  const [catchCount, setCatchCount] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState(null)

  const isOwnProfile = profile?.id === myUser?.id

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (profileError || !profileData) {
        setError('Profile not found')
        return
      }

      setProfile(profileData)

      const [followResult, countResult] = await Promise.all([
        supabase.from('follows')
          .select('follower_id')
          .eq('follower_id', myUser.id)
          .eq('following_id', profileData.id)
          .maybeSingle(),
        supabase.from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profileData.id),
      ])

      setIsFollowing(!!followResult.data)
      setCatchCount(countResult.count ?? 0)
    } catch (err) {
      setError('Failed to load profile')
      console.error('[user-profile] load failed', err)
    } finally {
      setLoading(false)
    }
  }, [username, myUser?.id])

  useEffect(() => {
    if (!username || !myUser) return
    loadProfile()
  }, [username, myUser?.id, loadProfile])

  async function handleFollow() {
    if (followLoading || !profile) return
    setFollowLoading(true)
    try {
      const { error } = await supabase.from('follows').insert({
        follower_id: myUser.id,
        following_id: profile.id,
      })
      if (error) throw error
      setIsFollowing(true)
      await initPhotos()
    } catch (err) {
      console.error('[user-profile] follow failed', err)
      showToast('Failed to follow. Please try again.')
    } finally {
      setFollowLoading(false)
    }
  }

  async function handleUnfollow() {
    if (followLoading || !profile) return
    setFollowLoading(true)
    try {
      const { error } = await supabase.from('follows')
        .delete()
        .eq('follower_id', myUser.id)
        .eq('following_id', profile.id)
      if (error) throw error
      setIsFollowing(false)
      removeUserPhotos(profile.id)
    } catch (err) {
      console.error('[user-profile] unfollow failed', err)
      showToast('Failed to unfollow. Please try again.')
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState}>
          <p>{error}</p>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>Go back</button>
        </div>
      </div>
    )
  }

  const displayName = profile.display_name || profile.username
  const initial = displayName ? displayName[0].toUpperCase() : '?'

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.avatarWrap}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt={displayName} className={styles.avatar} />
            : <div className={styles.avatarFallback}>{initial}</div>
          }
        </div>

        <h1 className={styles.displayName}>{displayName}</h1>
        <div className={styles.usernameLabel}>@{profile.username}</div>

        {profile.bio && (
          <p className={styles.bio}>{profile.bio}</p>
        )}

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{catchCount ?? '—'}</span>
            <span className={styles.statLabel}>Catches</span>
          </div>
        </div>

        {isOwnProfile ? (
          <Link to="/profile" className={styles.editBtn}>Edit profile</Link>
        ) : (
          <button
            className={isFollowing ? styles.unfollowBtn : styles.followBtn}
            onClick={isFollowing ? handleUnfollow : handleFollow}
            disabled={followLoading}
          >
            {followLoading ? '…' : isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        )}
      </div>
    </div>
  )
}
