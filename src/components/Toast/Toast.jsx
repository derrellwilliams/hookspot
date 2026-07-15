import { AnimatePresence, motion } from 'motion/react'
import { Check } from '../icons.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import { SPRING_POP } from '../../lib/motion.js'
import styles from './Toast.module.css'

export function Toast() {
  const toast = usePhotoStore(s => s.toast)
  const variant = usePhotoStore(s => s.toastVariant)
  const isSuccess = variant === 'success'
  // Desktop anchors the toast at the top (drops in from above); mobile anchors
  // it at the bottom, above MobileNav (rises in from below).
  const isMobile = useIsMobile()
  const dir = isMobile ? 1 : -1
  return (
    <div className={styles.anchor}>
      <AnimatePresence>
        {toast && (
          <motion.div
            key={`${variant}:${toast}`}
            className={isSuccess ? styles.chip : styles.toast}
            initial={isSuccess ? { opacity: 0, y: 12 * dir, scale: 0.9 } : { opacity: 0, y: 8 * dir }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 * dir, transition: { duration: 0.15, ease: 'easeOut' } }}
            transition={isSuccess ? SPRING_POP : { duration: 0.2, ease: 'easeOut' }}
          >
            {isSuccess && <Check width={16} height={16} className={styles.chipIcon} />}
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
