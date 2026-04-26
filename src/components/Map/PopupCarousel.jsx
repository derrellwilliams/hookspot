import { useState, useRef } from 'react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { setMeta } from '../../cache.js'
import { formatDay, formatTime } from '../../lib/formatters.js'
import styles from './Map.module.css'

const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

export function PopupCarousel({ initialGroup, onDelete }) {
  const leadName = initialGroup[0].name
  const groups = usePhotoStore(s => s.groups)
  const updatePhoto = usePhotoStore(s => s.updatePhoto)

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
        <button
          className={styles.editBtn}
          onClick={() => editing ? cancelEdit() : startEdit()}
          title={editing ? 'Cancel' : 'Edit'}
        >
          {editing ? '✕' : <PencilIcon />}
        </button>
      </div>

      {orderedGroup.length > 1 && (
        <div className={styles.stripRow}>
          {orderedGroup.map((p, i) => (
            <div
              key={p.name}
              className={`${editing ? styles.editThumb : styles.viewThumb} ${i === current ? styles.thumbActive : ''} ${editing ? '' : ''}`}
              draggable={editing}
              onDragStart={editing ? e => onThumbDragStart(e, i) : undefined}
              onDragOver={editing ? e => { e.preventDefault(); e.currentTarget.classList.add(styles.dragOver) } : undefined}
              onDragLeave={editing ? e => e.currentTarget.classList.remove(styles.dragOver) : undefined}
              onDragEnd={editing ? () => { document.querySelectorAll(`.${styles.editThumb}`).forEach(t => t.classList.remove(styles.dragging, styles.dragOver)); dragSrcRef.current = null } : undefined}
              onDrop={editing ? e => onThumbDrop(e, i) : undefined}
              onClick={() => {
                setCurrent(i)
                if (editing) {
                  // Only update hero img, keep form
                }
              }}
            >
              <img src={p.url} alt="" />
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <div className={styles.editForm}>
          <label>Species</label>
          <input type="text" value={species} onChange={e => setSpecies(e.target.value)} placeholder="e.g. Brown Trout" />
          <label>Rod</label>
          <input type="text" value={rod} onChange={e => setRod(e.target.value)} placeholder="e.g. 9ft 5wt" />
          <label>Fly</label>
          <input type="text" value={fly} onChange={e => setFly(e.target.value)} placeholder="e.g. Elk Hair Caddis #14" />
          <div className={styles.editActions}>
            <button className={styles.saveBtn} onClick={saveEdit}>Save</button>
            <button className={styles.cancelEditBtn} onClick={cancelEdit}>Cancel</button>
          </div>
          <button className={styles.deleteBtn} onClick={handleDelete}>Delete entry</button>
        </div>
      ) : (
        <div className={styles.popupBody}>
          <div className={styles.popupSpecies}>
            {photo.species && photo.species !== 'none' ? photo.species : '—'}
          </div>
          <div className={`${styles.popupDetail} ${styles.popupDetailRow} ${styles.mono}`}>
            {d ? (
              <span>{`${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`} {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
            ) : (
              <span>Unknown date</span>
            )}
            {lead.meta?.rod && <><span className={styles.sep}>|</span><span>{lead.meta.rod}</span></>}
          </div>
          {lead.meta?.fly && <div className={`${styles.popupDetail} ${styles.mono}`}>{lead.meta.fly}</div>}
        </div>
      )}
    </div>
  )
}
