import { useState, useRef, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useShallow } from 'zustand/react/shallow'
import { IconoirProvider, EditPencil, Xmark, Plus, ShareIos } from 'iconoir-react'
import { Button, Input, SelectWithCustom } from '../ui/index.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { supabase } from '../../lib/supabase.js'
import { uploadPhotoToGroup, deletePhotos } from '../../lib/fileLoader.js'
import { formatDateFull, cleanSpecies, cleanGear, formatLocation } from '../../lib/formatters.js'
import { MAPBOX_TOKEN, MAP_STYLE } from '../../lib/mapbox.js'
import styles from './Map.module.css'

// Static Images API can't render the Standard-based Hook Spot style,
// so the dialog mini-map is a live (non-interactive) GL map instead.
function MiniMap({ lat, lng }) {
  const containerRef = useRef(null)

  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [lng, lat],
      zoom: 11,
      interactive: false,
      attributionControl: false,
    })
    const marker = new mapboxgl.Marker({ color: '#000000' })
      .setLngLat([lng, lat])
      .addTo(map)
    return () => { marker.remove(); map.remove() }
  }, [lat, lng])

  return <div ref={containerRef} className={styles.miniMap} />
}

export function PopupCarousel({ initialGroup, onClose, onDelete, showMap = false, shareUrl = null }) {
  const leadName = initialGroup[0].name
  const isOwn = initialGroup[0]?.isOwn ?? true
  const ownerProfile = initialGroup[0]?.ownerProfile
  const groups = usePhotoStore(s => s.groups)
  const updatePhoto = usePhotoStore(s => s.updatePhoto)
  const reorderGroup = usePhotoStore(s => s.reorderGroup)
  const showToast = usePhotoStore(s => s.showToast)
  const prevRods = usePhotoStore(useShallow(s => [...new Set(s.photos.filter(p => p.isOwn).map(p => cleanGear(p.meta?.rod)).filter(Boolean))]))
  const prevFlys = usePhotoStore(useShallow(s => [...new Set(s.photos.filter(p => p.isOwn).map(p => cleanGear(p.meta?.fly)).filter(Boolean))]))

  const group = groups.find(g => g.some(p => p.name === leadName)) ?? initialGroup

  const [current, setCurrent] = useState(0)
  const [editing, setEditing] = useState(false)
  const [localOrder, setLocalOrder] = useState(null) // drag-reordered indices

  const orderedGroup = localOrder ? localOrder.map(i => group[i]) : group
  const photo = orderedGroup[Math.min(current, orderedGroup.length - 1)]
  const lead = orderedGroup[0]

  const [species, setSpecies] = useState('')
  const [rod, setRod] = useState('')
  const [fly, setFly] = useState('')

  const mainSrc = photo.url

  function startEdit() {
    setSpecies(lead.species ?? '')
    setRod(lead.meta?.rod ?? '')
    setFly(lead.meta?.fly ?? '')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function saveEdit() {
    const user = useAuthStore.getState().user
    if (!user) return
    const rodVal = cleanGear(rod)
    const flyVal = cleanGear(fly)
    const updatedMeta = { ...lead.meta, rod: rodVal, fly: flyVal, species: species || undefined }
    const updatedPhoto = { ...lead, species: species || undefined, meta: updatedMeta }
    try {
      const { error } = await supabase.from('photos')
        .update({ species: species || null, meta: updatedMeta })
        .eq('filename', lead.name)
        .eq('user_id', user.id)
      if (error) throw error
      if (lead.catchId) {
        const { error: catchError } = await supabase.from('catches')
          .update({ species: species || null, rod: rodVal, fly: flyVal })
          .eq('id', lead.catchId)
          .eq('user_id', user.id)
        if (catchError) throw catchError
      }
      updatePhoto(updatedPhoto)
      if (localOrder) {
        const newOrderedGroup = localOrder.map(i => group[i])
        const results = await Promise.all(newOrderedGroup.map((p, i) =>
          supabase.from('photos')
            .update({ meta: { ...p.meta, order: i } })
            .eq('filename', p.name)
            .eq('user_id', user.id)
        ))
        const reorderError = results.find(r => r.error)?.error
        if (reorderError) throw reorderError
        reorderGroup(newOrderedGroup)
      }
      setLocalOrder(null)
      setEditing(false)
      showToast('Changes saved')
    } catch (err) {
      console.error('[popup] saveEdit failed:', err)
      showToast('Failed to save changes')
    }
  }

  function handleDelete() {
    onDelete?.(orderedGroup.slice())
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({ url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        showToast('Link copied')
      }
    } catch (err) {
      if (err?.name === 'AbortError') return // user dismissed the share sheet
      console.error('[popup] share failed:', err)
      showToast('Failed to share')
    }
  }

  // Add photo to group
  const fileInputRef = useRef(null)
  const [addingPhoto, setAddingPhoto] = useState(false)

  async function handleAddFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAddingPhoto(true)
    try {
      const photo = await uploadPhotoToGroup(file, orderedGroup[0])
      if (photo) { setLocalOrder(null); showToast('Photo added') }
    } catch (err) {
      console.error('[popup] add photo:', err)
      showToast(err.message || 'Failed to add photo')
    } finally {
      setAddingPhoto(false)
    }
  }

  async function handleRemoveFromGroup(e, photo) {
    e.stopPropagation()
    try {
      await deletePhotos([photo])
      const remaining = usePhotoStore.getState().groups.find(g => g.some(p => p.name === leadName))
      if (!remaining) { onClose?.(); return }
      setCurrent(c => Math.min(c, remaining.length - 1))
      setLocalOrder(null)
      showToast('Photo removed')
    } catch (err) {
      console.error('[popup] remove photo:', err)
      showToast(err.message || 'Failed to remove photo')
    }
  }

  // Drag reorder for edit mode thumb strip
  const dragSrcRef = useRef(null)
  const dragGhostRef = useRef(null)

  function onThumbDragStart(e, i) {
    dragSrcRef.current = i
    e.currentTarget.classList.add(styles.dragging)
    e.dataTransfer.effectAllowed = 'move'
    const ghost = e.currentTarget.cloneNode(true)
    ghost.style.cssText = 'position:fixed;top:-200px;left:-200px;width:64px;height:64px;overflow:hidden;border-radius:8px;transform:rotate(4deg) scale(1.12);box-shadow:0 12px 32px rgba(0,0,0,0.7);border:2px solid rgba(255,255,255,0.5);'
    document.body.appendChild(ghost)
    dragGhostRef.current = ghost
    e.dataTransfer.setDragImage(ghost, 32, 32)
  }

  function onThumbDrop(e, dest) {
    e.preventDefault()
    const src = dragSrcRef.current
    if (src === null || src === dest) return
    const base = localOrder ?? group.map((_, i) => i)
    const newOrder = [...base]
    const [moved] = newOrder.splice(src, 1)
    newOrder.splice(dest, 0, moved)
    setLocalOrder(newOrder)
    setCurrent(0)
    dragSrcRef.current = null
  }

  const d = photo.time ? new Date(photo.time) : null

  const mapLat = lead.exif?.latitude
  const mapLng = lead.exif?.longitude
  const hasCoords = mapLat != null && mapLng != null

  return (
    <IconoirProvider iconProps={{ strokeWidth: 2 }}>
    <div className={styles.popup}>
      <div className={styles.mediaRow}>
      <div className={styles.imgWrapper}>
        <img className={styles.popupImg} src={mainSrc} alt={photo.name} />
        {((isOwn && editing) || orderedGroup.length > 1) && (
          <div className={styles.stripRow}>
            {orderedGroup.map((p, i) => (
              <div
                key={p.name}
                className={`${isOwn && editing ? styles.editThumb : styles.viewThumb} ${i === current ? styles.thumbActive : ''}`}
                draggable={isOwn && editing}
                onDragStart={isOwn && editing ? e => onThumbDragStart(e, i) : undefined}
                onDragOver={isOwn && editing ? e => { e.preventDefault(); e.currentTarget.classList.add(styles.dragOver) } : undefined}
                onDragLeave={isOwn && editing ? e => e.currentTarget.classList.remove(styles.dragOver) : undefined}
                onDragEnd={isOwn && editing ? () => {
                  document.querySelectorAll(`.${styles.editThumb}`).forEach(t => t.classList.remove(styles.dragging, styles.dragOver))
                  dragSrcRef.current = null
                  if (dragGhostRef.current) { document.body.removeChild(dragGhostRef.current); dragGhostRef.current = null }
                } : undefined}
                onDrop={isOwn && editing ? e => onThumbDrop(e, i) : undefined}
                onClick={() => setCurrent(i)}
              >
                <img src={p.url} alt="" />
                {isOwn && editing && (
                  <button className={styles.thumbRemoveBtn} onClick={e => handleRemoveFromGroup(e, p)} title="Remove photo">×</button>
                )}
              </div>
            ))}
            {isOwn && editing && (
              <div
                className={styles.thumbAdd}
                onClick={(e) => { e.stopPropagation(); if (!addingPhoto) fileInputRef.current?.click() }}
                title="Add photo to this catch"
              >
                {addingPhoto
                  ? <div className={styles.thumbAddSpinner} />
                  : <Plus width={22} height={22} />}
              </div>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          style={{ display: 'none' }}
          onChange={handleAddFile}
        />
      </div>
      {showMap && (
        <div className={styles.mapWrapper}>
          {hasCoords
            ? <MiniMap lat={mapLat} lng={mapLng} />
            : <div className={styles.miniMapEmpty}>No location</div>}
        </div>
      )}
      <div className={styles.imgBtns}>
        {isOwn && (
          <Button variant="icon-sm" onClick={() => editing ? cancelEdit() : startEdit()} title={editing ? 'Cancel' : 'Edit'}>
            {editing ? <Xmark width={20} height={20} /> : <EditPencil width={20} height={20} />}
          </Button>
        )}
        {shareUrl && !editing && (
          <Button variant="icon-sm" onClick={handleShare} title="Share">
            <ShareIos width={20} height={20} />
          </Button>
        )}
        {!editing && (
          <Button variant="icon-sm" onClick={onClose} title="Close">
            <Xmark width={20} height={20} />
          </Button>
        )}
      </div>
      </div>

      {isOwn && editing ? (
        <div className={styles.editForm}>
          <label>Species</label>
          <Input value={species} onChange={e => setSpecies(e.target.value)} placeholder="e.g. Brown Trout" />
          <label>Rod</label>
          <SelectWithCustom value={rod} onChange={e => setRod(e.target.value)} placeholder="Select your rod" suggestions={prevRods} />
          <label>Fly</label>
          <SelectWithCustom value={fly} onChange={e => setFly(e.target.value)} placeholder="Select your fly" suggestions={prevFlys} />
          <div className={styles.editActions}>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
            <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>
            <Button variant="primary" onClick={saveEdit}>Save</Button>
          </div>
        </div>
      ) : (
        <div className={styles.popupBody}>
          {!isOwn && ownerProfile && (
            <div className={styles.popupAttribution}>
              {ownerProfile.avatar_url
                ? <img src={ownerProfile.avatar_url} alt={ownerProfile.display_name || ownerProfile.username} className={styles.popupAttributionAvatar} />
                : <div className={styles.popupAttributionAvatarFallback}>
                    {(ownerProfile.display_name || ownerProfile.username || '?')[0].toUpperCase()}
                  </div>
              }
              <a href={`/user/${ownerProfile.username}`} className={styles.popupAttributionName}>
                {ownerProfile.display_name || ownerProfile.username}
              </a>
            </div>
          )}
          <div className={styles.popupSpecies}>
            {cleanSpecies(lead.species) ?? '—'}
          </div>
          <div className={styles.popupDetail}>
            {d ? formatDateFull(photo.time) : 'Unknown date'}
          </div>
          {((photo.meta?.weather?.temp != null && photo.meta?.weather?.condition) || formatLocation(lead.meta?.location)) && (
            <div className={styles.popupDetail}>
              {photo.meta?.weather?.temp != null && photo.meta?.weather?.condition
                ? `${photo.meta.weather.temp}°F · ${photo.meta.weather.condition}`
                : ''}
              {photo.meta?.weather?.temp != null && photo.meta?.weather?.condition && formatLocation(lead.meta?.location)
                ? ` · ${formatLocation(lead.meta?.location)}`
                : formatLocation(lead.meta?.location) ?? ''}
            </div>
          )}
          {/* rod/fly are stored on the group lead; stable across photo carousel navigation */}
          {(lead.meta?.rod || lead.meta?.fly) && (
            <div className={styles.popupDetail}>
              {[lead.meta?.rod, lead.meta?.fly].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
    </IconoirProvider>
  )
}
