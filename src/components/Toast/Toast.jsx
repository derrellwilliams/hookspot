import { AnimatePresence, motion } from 'motion/react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import styles from './Toast.module.css'

export function Toast() {
  const toast = usePhotoStore(s => s.toast)
  return (
    <div className={styles.anchor}>
      <AnimatePresence>
        {toast && (
          <motion.div
            className={styles.toast}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
