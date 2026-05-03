import { useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { EditPencil, UserCircle } from 'iconoir-react'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { renderStats } from '../stats.js'
import { Button } from '../components/ui/index.js'
import { FavoritePickerDialog } from '../components/FavoritePicker/FavoritePickerDialog.jsx'
import { supabase } from '../lib/supabase.js'
import { formatDateFull, cleanSpecies } from '../lib/formatters.js'
import styles from './ProfilePage.module.css'

const FAVORITES_KEY = 'hookspot:favorites'

function loadFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) ?? [null, null, null, null] }
  catch { return [null, null, null, null] }
}

function saveFavorites(favs) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs))
}

async function uploadAvatar(file) {
  const dataUrl = await createImageDataUrl(file)
  const { data, error } = await supabase.auth.updateUser({ data: { avatar_url: dataUrl } })
  if (error) throw new Error(`Profile update failed: ${error.message}`)
  return data.user
}

function createImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const size = 128
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      const s = Math.min(img.width, img.height)
      const sx = (img.width - s) / 2
      const sy = (img.height - s) / 2
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')) }
    img.src = url
  })
}

export function ProfilePage() {
  const photos = usePhotoStore(s => s.photos)
  const groups = usePhotoStore(s => s.groups)
  const showToast = usePhotoStore(s => s.showToast)
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const signOut = useAuthStore(s => s.signOut)

  const [uploading, setUploading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [favorites, setFavorites] = useState(loadFavorites)
  const [pickerSlot, setPickerSlot] = useState(null) // null = closed, 0–3 = open for slot

  const fileInputRef = useRef(null)
  const totalRef = useRef(null)
  const monthlyRef = useRef(null)
  const hourlyRef = useRef(null)
  const speciesRef = useRef(null)
  const speciesMonthlyRef = useRef(null)
  const weatherCondRef = useRef(null)
  const weatherTempRef = useRef(null)

  useEffect(() => {
    renderStats(groups, {
      total: totalRef.current,
      monthly: monthlyRef.current,
      hourly: hourlyRef.current,
      species: speciesRef.current,
      speciesMonthly: speciesMonthlyRef.current,
      weatherCond: weatherCondRef.current,
      weatherTemp: weatherTempRef.current,
    })
  }, [groups])

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      const updatedUser = await uploadAvatar(file)
      setUser(updatedUser)
      showToast('Profile photo updated!')
    } catch (err) {
      console.error('[hookspot] avatar upload failed', err)
      showToast(err.message || 'Failed to upload photo.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function handleSelectFavorite(photo) {
    const next = favorites.map((f, i) => i === pickerSlot ? photo.name : f)
    setFavorites(next)
    saveFavorites(next)
    setPickerSlot(null)
  }

  function handleRemoveFavorite() {
    const next = favorites.map((f, i) => i === pickerSlot ? null : f)
    setFavorites(next)
    saveFavorites(next)
    setPickerSlot(null)
  }

  const photoMap = useMemo(() => Object.fromEntries(photos.map(p => [p.name, p])), [photos])
  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || ''
  const bio = user?.user_metadata?.bio || ''
  const avatarUrl = user?.user_metadata?.avatar_url
  const initial = displayName ? displayName[0].toUpperCase() : '?'
  function openDialog() {
    setEditName(displayName)
    setEditBio(bio)
    setDialogOpen(true)
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { display_name: editName.trim(), bio: editBio.trim() },
      })
      if (error) throw error
      setUser(data.user)
      setDialogOpen(false)
    } catch (err) {
      console.error('[hookspot] profile save failed', err)
      showToast('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.scroll}>

        {/* Profile header */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrap}>
            <button
              className={styles.avatar}
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
            {!avatarUrl && (
              <div className={styles.avatarEditBadge} aria-hidden="true">
                <EditPencil width={10} height={10} />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={handleAvatarChange}
          />

          <div className={styles.profileInfo}>
            <div className={styles.profileNameRow}>
              <span className={displayName ? styles.profileName : styles.profileNameEmpty}>
                {displayName || 'What\'s your name?'}
              </span>
              <button className={styles.editBtn} onClick={openDialog} aria-label="Edit profile">
                <EditPencil width={15} height={15} />
              </button>
            </div>
            <button
              className={bio ? styles.profileBio : styles.profileBioEmpty}
              onClick={openDialog}
              aria-label={bio ? 'Edit bio' : 'Add bio'}
            >
              {bio || 'Tell us about yourself'}
            </button>
          </div>
        </div>

        {/* Favorites grid */}
        <div className={styles.favoritesLabel}>Favorites</div>
        <div className={styles.favoritesGrid}>
          {favorites.map((name, i) => {
            const photo = name ? photoMap[name] : null
            if (photo) {
              const species = cleanSpecies(photo.species)
              return (
                <button key={i} className={`${styles.favoriteSlot} ${styles.favoriteSlotFilled}`} onClick={() => setPickerSlot(i)}>
                  <img src={photo.url} alt={species ? `${species} catch` : 'Fishing catch photo'} className={styles.favoriteImg} />
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
            return (
              <button key={i} className={styles.favoriteSlot} onClick={() => setPickerSlot(i)}>
                <span className={styles.favoriteHint}>+</span>
              </button>
            )
          })}
        </div>

        {/* Stats */}
        <div className={styles.header}>
          <span className={styles.title}>Stats</span>
          <span ref={totalRef} className={styles.total} />
        </div>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Catches per Month</div>
            <div ref={monthlyRef} />
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Time of Day</div>
            <div ref={hourlyRef} />
          </div>
          <div className={styles.row2}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Species</div>
              <div ref={speciesRef} />
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Species by Month</div>
              <div ref={speciesMonthlyRef} />
            </div>
          </div>
          <div className={styles.row2}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Catches by Condition</div>
              <div ref={weatherCondRef} />
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Catches by Temperature</div>
              <div ref={weatherTempRef} />
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </div>
      </div>

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
                  <button
                    className={styles.avatar}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    aria-label="Change profile photo"
                    type="button"
                  >
                    {avatarUrl
                      ? <img src={avatarUrl} alt={displayName || 'Profile'} className={styles.avatarImg} />
                      : displayName
                        ? <span className={styles.avatarInitial}>{displayName[0].toUpperCase()}</span>
                        : <UserCircle width={40} height={40} className={styles.avatarPlaceholder} />
                    }
                    {uploading && <div className={styles.avatarOverlay}><span className={styles.avatarSpinner} /></div>}
                  </button>
                  {!avatarUrl && (
                    <div className={styles.avatarEditBadge}>
                      <EditPencil width={10} height={10} />
                    </div>
                  )}
                </div>
              </div>
              <input
                className={styles.editNameInput}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="What's your name?"
                maxLength={60}
                autoFocus
              />
              <textarea
                className={styles.editBioInput}
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                placeholder="Tell us about yourself"
                maxLength={200}
                rows={4}
              />
            </div>
            <div className={styles.dialogFooter}>
              <button className={styles.cancelBtn} onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</button>
              <button className={styles.saveBtn} onClick={saveProfile} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
