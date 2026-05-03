import { useState, useRef } from 'react'
import { IconoirProvider, EditPencil, Xmark, Plus } from 'iconoir-react'
import { Button, Input, SelectWithCustom } from '../ui/index.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { supabase } from '../../lib/supabase.js'
import { uploadPhotoToGroup, deletePhotos } from '../../lib/fileLoader.js'
import { formatDateFull, cleanSpecies } from '../../lib/formatters.js'
import styles from './Map.module.css'

export function PopupCarousel({ initialGroup, onClose, onDelete }) {
  const leadName = initialGroup[0].name
  const groups = usePhotoStore(s => s.groups)
  const updatePhoto = usePhotoStore(s => s.updatePhoto)
  const reorderGroup = usePhotoStore(s => s.reorderGroup)
  const photos = usePhotoStore(s => s.photos)
  const showToast = usePhotoStore(s => s.showToast)
  const prevRods = [...new Set(photos.map(p => p.meta?.rod).filter(Boolean))]
  const prevFlys = [...new Set(photos.map(p => p.meta?.fly).filter(Boolean))]

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
    const updatedMeta = { ...lead.meta, rod, fly, species: species || undefined }
    const updatedPhoto = { ...lead, species: species || undefined, meta: updatedMeta }
    try {
      const { error } = await supabase.from('photos')
        .update({ species: species || null, meta: updatedMeta })
        .eq('filename', lead.name)
        .eq('user_id', user.id)
      if (error) throw error
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

  return (
    <IconoirProvider iconProps={{ strokeWidth: 2 }}>
    <div className={styles.popup}>
      <div className={styles.imgWrapper}>
        <img className={styles.popupImg} src={photo.url} alt={photo.name} />
        <div className={styles.imgBtns}>
          <Button variant="icon-sm" onClick={() => editing ? cancelEdit() : startEdit()} title={editing ? 'Cancel' : 'Edit'}>
            {editing ? <Xmark width={20} height={20} /> : <EditPencil width={20} height={20} />}
          </Button>
          {!editing && (
            <Button variant="icon-sm" onClick={onClose} title="Close">
              <Xmark width={20} height={20} />
            </Button>
          )}
        </div>
        {(editing || orderedGroup.length > 1) && (
          <div className={styles.stripRow}>
            {orderedGroup.map((p, i) => (
              <div
                key={p.name}
                className={`${editing ? styles.editThumb : styles.viewThumb} ${i === current ? styles.thumbActive : ''}`}
                draggable={editing}
                onDragStart={editing ? e => onThumbDragStart(e, i) : undefined}
                onDragOver={editing ? e => { e.preventDefault(); e.currentTarget.classList.add(styles.dragOver) } : undefined}
                onDragLeave={editing ? e => e.currentTarget.classList.remove(styles.dragOver) : undefined}
                onDragEnd={editing ? () => {
                  document.querySelectorAll(`.${styles.editThumb}`).forEach(t => t.classList.remove(styles.dragging, styles.dragOver))
                  dragSrcRef.current = null
                  if (dragGhostRef.current) { document.body.removeChild(dragGhostRef.current); dragGhostRef.current = null }
                } : undefined}
                onDrop={editing ? e => onThumbDrop(e, i) : undefined}
                onClick={() => setCurrent(i)}
              >
                <img src={p.url} alt="" />
                {editing && (
                  <button className={styles.thumbRemoveBtn} onClick={e => handleRemoveFromGroup(e, p)} title="Remove photo">×</button>
                )}
              </div>
            ))}
            {editing && (
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

      {editing ? (
        <div className={styles.editForm}>
          <label>Species</label>
          <Input value={species} onChange={e => setSpecies(e.target.value)} placeholder="e.g. Brown Trout" />
          <label>Rod</label>
          <SelectWithCustom value={rod} onChange={e => setRod(e.target.value)} placeholder="e.g. 9ft 5wt" suggestions={prevRods} />
          <label>Fly</label>
          <SelectWithCustom value={fly} onChange={e => setFly(e.target.value)} placeholder="e.g. Elk Hair Caddis #14" suggestions={prevFlys} />
          <div className={styles.editActions}>
            <Button variant="danger" onClick={handleDelete}>Delete entry</Button>
            <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>
            <Button variant="primary" onClick={saveEdit}>Save</Button>
          </div>
        </div>
      ) : (
        <div className={styles.popupBody}>
          <div className={styles.popupSpecies}>
            {cleanSpecies(lead.species) ?? '—'}
          </div>
          <div className={styles.popupDetail}>
            {d ? formatDateFull(photo.time) : 'Unknown date'}
            {lead.meta?.location?.city && lead.meta?.location?.state
              ? ` · ${lead.meta.location.city}, ${lead.meta.location.state}`
              : ''}
          </div>
          {photo.meta?.weather?.temp != null && photo.meta?.weather?.condition && (
            <div className={styles.popupDetail}>
              {photo.meta.weather.temp}°F · {photo.meta.weather.condition}
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
