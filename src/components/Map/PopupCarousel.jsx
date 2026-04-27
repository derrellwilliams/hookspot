import { useState, useRef } from 'react'
import { EditPencil, Xmark } from 'iconoir-react'
import { Button, Input, SelectWithCustom } from '../ui/index.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { setMeta } from '../../cache.js'
import { formatDay, formatTime } from '../../lib/formatters.js'
import styles from './Map.module.css'

export function PopupCarousel({ initialGroup, onClose, onDelete }) {
  const leadName = initialGroup[0].name
  const groups = usePhotoStore(s => s.groups)
  const updatePhoto = usePhotoStore(s => s.updatePhoto)
  const reorderGroup = usePhotoStore(s => s.reorderGroup)
  const photos = usePhotoStore(s => s.photos)
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
    const updatedMeta = { ...lead.meta, rod, fly, species: species || undefined }
    const updatedPhoto = { ...lead, species: species || undefined, meta: updatedMeta }
    await setMeta(lead.name, updatedMeta)
    updatePhoto(updatedPhoto)
    if (localOrder) {
      const newOrderedGroup = localOrder.map(i => group[i])
      reorderGroup(newOrderedGroup)
      await Promise.all(newOrderedGroup.map((p, i) => setMeta(p.name, { ...p.meta, order: i })))
    }
    setLocalOrder(null)
    setEditing(false)
  }

  function handleDelete() {
    onDelete?.(orderedGroup.slice())
  }

  // Drag reorder for edit mode thumb strip
  const dragSrcRef = useRef(null)

  function onThumbDragStart(e, i) {
    dragSrcRef.current = i
    e.currentTarget.classList.add(styles.dragging)
    e.dataTransfer.effectAllowed = 'move'
    const ghost = e.currentTarget.cloneNode(true)
    ghost.style.cssText = 'position:fixed;top:-200px;left:-200px;width:64px;height:64px;overflow:hidden;border-radius:8px;transform:rotate(4deg) scale(1.12);box-shadow:0 12px 32px rgba(0,0,0,0.7);border:2px solid rgba(255,255,255,0.5);'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 32, 32)
    requestAnimationFrame(() => document.body.removeChild(ghost))
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
        {orderedGroup.length > 1 && (
          <div className={styles.stripRow}>
            {orderedGroup.map((p, i) => (
              <div
                key={p.name}
                className={`${editing ? styles.editThumb : styles.viewThumb} ${i === current ? styles.thumbActive : ''}`}
                draggable={editing}
                onDragStart={editing ? e => onThumbDragStart(e, i) : undefined}
                onDragOver={editing ? e => { e.preventDefault(); e.currentTarget.classList.add(styles.dragOver) } : undefined}
                onDragLeave={editing ? e => e.currentTarget.classList.remove(styles.dragOver) : undefined}
                onDragEnd={editing ? () => { document.querySelectorAll(`.${styles.editThumb}`).forEach(t => t.classList.remove(styles.dragging, styles.dragOver)); dragSrcRef.current = null } : undefined}
                onDrop={editing ? e => onThumbDrop(e, i) : undefined}
                onClick={() => setCurrent(i)}
              >
                <img src={p.url} alt="" />
              </div>
            ))}
          </div>
        )}
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
            {photo.species && photo.species !== 'none' ? photo.species : '—'}
          </div>
          <div className={styles.popupDetail}>
            {d ? `${formatDay(photo.time)} ${formatTime(photo.time)}` : 'Unknown date'}
            {photo.meta?.weather && ` · ${photo.meta.weather.temp}°F · ${photo.meta.weather.condition}`}
          </div>
          {(lead.meta?.rod || lead.meta?.fly) && (
            <div className={styles.popupDetail}>
              {[lead.meta?.rod, lead.meta?.fly].filter(Boolean).join(' with ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
