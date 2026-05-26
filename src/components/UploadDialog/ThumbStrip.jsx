import { useRef, useState } from 'react'
import { Xmark, Plus } from 'iconoir-react'
import { Button } from '../ui/index.js'
import styles from './UploadDialog.module.css'

export function ThumbStrip({ urls, heroIndex = 0, onSelect, onRemove, onReorder, onAddClick }) {
  const dragSrcRef = useRef(null)
  const [draggingIndex, setDraggingIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  function onDragStart(e, i) {
    dragSrcRef.current = i
    setDraggingIndex(i)
    e.dataTransfer.effectAllowed = 'move'
    const ghost = e.currentTarget.cloneNode(true)
    ghost.style.cssText = 'position:fixed;top:-200px;left:-200px;width:64px;height:64px;overflow:hidden;border-radius:8px;transform:rotate(4deg) scale(1.12);box-shadow:0 12px 32px rgba(0,0,0,0.7);border:2px solid rgba(255,255,255,0.5);'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 32, 32)
    requestAnimationFrame(() => document.body.removeChild(ghost))
  }
  function onDragOver(e, i) { e.preventDefault(); setDragOverIndex(i) }
  function onDragLeave() { setDragOverIndex(null) }
  function onDragEnd() {
    setDraggingIndex(null)
    setDragOverIndex(null)
    dragSrcRef.current = null
  }
  function onDrop(e, i) {
    e.preventDefault()
    const src = dragSrcRef.current
    setDragOverIndex(null)
    if (src === null || src === i) return
    onReorder?.(src, i)
  }

  return (
    <div className={styles.thumbStrip}>
      {urls.map((url, i) => (
        <div
          key={url}
          className={[
            styles.thumb,
            i === heroIndex ? styles.thumbHero : '',
            i === draggingIndex ? styles.dragging : '',
            i === dragOverIndex ? styles.dragOver : '',
          ].filter(Boolean).join(' ')}
          draggable
          onDragStart={e => onDragStart(e, i)}
          onDragOver={e => onDragOver(e, i)}
          onDragLeave={onDragLeave}
          onDragEnd={onDragEnd}
          onDrop={e => onDrop(e, i)}
          onClick={() => onSelect?.(i)}
        >
          <img src={url} alt="" />
          {onRemove && (
            <Button
              variant="icon-sm"
              className={styles.thumbRemove}
              onClick={e => { e.stopPropagation(); onRemove(i) }}
            ><Xmark width={20} height={20} /></Button>
          )}
        </div>
      ))}
      {onRemove && (
        <div className={`${styles.thumb} ${styles.thumbAdd}`} onClick={onAddClick}>
          <Plus width={24} height={24} />
        </div>
      )}
    </div>
  )
}
