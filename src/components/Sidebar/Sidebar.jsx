import { useMemo } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { Plus } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { SidebarItem } from './SidebarItem.jsx'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const groups = usePhotoStore(s => s.groups)
  const hasPhotos = usePhotoStore(s => s.photos.length > 0)
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)

  const items = useMemo(() => {
    const sorted = [...groups].sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0))
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
  }, [groups])

  return (
    <aside id="sidebar" className={styles.sidebar}>
      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport className={styles.scrollViewport}>
          <div className={styles.list}>
            {!hasPhotos && (
              <div className={styles.empty}>
                <p>Drop photos here or click <strong>+</strong> to get started.</p>
                <p className={styles.hint}>Photos need GPS data embedded to appear on the map.</p>
              </div>
            )}
            {items.map(item =>
              item.type === 'header'
                ? <div key={item.key} className={styles.monthHeader}>{item.label}</div>
                : <SidebarItem key={item.group[0].name} group={item.group} />
            )}
            <div className={styles.addCard} onClick={() => setUploadOpen(true)}>
              <Plus width={24} height={24} className={styles.addIcon} />
              <span className={styles.addLabel}>Add a catch</span>
            </div>
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
          <ScrollArea.Thumb className={styles.scrollThumb} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </aside>
  )
}
