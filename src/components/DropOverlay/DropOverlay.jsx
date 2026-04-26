import { useState, useEffect } from 'react'
import { handleFiles } from '../../lib/fileLoader.js'
import styles from './DropOverlay.module.css'

export function DropOverlay() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    let count = 0

    function onEnter(e) {
      if (e.dataTransfer?.types.includes('Files')) {
        count++
        setActive(true)
      }
    }
    function onLeave() {
      if (--count <= 0) { count = 0; setActive(false) }
    }
    function onOver(e) { e.preventDefault() }
    async function onDrop(e) {
      e.preventDefault()
      count = 0
      setActive(false)
      if (e.dataTransfer?.files) await handleFiles(e.dataTransfer.files)
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

  return (
    <div className={`${styles.overlay} ${active ? styles.active : ''}`}>
      <div className={styles.message}>Drop photos to add them</div>
    </div>
  )
}
