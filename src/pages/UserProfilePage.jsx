import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { EditPencil, UserCircle } from 'iconoir-react'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { initPhotos, deletePhotos } from '../lib/fileLoader.js'
import { groupByTime } from '../lib/groupByTime.js'
import { renderStats } from '../stats.js'
import { Button } from '../components/ui/index.js'
import { FavoritePickerDialog } from '../components/FavoritePicker/FavoritePickerDialog.jsx'
import { PopupCarousel } from '../components/Map/PopupCarousel.jsx'
import { formatDateFull, cleanSpecies } from '../lib/formatters.js'
import { createImageDataUrl } from '../lib/imageUtils.js'
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

  const [fetchedProfile, setFetchedProfile] = useState(null)
  const [otherPhotos, setOtherPhotos] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState(null)

  const [uploading, setUploading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [favorites, setFavorites] = useState(loadFavoritesCache)
  const [pickerSlot, setPickerSlot] = useState(null)
  const [catchPopupGroup, setCatchPopupGroup] = useState(null)
  const fileInputRef = useRef(null)

  const [activeTab, setActiveTab] = useState('profile')
  const [followingCount, setFollowingCount] = useState(null)
  const [followersCount, setFollowersCount] = useState(null)

  const totalRef = useRef(null)
  const monthlyRef = useRef(null)
  const hourlyRef = useRef(null)
  const speciesRef = useRef(null)
  const speciesMonthlyRef = useRef(null)
  const weatherCondRef = useRef(null)
  const weatherTempRef = useRef(null)

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
          isOwn: false,
        })))
      } catch (err) {
        setError('Failed to load profile')
        console.error('[user-profile] load failed', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [urlUsername, myUser?.id, isOwnProfile])

  useEffect(() => {
    if (!isOwnProfile || !myUser) return
    supabase.from('profiles').select('favorites').eq('id', myUser.id).single()
      .then(({ data }) => {
        if (data?.favorites) {
          const favs = normalizeFavorites(data.favorites)
          setFavorites(favs)
          cacheFavorites(favs)
        }
      })
  }, [isOwnProfile, myUser?.id])

  useEffect(() => {
    if (!profile?.id) return
    Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
    ]).then(([following, followers]) => {
      setFollowingCount(following.count ?? 0)
      setFollowersCount(followers.count ?? 0)
    })
  }, [profile?.id])

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

  const catchCount = useMemo(
    () => groupByTime(effectivePhotos).length,
    [effectivePhotos]
  )

  const thisYearCount = useMemo(() => {
    const year = new Date().getFullYear()
    return groupByTime(effectivePhotos.filter(p => p.time && new Date(p.time).getFullYear() === year)).length
  }, [effectivePhotos])

  const recentCatches = useMemo(
    () => groupByTime(effectivePhotos).sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0)).slice(0, 24),
    [effectivePhotos]
  )

  useEffect(() => {
    if (activeTab !== 'stats') return
    renderStats(userGroups, {
      total: totalRef.current,
      monthly: monthlyRef.current,
      hourly: hourlyRef.current,
      species: speciesRef.current,
      speciesMonthly: speciesMonthlyRef.current,
      weatherCond: weatherCondRef.current,
      weatherTemp: weatherTempRef.current,
    })
  }, [userGroups, activeTab])

  async function handleFollow() {
    if (followLoading || !profile) return
    setFollowLoading(true)
    try {
      const { error } = await supabase.from('follows').insert({ follower_id: myUser.id, following_id: profile.id })
      if (error) throw error
      setIsFollowing(true)
      setFollowersCount(c => (c ?? 0) + 1)
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
      setFollowersCount(c => Math.max(0, (c ?? 1) - 1))
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
      const { error } = await supabase.from('profiles').upsert({ id: myUser.id, avatar_url: dataUrl })
      if (error) throw new Error(`Profile update failed: ${error.message}`)
      setUser({ ...myUser, user_metadata: { ...myUser.user_metadata, avatar_url: dataUrl } })
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
      setUser({ ...data.user, user_metadata: { ...data.user.user_metadata, avatar_url: myUser?.user_metadata?.avatar_url ?? data.user.user_metadata?.avatar_url } })
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

  async function handleCatchDelete(group) {
    await deletePhotos(group)
    setCatchPopupGroup(null)
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
                      : <UserCircle width={36} height={36} className={styles.avatarPlaceholder} />
                  }
                  {uploading && <div className={styles.avatarOverlay}><span className={styles.avatarSpinner} /></div>}
                </button>
                {!avatarUrl && <div className={styles.avatarEditBadge} aria-hidden="true"><EditPencil width={10} height={10} /></div>}
                <input ref={fileInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleAvatarChange} />
              </>
            ) : (
              avatarUrl
                ? <img src={avatarUrl} alt={displayName} className={styles.avatarImg} />
                : <div className={styles.avatarFallback}>{displayName?.[0]?.toUpperCase() ?? '?'}</div>
            )}
          </div>

          <div className={styles.headerMid}>
            <span className={styles.headerUsername}>{displayName}</span>
            {bio && <p className={styles.headerBio}>{bio}</p>}
            <div className={styles.headerStats}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{catchCount}</span>
                <span className={styles.statLabel}>Catches</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{thisYearCount}</span>
                <span className={styles.statLabel}>This Year</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{followingCount ?? '–'}</span>
                <span className={styles.statLabel}>Following</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{followersCount ?? '–'}</span>
                <span className={styles.statLabel}>Followers</span>
              </div>
            </div>
            {isOwnProfile ? (
              <Button variant="secondary" onClick={openDialog} className={styles.editProfileBtn}>
                <EditPencil width={14} height={14} />
                Edit Profile
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={isFollowing ? handleUnfollow : handleFollow}
                disabled={followLoading}
                className={styles.editProfileBtn}
              >
                {followLoading ? '…' : isFollowing ? 'Unfollow' : 'Follow'}
              </Button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className={styles.tabBar}>
          <button className={activeTab === 'profile' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('profile')}>Profile</button>
          <button className={activeTab === 'stats' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('stats')}>Stats</button>
        </div>

        {/* Profile tab */}
        {activeTab === 'profile' && (
          <>
            {(isOwnProfile || favoritesPhotos.some(Boolean)) && (
              <>
                <div className={styles.sectionLabel}>Favorites</div>
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
              </>
            )}

            {recentCatches.length > 0 && (
              <>
                <div className={styles.sectionLabel}>Catches</div>
                <div className={styles.catchesGrid}>
                  {recentCatches.map(group => (
                    <button key={group[0].name} className={styles.catchThumb} onClick={() => setCatchPopupGroup(group)}>
                      <img src={group[0].url} alt="" className={styles.catchThumbImg} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Stats tab */}
        {activeTab === 'stats' && (
          userGroups.length > 0 ? (
            <>
              <div className={styles.statsHeader}>
                <span className={styles.statsTitle}>Stats</span>
                <span ref={totalRef} className={styles.statsTotal} />
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
          ) : (
            <div className={styles.emptyStats}>No catch data with GPS yet.</div>
          )
        )}

        {isOwnProfile && (
          <div className={styles.footer}>
            <Button variant="secondary" onClick={signOut}>Sign out</Button>
          </div>
        )}
      </div>

      {catchPopupGroup && (
        <Dialog.Root open onOpenChange={o => { if (!o) setCatchPopupGroup(null) }}>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.catchDialogBackdrop} />
            <Dialog.Content className={styles.catchDialogContent} aria-describedby={undefined}>
              <Dialog.Title className={styles.srOnly}>Catch details</Dialog.Title>
              <PopupCarousel
                initialGroup={catchPopupGroup}
                onClose={() => setCatchPopupGroup(null)}
                onDelete={handleCatchDelete}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

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
                            : <UserCircle width={36} height={36} className={styles.avatarPlaceholder} />
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
