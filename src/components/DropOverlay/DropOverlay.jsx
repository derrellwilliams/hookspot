import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import styles from './DropOverlay.module.css'

export function DropOverlay() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    let count = 0

    function onEnter(e) {
      if (e.dataTransfer?.types.includes('Files')) { count++; setActive(true) }
    }
    function onLeave() {
      if (--count <= 0) { count = 0; setActive(false) }
    }
    function onOver(e) { e.preventDefault() }
    function onDrop(e) {
      e.preventDefault()
      count = 0
      setActive(false)
      const files = Array.from(e.dataTransfer?.files ?? []).filter(
        f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)
      )
      if (!files.length) return
      const { setPendingUploadFiles, setUploadOpen } = usePhotoStore.getState()
      setPendingUploadFiles(files)
      setUploadOpen(true)
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
    <AnimatePresence>
      {active && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className={styles.message}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            Drop photos to add them
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
