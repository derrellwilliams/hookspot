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
import { animateMesh } from '../lib/mesh.js'

const PROFILE_BLOBS = [
  { x: 58, y: 33, color: '#2563eb', dx: 0.8,  dy: 0.6  }, // accent
  { x: 27, y: 45, color: '#64748b', dx: 0.7,  dy: -0.8 }, // muted
  { x: 74, y: 66, color: '#1A1953', dx: -0.6, dy: 0.5  }, // darkBg
  { x: 35, y: 67, color: '#a1a1aa', dx: 0.9,  dy: -0.7 }, // darkMuted
  { x: 31, y: 18, color: '#2c2c2e', dx: 0.6,  dy: 0.8  }, // darkSurface
  { x: 15, y: 55, color: '#060a1a', dx: -0.5, dy: 0.6  }, // deepNavy
]
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
  const photosInitialized = usePhotoStore(s => s.photosInitialized)

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
  const headerMeshRef = useRef(null)

  useEffect(() => {
    if (!headerMeshRef.current) return
    return animateMesh(headerMeshRef.current, PROFILE_BLOBS, { speed: 0.005 })
  }, [])

  const [activeTab, setActiveTab] = useState('profile')

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

  const effectivePhotos = useMemo(
    () => isOwnProfile ? photos.filter(p => p.userId === profile?.id) : otherPhotos,
    [isOwnProfile, photos, profile?.id, otherPhotos]
  )

  const catchGroups = useMemo(() => groupByTime(effectivePhotos), [effectivePhotos])

  const catchesThisYear = useMemo(() => {
    const year = new Date().getFullYear()
    return catchGroups.filter(g => g[0].time && new Date(g[0].time).getFullYear() === year).length
  }, [catchGroups])

  const uniqueSpecies = useMemo(() => {
    const seen = new Set()
    for (const p of effectivePhotos) {
      if (p.species) seen.add(p.species.toLowerCase())
    }
    return seen.size
  }, [effectivePhotos])

  const catchesThisMonth = useMemo(() => {
    const now = new Date()
    return catchGroups.filter(g => {
      if (!g[0].time) return false
      const d = new Date(g[0].time)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length
  }, [catchGroups])

  const userGroups = useMemo(
    () => groupByTime(effectivePhotos.filter(p => p.hasGps)),
    [effectivePhotos]
  )

  const recentCatches = useMemo(
    () => groupByTime(effectivePhotos).sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0)).slice(0, 24),
    [effectivePhotos]
  )

  useEffect(() => {
    if (activeTab !== 'stats') return
    renderStats(userGroups, {
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
        <div className={styles.content}>

        {/* Profile header */}
        <div className={styles.profileHeader}>
          <div ref={headerMeshRef} className={styles.headerMesh} aria-hidden="true" />
          <div className={styles.headerGrain} aria-hidden="true" />
          {isOwnProfile && (
            <Button variant="icon-sm" onClick={openDialog} className={styles.editProfileBtn} aria-label="Edit profile">
              <EditPencil width={16} height={16} />
            </Button>
          )}
          <div className={styles.headerLeft}>
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
                <div className={styles.headerStat}>
                  <span className={styles.headerStatNum}>{catchGroups.length}</span>
                  <span className={styles.headerStatLabel}>All</span>
                </div>
                <div className={styles.headerStatDivider} />
                <div className={styles.headerStat}>
                  <span className={styles.headerStatNum}>{catchesThisYear}</span>
                  <span className={styles.headerStatLabel}>Year</span>
                </div>
                <div className={styles.headerStatDivider} />
                <div className={styles.headerStat}>
                  <span className={styles.headerStatNum}>{catchesThisMonth}</span>
                  <span className={styles.headerStatLabel}>Month</span>
                </div>
                <div className={styles.headerStatDivider} />
                <div className={styles.headerStat}>
                  <span className={styles.headerStatNum}>{uniqueSpecies}</span>
                  <span className={styles.headerStatLabel}>Species</span>
                </div>
              </div>
              {!isOwnProfile && (
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

        </div>

        {/* Tab bar */}
        <div className={styles.tabBar}>
          <button className={activeTab === 'profile' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('profile')}>Recent Activity</button>
          <button className={activeTab === 'stats' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('stats')}>Stats</button>
        </div>

        {/* Profile tab */}
        {activeTab === 'profile' && (isOwnProfile && effectivePhotos.length === 0 && !photosInitialized ? (
          <div className={styles.catchesGrid}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonImg} />
                <div className={styles.skeletonMeta}>
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLineShort} />
                </div>
              </div>
            ))}
          </div>
        ) : recentCatches.length > 0 ? (
          <div className={styles.catchesGrid}>
            {recentCatches.map(group => {
              const photo = group[0]
              const species = cleanSpecies(photo.species)
              return (
                <button key={photo.name} className={styles.catchThumb} onClick={() => setCatchPopupGroup(group)}>
                  <div className={styles.catchThumbImgWrap}>
                    <img src={photo.url} alt="" className={styles.catchThumbImg} loading="lazy" />
                  </div>
                  <div className={styles.catchMeta}>
                    {species && <div className={styles.catchSpecies}>{species}</div>}
                    {photo.time && <div className={styles.catchDatetime}>{formatDateFull(photo.time).split(' ·')[0]}</div>}
                  </div>
                </button>
              )
            })}
          </div>
        ) : null)}

        {/* Stats tab */}
        {activeTab === 'stats' && (
          userGroups.length > 0 ? (
            <>
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
