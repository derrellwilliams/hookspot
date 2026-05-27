import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { Plus } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { SidebarItem } from './SidebarItem.jsx'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const groups = usePhotoStore(s => s.groups)
  const hasPhotos = usePhotoStore(s => s.photos.length > 0)
  const photosInitialized = usePhotoStore(s => s.photosInitialized)
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const ownOnly = usePhotoStore(s => s.ownOnly)
  const setOwnOnly = usePhotoStore(s => s.setOwnOnly)
  const [hoveredTab, setHoveredTab] = useState(null)

  const hasOthers = useMemo(() => groups.some(g => g.some(p => !p.isOwn)), [groups])

  const items = useMemo(() => {
    const filtered = ownOnly ? groups.filter(g => g.some(p => p.isOwn)) : groups
    const sorted = [...filtered].sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0))
    const result = []
    let lastKey = null
    for (const group of sorted) {
      const ts = group[0].time
      const monthKey = ts
        ? new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
        : null
      if (monthKey && monthKey !== lastKey) {
        result.push({ type: 'header', label: monthKey, key: monthKey })
        lastKey = monthKey
      }
      result.push({ type: 'group', group })
    }
    return result
  }, [groups, ownOnly])

  return (
    <aside id="sidebar" className={styles.sidebar}>
      <div className={styles.filterRow}>
        <span className={styles.filterTitle}>Latest Catches</span>
        {hasOthers && (
          <div
            className={styles.filterTabs}
            onMouseLeave={() => setHoveredTab(null)}
          >
            {[{ label: 'Everyone', value: false }, { label: 'Me', value: true }].map(({ label, value }) => {
              const isActive = ownOnly === value
              return (
                <button
                  key={label}
                  className={`${styles.filterTab} ${isActive ? styles.filterTabActive : ''}`}
                  onClick={() => setOwnOnly(value)}
                  onMouseEnter={() => setHoveredTab(value)}
                >
                  <AnimatePresence>
                    {hoveredTab === value && !isActive && (
                      <motion.div
                        className={styles.filterHover}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      />
                    )}
                  </AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="filter-highlight"
                      className={styles.filterHighlight}
                      initial={false}
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className={styles.filterLabel}>{label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {!photosInitialized ? (
        <div className={styles.loadingCentered}>
          <div className={styles.spinner} />
        </div>
      ) : (
        <ScrollArea.Root className={styles.scrollRoot}>
          <ScrollArea.Viewport className={styles.scrollViewport}>
            <div className={styles.list}>
              {items.map(item =>
                item.type === 'header'
                  ? <div key={item.key} className={styles.monthHeader}>{item.label}</div>
                  : <SidebarItem key={item.group[0].name} group={item.group} />
              )}
              {!hasPhotos && (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>Welcome to Hook Spot!</p>
                  <p className={styles.emptySubtitle}>Add photos of your catches to pin them to the map. Follow other anglers to see their catches here too.</p>
                </div>
              )}
              <button className={styles.addCard} onClick={() => setUploadOpen(true)}>
                <Plus width={24} height={24} className={styles.addIcon} />
                <span className={styles.addLabel}>Add catches</span>
              </button>
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
            <ScrollArea.Thumb className={styles.scrollThumb} />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      )}
    </aside>
  )
}
