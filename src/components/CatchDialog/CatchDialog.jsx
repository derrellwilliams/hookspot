import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import * as Dialog from '@radix-ui/react-dialog'
import { NavArrowLeft, NavArrowRight } from '../icons.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { deletePhotos } from '../../lib/fileLoader.js'
import { PopupCarousel } from '../Map/PopupCarousel.jsx'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import { sortByRecency } from '../../lib/groupPhotos.js'
import { EASE_OUT, EASE_ENTER, EASE_DRAWER } from '../../lib/motion.js'
import styles from './CatchDialog.module.css'

// Catch dialog for the map page — same look as the profile page's catch
// dialog, minus the mini-map (the big map is right there behind it).
// Desktop: centered with prev/next arrows; mobile: bottom sheet.
export function CatchDialog() {
  const activeGroup = usePhotoStore(s => s.activeGroup)
  const groups = usePhotoStore(s => s.groups)
  const setActiveGroup = usePhotoStore(s => s.setActiveGroup)
  const isMobile = useIsMobile()

  const sorted = useMemo(() => [...groups].sort(sortByRecency), [groups])
  const idx = activeGroup ? sorted.findIndex(g => g[0].name === activeGroup[0].name) : -1

  async function handleDelete(toDelete) {
    setActiveGroup(null)
    try {
      await deletePhotos(toDelete)
      usePhotoStore.getState().showToast('Catch deleted')
    } catch (err) {
      console.error('[catch dialog] delete failed:', err)
      usePhotoStore.getState().showToast('Failed to delete catch')
    }
  }

  return (
    <Dialog.Root open={!!activeGroup} onOpenChange={o => { if (!o) setActiveGroup(null) }}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {activeGroup && (
            <>
              <Dialog.Overlay asChild>
                <motion.div
                  className={styles.backdrop}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </Dialog.Overlay>
              <Dialog.Content className={styles.positioner} aria-describedby={undefined}>
                <Dialog.Title className={styles.srOnly}>Catch details</Dialog.Title>
                {!isMobile && (
                  <button
                    className={styles.navArrow}
                    onClick={() => setActiveGroup(sorted[idx - 1])}
                    disabled={idx <= 0}
                    aria-label="Previous catch"
                  >
                    <NavArrowLeft width={18} height={18} />
                  </button>
                )}
                <motion.div
                  className={styles.content}
                  initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 4 }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                  exit={isMobile
                    ? { y: '100%', transition: { duration: 0.3, ease: EASE_DRAWER } }
                    : { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.15, ease: EASE_OUT } }}
                  transition={isMobile
                    ? { duration: 0.35, ease: EASE_DRAWER }
                    : { duration: 0.25, ease: EASE_ENTER }}
                >
                  <PopupCarousel
                    key={activeGroup[0].catchId ?? activeGroup[0].name}
                    initialGroup={activeGroup}
                    sheet
                    onClose={() => setActiveGroup(null)}
                    onDelete={handleDelete}
                  />
                </motion.div>
                {!isMobile && (
                  <button
                    className={styles.navArrow}
                    onClick={() => setActiveGroup(sorted[idx + 1])}
                    disabled={idx < 0 || idx >= sorted.length - 1}
                    aria-label="Next catch"
                  >
                    <NavArrowRight width={18} height={18} />
                  </button>
                )}
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
