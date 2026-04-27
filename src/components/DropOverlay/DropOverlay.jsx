import { useState, useEffect } from 'react'
import { handleFiles } from '../../lib/fileLoader.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import styles from './DropOverlay.module.css'

export function DropOverlay() {
  const [active, setActive] = useState(false)
  const [processing, setProcessing] = useState(null) // null or { total }
  const showToast = usePhotoStore(s => s.showToast)

  useEffect(() => {
    let count = 0

    function onEnter(e) {
      if (e.dataTransfer?.types.includes('Files')) { count++; setActive(true) }
    }
    function onLeave() {
      if (--count <= 0) { count = 0; setActive(false) }
    }
    function onOver(e) { e.preventDefault() }
    async function onDrop(e) {
      e.preventDefault()
      count = 0
      setActive(false)
      if (!e.dataTransfer?.files?.length) return
      const total = e.dataTransfer.files.length
      setProcessing({ total })
      try {
        await handleFiles(e.dataTransfer.files)
        showToast(`${total} photo${total > 1 ? 's' : ''} added`)
      } catch {
        showToast('Failed to upload photos.')
      } finally {
        setProcessing(null)
      }
    }

    document.addEventListener('dragenter', onEnter)
    document.addEventListener('dragleave', onLeave)
    document.addEventListener('dragover', onOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragenter', onEnter)
      document.removeEventListener('dragleave', onLeave)
      document.removeEventListener('dragover', onOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [])

  if (processing) {
    return (
      <div className={`${styles.overlay} ${styles.active}`}>
        <div className={styles.message}>
          <div className={styles.spinner} />
          Uploading {processing.total} photo{processing.total > 1 ? 's' : ''}…
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.overlay} ${active ? styles.active : ''}`}>
      <div className={styles.message}>Drop photos to add them</div>
    </div>
  )
}
