import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { EditPencil, UserCircle } from 'iconoir-react'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { initPhotos } from '../lib/fileLoader.js'
import { groupByTime } from '../lib/groupByTime.js'
import { renderStats } from '../stats.js'
import { Button } from '../components/ui/index.js'
import { FavoritePickerDialog } from '../components/FavoritePicker/FavoritePickerDialog.jsx'
import { formatDateFull, cleanSpecies } from '../lib/formatters.js'
import { createImageDataUrl } from '../lib/imageUtils.js'
import { ProfileBlob } from '../components/ProfileBlob.jsx'
import styles from './UserProfilePage.module.css'

const FAVORITES_KEY = 'hookspot:favorites'
function loadFavoritesCache() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) ?? [null, null, null, null] }
  catch { return [null, null, null, null] }
}
function normalizeFavorites(raw) {
  const arr = Array.isArray(raw) ? raw : []
  return [...arr, null, null, null, null].slice(0, 4)
}
function cacheFavorites(favs) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs))
}

export function UserProfilePage() {
  const { username: urlUsername } = useParams()
  const navigate = useNavigate()
  const myUser = useAuthStore(s => s.user)
  const myUsername = useAuthStore(s => s.username)
  const setUser = useAuthStore(s => s.setUser)
  const signOut = useAuthStore(s => s.signOut)
  const removeUserPhotos = usePhotoStore(s => s.removeUserPhotos)
  const showToast = usePhotoStore(s => s.showToast)
  const photos = usePhotoStore(s => s.photos)

  const isOwnProfile = urlUsername === myUsername

  // Other-profile state
  const [fetchedProfile, setFetchedProfile] = useState(null)
  const [otherPhotos, setOtherPhotos] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState(null)

  // Own-profile edit state
  const [uploading, setUploading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [favorites, setFavorites] = useState(loadFavoritesCache)
  const [pickerSlot, setPickerSlot] = useState(null)
  const fileInputRef = useRef(null)

  // Stats refs
  const totalRef = useRef(null)
  const monthlyRef = useRef(null)
  const hourlyRef = useRef(null)
  const speciesRef = useRef(null)
  const speciesMonthlyRef = useRef(null)
  const weatherCondRef = useRef(null)
  const weatherTempRef = useRef(null)

  // Own profile: derive data from auth store (reactive, no fetch)
  const ownProfile = useMemo(() => {
    if (!isOwnProfile || !myUser) return null
    return {
      id: myUser.id,
      username: myUsername,
      display_name: myUser.user_metadata?.display_name || null,
      bio: myUser.user_metadata?.bio || null,
      avatar_url: myUser.user_metadata?.avatar_url || null,
    }
  }, [isOwnProfile, myUser, myUsername])

  const profile = isOwnProfile ? ownProfile : fetchedProfile
  const isAuthResolving = !!myUser && myUsername === null
  const isProfileLoading = isOwnProfile ? !myUser : loading
  const isLoading = isAuthResolving || isProfileLoading

  // Fetch other user's profile
  useEffect(() => {
    if (isOwnProfile || !urlUsername || !myUser) return
    setLoading(true)
    setError(null)
    setFetchedProfile(null)
    setOtherPhotos([])
    ;(async () => {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles').select('*').eq('username', urlUsername).single()
        if (profileError || !profileData) { setError('Profile not found'); return }
        setFetchedProfile(profileData)
        const [followResult, photosRes] = await Promise.all([
          supabase.from('follows').select('follower_id').eq('follower_id', myUser.id).eq('following_id', profileData.id).maybeSingle(),
          fetch(`/api/photos?userId=${profileData.id}&ownOnly=true`),
        ])
        setIsFollowing(!!followResult.data)
        const { rows = [] } = await photosRes.json()
        setOtherPhotos(rows.map(row => ({
          name: row.filename,
          userId: row.user_id,
          url: row.url,
          time: row.time ? new Date(row.time).getTime() : null,
          hasGps: !!(row.lat && row.lng),
          exif: row.lat && row.lng ? { latitude: row.lat, longitude: row.lng } : null,
          species: row.species || undefined,
          meta: row.meta || {},
        })))
      } catch (err) {
        setError('Failed to load profile')
        console.error('[user-profile] load failed', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [urlUsername, myUser?.id, isOwnProfile])

  // Load own favorites from DB (authoritative) — localStorage is only a fast-render cache
  useEffect(() => {
    if (!isOwnProfile || !myUser) return
    supabase
      .from('profiles')
      .select('favorites')
      .eq('id', myUser.id)
      .single()
      .then(({ data }) => {
        if (data?.favorites) {
          const favs = normalizeFavorites(data.favorites)
          setFavorites(favs)
          cacheFavorites(favs)
        }
      })
  }, [isOwnProfile, myUser?.id])

  const effectivePhotos = isOwnProfile
    ? photos.filter(p => p.userId === profile?.id)
    : otherPhotos

  const userGroups = useMemo(
    () => groupByTime(effectivePhotos.filter(p => p.hasGps)),
    [effectivePhotos]
  )

  const photoMap = useMemo(
    () => Object.fromEntries(effectivePhotos.map(p => [p.name, p])),
    [effectivePhotos]
  )

  const favoritesPhotos = useMemo(() => {
    const favs = isOwnProfile ? favorites : (profile?.favorites ?? [])
    return favs.map(name => (name ? photoMap[name] ?? null : null))
  }, [isOwnProfile, favorites, profile?.favorites, photoMap])

  useEffect(() => {
    renderStats(userGroups, {
      total: totalRef.current,
      monthly: monthlyRef.current,
      hourly: hourlyRef.current,
      species: speciesRef.current,
      speciesMonthly: speciesMonthlyRef.current,
      weatherCond: weatherCondRef.current,
      weatherTemp: weatherTempRef.current,
    })
  }, [userGroups])

  async function handleFollow() {
    if (followLoading || !profile) return
    setFollowLoading(true)
    try {
      const { error } = await supabase.from('follows').insert({ follower_id: myUser.id, following_id: profile.id })
      if (error) throw error
      setIsFollowing(true)
      initPhotos()
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
      const { error } = await supabase.from('follows').delete().eq('follower_id', myUser.id).eq('following_id', profile.id)
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

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file || !myUser) return
    setUploading(true)
    try {
      const dataUrl = await createImageDataUrl(file)
      const { data, error } = await supabase.auth.updateUser({ data: { avatar_url: dataUrl } })
      if (error) throw new Error(`Profile update failed: ${error.message}`)
      setUser(data.user)
      await supabase.from('profiles').upsert({ id: myUser.id, avatar_url: dataUrl })
      showToast('Profile photo updated!')
    } catch (err) {
      console.error('[hookspot] avatar upload failed', err)
      showToast(err.message || 'Failed to upload photo.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function openDialog() {
    setEditName(myUser?.user_metadata?.display_name || myUser?.user_metadata?.full_name || '')
    setEditBio(myUser?.user_metadata?.bio || '')
    setDialogOpen(true)
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { display_name: editName.trim(), bio: editBio.trim() },
      })
      if (error) throw error
      await supabase.from('profiles').upsert({
        id: myUser.id,
        display_name: editName.trim() || null,
        bio: editBio.trim() || null,
        avatar_url: myUser?.user_metadata?.avatar_url || null,
      })
      setUser(data.user)
      setDialogOpen(false)
    } catch (err) {
      console.error('[hookspot] profile save failed', err)
      showToast('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleSelectFavorite(photo) {
    const next = favorites.map((f, i) => i === pickerSlot ? photo.name : f)
    setFavorites(next)
    cacheFavorites(next)
    supabase.from('profiles').update({ favorites: next }).eq('id', myUser.id)
      .then(({ error }) => { if (error) console.error('[favorites] save failed', error) })
    setPickerSlot(null)
  }

  function handleRemoveFavorite() {
    const next = favorites.map((f, i) => i === pickerSlot ? null : f)
    setFavorites(next)
    cacheFavorites(next)
    supabase.from('profiles').update({ favorites: next }).eq('id', myUser.id)
      .then(({ error }) => { if (error) console.error('[favorites] save failed', error) })
    setPickerSlot(null)
  }

  if (isLoading) return <div className={styles.page}><div className={styles.loading}>Loading…</div></div>

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

  if (!profile) return null

  const displayName = profile.display_name || profile.username
  const avatarUrl = profile.avatar_url
  const bio = profile.bio

  return (
    <div className={styles.page}>
      <div className={styles.scroll}>

        {/* Profile header */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrap}>
            <ProfileBlob />
            {isOwnProfile ? (
              <>
                <button
                  className={styles.avatarBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Change profile photo"
                >
                  {avatarUrl
                    ? <img src={avatarUrl} alt={displayName || 'Profile'} className={styles.avatarImg} />
                    : displayName
                      ? <span className={styles.avatarInitial}>{displayName[0].toUpperCase()}</span>
                      : <UserCircle width={40} height={40} className={styles.avatarPlaceholder} />
                  }
                  {uploading && <div className={styles.avatarOverlay}><span className={styles.avatarSpinner} /></div>}
                </button>
                {!avatarUrl && <div className={styles.avatarEditBadge} aria-hidden="true"><EditPencil width={10} height={10} /></div>}
                <input ref={fileInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleAvatarChange} />
              </>
            ) : (
              avatarUrl
                ? <img src={avatarUrl} alt={displayName} className={`${styles.avatarImg} ${styles.avatarStatic}`} />
                : <div className={styles.avatarFallback}>{displayName?.[0]?.toUpperCase() ?? '?'}</div>
            )}
          </div>

          <div className={styles.profileInfo}>
            {isOwnProfile ? (
              <>
                <div className={styles.profileNameRow}>
                  <span className={displayName ? styles.profileName : styles.profileNameEmpty}>
                    {displayName || "What's your name?"}
                  </span>
                  <Button variant="icon-sm" onClick={openDialog} aria-label="Edit profile">
                    <EditPencil width={16} height={16} />
                  </Button>
                </div>
                <div className={styles.usernameLabel}>@{profile.username}</div>
                <button
                  className={bio ? styles.profileBio : styles.profileBioEmpty}
                  onClick={openDialog}
                  aria-label={bio ? 'Edit bio' : 'Add bio'}
                >
                  {bio || 'Tell us about yourself'}
                </button>
              </>
            ) : (
              <>
                <h1 className={styles.displayName}>{displayName}</h1>
                <div className={styles.usernameLabel}>@{profile.username}</div>
                {bio && <p className={styles.bio}>{bio}</p>}
              </>
            )}
            {!isOwnProfile && (
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

        {/* Favorites */}
        {(isOwnProfile || favoritesPhotos.some(Boolean)) && (
        <div className={styles.favoritesLabel}>Favorites</div>
        )}
        {(isOwnProfile || favoritesPhotos.some(Boolean)) && (
        <div className={styles.favoritesGrid}>
          {favoritesPhotos.map((photo, i) => {
            if (photo) {
              const species = cleanSpecies(photo.species)
              return (
                <button
                  key={i}
                  className={`${styles.favoriteSlot} ${styles.favoriteSlotFilled}`}
                  onClick={isOwnProfile ? () => setPickerSlot(i) : undefined}
                  style={!isOwnProfile ? { cursor: 'default' } : undefined}
                >
                  <img src={photo.url} alt={species ? `${species} catch` : 'Fishing catch photo'} className={styles.favoriteImg} onError={e => { e.currentTarget.style.display = 'none' }} />
                  <div className={styles.favoriteMeta}>
                    {species && <div className={styles.favoriteSpecies}>{species}</div>}
                    {photo.time && <div className={styles.favoriteDatetime}>{formatDateFull(photo.time).split(' •')[0]}</div>}
                    {photo.meta?.location?.city && photo.meta?.location?.state && (
                      <div className={styles.favoriteLocation}>{photo.meta.location.city}, {photo.meta.location.state}</div>
                    )}
                  </div>
                </button>
              )
            }
            if (isOwnProfile) {
              return (
                <button key={i} className={styles.favoriteSlot} onClick={() => setPickerSlot(i)}>
                  <span className={styles.favoriteHint}>+</span>
                </button>
              )
            }
            return null
          })}
        </div>
        )}

        {/* Stats */}
        {userGroups.length > 0 && (
          <>
            <div className={styles.header}>
              <span className={styles.title}>Stats</span>
              <span ref={totalRef} className={styles.total} />
            </div>
            <div className={styles.grid}>
              <div className={styles.card}><div className={styles.cardLabel}>Catches per Month</div><div ref={monthlyRef} /></div>
              <div className={styles.card}><div className={styles.cardLabel}>Time of Day</div><div ref={hourlyRef} /></div>
              <div className={styles.row2}>
                <div className={styles.card}><div className={styles.cardLabel}>Species</div><div ref={speciesRef} /></div>
                <div className={styles.card}><div className={styles.cardLabel}>Species by Month</div><div ref={speciesMonthlyRef} /></div>
              </div>
              <div className={styles.row2}>
                <div className={styles.card}><div className={styles.cardLabel}>Catches by Condition</div><div ref={weatherCondRef} /></div>
                <div className={styles.card}><div className={styles.cardLabel}>Catches by Temperature</div><div ref={weatherTempRef} /></div>
              </div>
            </div>
          </>
        )}

        {isOwnProfile && (
          <div className={styles.footer}>
            <Button variant="secondary" onClick={signOut}>Sign out</Button>
          </div>
        )}
      </div>

      {isOwnProfile && (
        <>
          <FavoritePickerDialog
            open={pickerSlot !== null}
            current={pickerSlot !== null ? favorites[pickerSlot] : null}
            onSelect={handleSelectFavorite}
            onRemove={handleRemoveFavorite}
            onClose={() => setPickerSlot(null)}
          />
          <Dialog.Root open={dialogOpen} onOpenChange={o => { if (!o) setDialogOpen(false) }}>
            <Dialog.Portal>
              <Dialog.Overlay className={styles.dialogBackdrop} />
              <Dialog.Content className={styles.dialogContent} aria-describedby={undefined}>
                <Dialog.Title className={styles.dialogTitle}>Edit profile</Dialog.Title>
                <div className={styles.editForm}>
                  <div className={styles.dialogAvatarRow}>
                    <div className={styles.avatarWrap}>
                      <button className={styles.avatarBtn} onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="Change profile photo" type="button">
                        {avatarUrl
                          ? <img src={avatarUrl} alt={displayName || 'Profile'} className={styles.avatarImg} />
                          : displayName
                            ? <span className={styles.avatarInitial}>{displayName[0].toUpperCase()}</span>
                            : <UserCircle width={40} height={40} className={styles.avatarPlaceholder} />
                        }
                        {uploading && <div className={styles.avatarOverlay}><span className={styles.avatarSpinner} /></div>}
                      </button>
                    </div>
                  </div>
                  <input className={styles.editNameInput} value={editName} onChange={e => setEditName(e.target.value)} placeholder="What's your name?" maxLength={60} autoFocus />
                  <textarea className={styles.editBioInput} value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell us about yourself" maxLength={200} rows={4} />
                </div>
                <div className={styles.dialogFooter}>
                  <button className={styles.cancelBtn} onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</button>
                  <button className={styles.saveBtn} onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      )}
    </div>
  )
}
