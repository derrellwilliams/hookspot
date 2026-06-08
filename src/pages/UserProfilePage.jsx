import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { EditPencil, Group, NavArrowLeft, NavArrowRight, Settings, UserCircle } from 'iconoir-react'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { initPhotos, deletePhotos } from '../lib/fileLoader.js'
import { groupPhotos } from '../lib/groupPhotos.js'
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
import { SearchOverlay } from '../components/SearchOverlay/SearchOverlay.jsx'
import { FollowListDialog } from '../components/FollowListDialog/FollowListDialog.jsx'
import { PopupCarousel } from '../components/Map/PopupCarousel.jsx'
import { formatDateFull, cleanSpecies } from '../lib/formatters.js'
import { uploadAvatar } from '../lib/avatarUpload.js'
import styles from './UserProfilePage.module.css'

const spring = { type: 'spring', stiffness: 300, damping: 24 }
const cardVariants = { rest: { y: 0 }, hover: { y: -1 } }
const imgVariants = { rest: { scale: 1 }, hover: { scale: 1.015 } }

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [gearDialogOpen, setGearDialogOpen] = useState(false)
  const [editRods, setEditRods] = useState([])
  const [editFlies, setEditFlies] = useState([])
  const [newRod, setNewRod] = useState('')
  const [newFly, setNewFly] = useState('')
  const [gearSaving, setGearSaving] = useState(false)
  const [favorites, setFavorites] = useState(loadFavoritesCache)
  const [pickerSlot, setPickerSlot] = useState(null)
  const [catchPopupIdx, setCatchPopupIdx] = useState(null)
  const fileInputRef = useRef(null)
  const meshCleanupRef = useRef(null)
  const headerMeshRef = useCallback((el) => {
    if (meshCleanupRef.current) { meshCleanupRef.current(); meshCleanupRef.current = null }
    if (el) meshCleanupRef.current = animateMesh(el, PROFILE_BLOBS, { speed: 0.005 })
  }, [])

  const [activeTab, setActiveTab] = useState('profile')
  const [searchOpen, setSearchOpen] = useState(false)
  const [followerCount, setFollowerCount] = useState(null)
  const [followingCount, setFollowingCount] = useState(null)
  const [followListOpen, setFollowListOpen] = useState(false)
  const [followListTab, setFollowListTab] = useState('followers')

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
        const [followResult, photosRes, followerRes, followingRes] = await Promise.all([
          supabase.from('follows').select('follower_id').eq('follower_id', myUser.id).eq('following_id', profileData.id).maybeSingle(),
          fetch(`/api/photos?userId=${profileData.id}&ownOnly=true`),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileData.id),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileData.id),
        ])
        setFollowerCount(followerRes.count ?? 0)
        setFollowingCount(followingRes.count ?? 0)
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
    Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', myUser.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', myUser.id),
    ]).then(([followerRes, followingRes]) => {
      setFollowerCount(followerRes.count ?? 0)
      setFollowingCount(followingRes.count ?? 0)
    })
  }, [isOwnProfile, myUser?.id])

  const effectivePhotos = useMemo(
    () => isOwnProfile ? photos.filter(p => p.userId === profile?.id) : otherPhotos,
    [isOwnProfile, photos, profile?.id, otherPhotos]
  )

  const catchGroups = useMemo(() => groupPhotos(effectivePhotos), [effectivePhotos])

  const catchesThisYear = useMemo(() => {
    const year = new Date().getFullYear()
    return catchGroups.filter(g => g[0].time && new Date(g[0].time).getFullYear() === year).length
  }, [catchGroups])

  const uniqueSpecies = useMemo(() => {
    const seen = new Set()
    for (const g of catchGroups) {
      const lead = g.find(p => p.species) ?? g[0]
      if (lead.species) seen.add(lead.species.toLowerCase())
    }
    return seen.size
  }, [catchGroups])

  const catchesThisMonth = useMemo(() => {
    const now = new Date()
    return catchGroups.filter(g => {
      if (!g[0].time) return false
      const d = new Date(g[0].time)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length
  }, [catchGroups])

  const userGroups = useMemo(
    () => groupPhotos(effectivePhotos.filter(p => p.hasGps)),
    [effectivePhotos]
  )

  const PAGE_SIZE = 24
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef(null)

  const recentCatches = useMemo(
    () => groupPhotos(effectivePhotos).sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0)),
    [effectivePhotos]
  )

  const visibleCatches = useMemo(
    () => recentCatches.slice(0, visibleCount),
    [recentCatches, visibleCount]
  )

  const catchPopupGroup = catchPopupIdx !== null ? (recentCatches[catchPopupIdx] ?? null) : null

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [effectivePhotos])

  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(n => Math.min(n + PAGE_SIZE, recentCatches.length))
    }, { rootMargin: '200px' })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [recentCatches.length, activeTab])

  useEffect(() => {
    if (catchPopupIdx === null) return
    function handleKey(e) {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft') setCatchPopupIdx(i => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setCatchPopupIdx(i => Math.min(recentCatches.length - 1, i + 1))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [catchPopupIdx, recentCatches.length])

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
      setFollowerCount(c => c !== null ? c + 1 : c)
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
      setFollowerCount(c => c !== null ? Math.max(0, c - 1) : c)
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
      const url = await uploadAvatar(myUser.id, file)
      const { error } = await supabase.from('profiles').upsert({ id: myUser.id, avatar_url: url })
      if (error) throw new Error(`Profile update failed: ${error.message}`)
      setUser({ ...myUser, user_metadata: { ...myUser.user_metadata, avatar_url: url } })
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
        data: { display_name: editName.trim(), bio: editBio.trim(), avatar_url: null },
      })
      if (error) throw error
      await supabase.from('profiles').upsert({
        id: myUser.id,
        display_name: editName.trim() || null,
        bio: editBio.trim() || null,
        avatar_url: myUser?.user_metadata?.avatar_url || null,
      })
      setUser({ ...data.user, user_metadata: { ...data.user.user_metadata, avatar_url: myUser?.user_metadata?.avatar_url } })
      setDialogOpen(false)
    } catch (err) {
      console.error('[hookspot] profile save failed', err)
      showToast('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function openGearDialog() {
    const savedRods = myUser?.user_metadata?.gear_rods
    const savedFlies = myUser?.user_metadata?.gear_flies
    if (savedRods != null) {
      setEditRods(savedRods)
    } else {
      const ownPhotos = photos.filter(p => p.isOwn)
      setEditRods([...new Set(ownPhotos.map(p => p.meta?.rod).filter(Boolean))])
    }
    if (savedFlies != null) {
      setEditFlies(savedFlies)
    } else {
      const ownPhotos = photos.filter(p => p.isOwn)
      setEditFlies([...new Set(ownPhotos.map(p => p.meta?.fly).filter(Boolean))])
    }
    setNewRod('')
    setNewFly('')
    setGearDialogOpen(true)
  }

  function addRod() {
    const val = newRod.trim()
    if (!val || editRods.includes(val)) { setNewRod(''); return }
    setEditRods(prev => [...prev, val])
    setNewRod('')
  }

  function addFly() {
    const val = newFly.trim()
    if (!val || editFlies.includes(val)) { setNewFly(''); return }
    setEditFlies(prev => [...prev, val])
    setNewFly('')
  }

  async function saveGear() {
    setGearSaving(true)
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { gear_rods: editRods, gear_flies: editFlies, avatar_url: null },
      })
      if (error) throw error
      setUser({ ...data.user, user_metadata: { ...data.user.user_metadata, avatar_url: myUser?.user_metadata?.avatar_url } })
      setGearDialogOpen(false)
    } catch (err) {
      console.error('[hookspot] gear save failed', err)
      showToast('Failed to save gear. Please try again.')
    } finally {
      setGearSaving(false)
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
    setCatchPopupIdx(null)
    showToast('Catch deleted')
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
          <div className={styles.headerBtns}>
          {isOwnProfile ? (
            <DropdownMenu.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DropdownMenu.Trigger asChild>
                <Button variant="icon-sm" aria-label="Profile settings">
                  <Settings width={16} height={16} />
                </Button>
              </DropdownMenu.Trigger>
              <AnimatePresence>
                {settingsOpen && (
                  <DropdownMenu.Portal forceMount>
                    <DropdownMenu.Content
                      forceMount
                      sideOffset={6}
                      align="start"
                      asChild
                    >
                      <motion.div
                        className={styles.dropdownContent}
                        initial={{ opacity: 0, scale: 0.92, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: -6 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)' }}
                      >
                        <DropdownMenu.Item className={styles.dropdownItem} onSelect={openDialog}>
                          Edit profile
                        </DropdownMenu.Item>
                        <DropdownMenu.Item className={styles.dropdownItem} onSelect={openGearDialog}>
                          Edit gear
                        </DropdownMenu.Item>
                        <DropdownMenu.Item className={styles.dropdownItem} onSelect={signOut}>
                          Log out
                        </DropdownMenu.Item>
                      </motion.div>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                )}
              </AnimatePresence>
            </DropdownMenu.Root>
          ) : (
            <Button
              variant="secondary"
              onClick={isFollowing ? handleUnfollow : handleFollow}
              disabled={followLoading}
            >
              {followLoading ? '…' : isFollowing ? 'Unfollow' : 'Follow'}
            </Button>
          )}
          <Button variant="icon-sm" aria-label="Search users" onClick={() => setSearchOpen(true)}>
            <Group width={16} height={16} />
          </Button>
          </div>
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
                  <span className={styles.headerStatLabel}>Catches</span>
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
            </div>
          </div>

        </div>

        {/* Tab bar */}
        <div className={styles.tabBar}>
          {[{ id: 'profile', label: 'Recent Activity' }, { id: 'stats', label: 'Stats' }].map(({ id, label }) => {
            const isActive = activeTab === id
            return (
              <motion.button
                key={id}
                className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(id)}
                whileHover={{ scale: 1.007 }}
                whileTap={{ scale: 0.975 }}
                transition={spring}
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-highlight"
                    className={styles.tabHighlight}
                    initial={false}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <span className={styles.tabLabel}>{label}</span>
              </motion.button>
            )
          })}
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
            {visibleCatches.map((group, i) => {
              const photo = group[0]
              const species = cleanSpecies(photo.species)
              return (
                <motion.button
                  key={photo.name}
                  className={styles.catchThumb}
                  onClick={() => setCatchPopupIdx(i)}
                  initial="rest"
                  whileHover="hover"
                  whileTap={{ scale: 0.99 }}
                  variants={cardVariants}
                  transition={spring}
                >
                  <motion.div className={styles.catchThumbImgWrap} variants={imgVariants} transition={spring}>
                    <img src={photo.url} alt="" className={styles.catchThumbImg} loading="lazy" />
                  </motion.div>
                  <div className={styles.catchMeta}>
                    {species && <div className={styles.catchSpecies}>{species}</div>}
                    {photo.time && <div className={styles.catchDatetime}>{formatDateFull(photo.time).split(' ·')[0]}</div>}
                  </div>
                </motion.button>
              )
            })}
            {visibleCount < recentCatches.length && (
              <div ref={sentinelRef} className={styles.loadSentinel} />
            )}
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

        </div>
      </div>

      <Dialog.Root open={!!catchPopupGroup} onOpenChange={o => { if (!o) setCatchPopupIdx(null) }}>
        <Dialog.Portal forceMount>
          <AnimatePresence>
            {catchPopupGroup && (
              <>
                <Dialog.Overlay asChild>
                  <motion.div
                    className={styles.catchDialogBackdrop}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                </Dialog.Overlay>
                <Dialog.Content className={styles.catchDialogPositioner} aria-describedby={undefined}>
                  <Dialog.Title className={styles.srOnly}>Catch details</Dialog.Title>
                  <button
                    className={styles.catchNavArrow}
                    onClick={() => setCatchPopupIdx(i => Math.max(0, i - 1))}
                    disabled={catchPopupIdx === 0}
                    aria-label="Previous catch"
                  >
                    <NavArrowLeft width={18} height={18} />
                  </button>
                  <motion.div
                    className={styles.catchDialogContent}
                    initial={{ opacity: 0, scale: 0.97, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.15, ease: [0.67, 0.17, 0.62, 0.64] } }}
                    transition={{ delay: 0.05, duration: 0.25, ease: [0.17, 0.67, 0.51, 1] }}
                  >
                    <PopupCarousel
                      key={catchPopupIdx}
                      initialGroup={catchPopupGroup}
                      onClose={() => setCatchPopupIdx(null)}
                      onDelete={handleCatchDelete}
                    />
                  </motion.div>
                  <button
                    className={styles.catchNavArrow}
                    onClick={() => setCatchPopupIdx(i => Math.min(recentCatches.length - 1, i + 1))}
                    disabled={catchPopupIdx >= recentCatches.length - 1}
                    aria-label="Next catch"
                  >
                    <NavArrowRight width={18} height={18} />
                  </button>
                </Dialog.Content>
              </>
            )}
          </AnimatePresence>
        </Dialog.Portal>
      </Dialog.Root>

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

          <Dialog.Root open={gearDialogOpen} onOpenChange={o => { if (!o) setGearDialogOpen(false) }}>
            <Dialog.Portal>
              <Dialog.Overlay className={styles.dialogBackdrop} />
              <Dialog.Content className={styles.gearDialogContent} aria-describedby={undefined}>
                <Dialog.Title className={styles.dialogTitle}>Edit gear</Dialog.Title>
                <div className={styles.gearForm}>
                  <div className={styles.gearSection}>
                    <div className={styles.gearSectionLabel}>Rods</div>
                    <div className={styles.gearList}>
                      {editRods.length === 0 && <div className={styles.gearEmpty}>No rods added yet</div>}
                      {editRods.map((rod, i) => (
                        <div key={i} className={styles.gearItem}>
                          <span className={styles.gearItemLabel}>{rod}</span>
                          <button className={styles.gearItemRemove} type="button" aria-label="Remove" onClick={() => setEditRods(prev => prev.filter((_, j) => j !== i))}>×</button>
                        </div>
                      ))}
                    </div>
                    <div className={styles.gearAddRow}>
                      <input
                        className={styles.gearAddInput}
                        value={newRod}
                        onChange={e => setNewRod(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addRod()}
                        placeholder="Add a rod…"
                      />
                      <button className={styles.gearAddBtn} type="button" onClick={addRod}>Add</button>
                    </div>
                  </div>
                  <div className={styles.gearSection}>
                    <div className={styles.gearSectionLabel}>Flies</div>
                    <div className={styles.gearList}>
                      {editFlies.length === 0 && <div className={styles.gearEmpty}>No flies added yet</div>}
                      {editFlies.map((fly, i) => (
                        <div key={i} className={styles.gearItem}>
                          <span className={styles.gearItemLabel}>{fly}</span>
                          <button className={styles.gearItemRemove} type="button" aria-label="Remove" onClick={() => setEditFlies(prev => prev.filter((_, j) => j !== i))}>×</button>
                        </div>
                      ))}
                    </div>
                    <div className={styles.gearAddRow}>
                      <input
                        className={styles.gearAddInput}
                        value={newFly}
                        onChange={e => setNewFly(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addFly()}
                        placeholder="Add a fly…"
                      />
                      <button className={styles.gearAddBtn} type="button" onClick={addFly}>Add</button>
                    </div>
                  </div>
                </div>
                <div className={styles.dialogFooter}>
                  <button className={styles.cancelBtn} onClick={() => setGearDialogOpen(false)} disabled={gearSaving}>Cancel</button>
                  <button className={styles.saveBtn} onClick={saveGear} disabled={gearSaving}>{gearSaving ? 'Saving…' : 'Save'}</button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      )}

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        profileId={profile?.id}
      />
      <FollowListDialog
        open={followListOpen}
        onClose={() => setFollowListOpen(false)}
        profileId={profile?.id}
        initialTab={followListTab}
      />
    </div>
  )
}
