import { useRef } from 'react'
import { Xmark, Plus } from 'iconoir-react'
import styles from './UploadDialog.module.css'

export function ThumbStrip({ urls, heroIndex = 0, onSelect, onRemove, onReorder }) {
  const dragSrcRef = useRef(null)

  function onDragStart(e, i) {
    dragSrcRef.current = i
    e.currentTarget.classList.add(styles.dragging)
    e.dataTransfer.effectAllowed = 'move'
    const ghost = e.currentTarget.cloneNode(true)
    ghost.style.cssText = 'position:fixed;top:-200px;left:-200px;width:64px;height:64px;overflow:hidden;border-radius:8px;transform:rotate(4deg) scale(1.12);box-shadow:0 12px 32px rgba(0,0,0,0.7);border:2px solid rgba(255,255,255,0.5);'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 32, 32)
    requestAnimationFrame(() => document.body.removeChild(ghost))
  }
  function onDragOver(e, el) { e.preventDefault(); el.classList.add(styles.dragOver) }
  function onDragLeave(el) { el.classList.remove(styles.dragOver) }
  function onDragEnd() {
    document.querySelectorAll(`.${styles.thumb}`).forEach(t => t.classList.remove(styles.dragging, styles.dragOver))
    dragSrcRef.current = null
  }
  function onDrop(e, i) {
    e.preventDefault()
    const dest = i
    const src = dragSrcRef.current
    document.querySelectorAll(`.${styles.thumb}`).forEach(t => t.classList.remove(styles.dragOver))
    if (src === null || src === dest) return
    onReorder?.(src, dest)
  }

  return (
    <div className={styles.thumbStrip}>
      {urls.map((url, i) => (
        <div
          key={url}
          className={`${styles.thumb} ${i === heroIndex ? styles.thumbHero : ''}`}
          draggable
          onDragStart={e => onDragStart(e, i)}
          onDragOver={e => onDragOver(e, e.currentTarget)}
          onDragLeave={e => onDragLeave(e.currentTarget)}
          onDragEnd={onDragEnd}
          onDrop={e => onDrop(e, i)}
          onClick={() => onSelect?.(i)}
        >
          <img src={url} alt="" />
          {onRemove && (
            <button
              className={styles.thumbRemove}
              onClick={e => { e.stopPropagation(); onRemove(i) }}
            ><Xmark width={24} height={24} /></button>
          )}
        </div>
      ))}
      {onRemove && (
        <div className={`${styles.thumb} ${styles.thumbAdd}`} onClick={() => document.getElementById('__file-input').click()}>
          <Plus width={24} height={24} />
        </div>
      )}
    </div>
  )
}
