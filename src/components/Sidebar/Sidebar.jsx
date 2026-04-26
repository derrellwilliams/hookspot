import * as ScrollArea from '@radix-ui/react-scroll-area'
import { Plus } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { SidebarItem } from './SidebarItem.jsx'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const groups = usePhotoStore(s => s.groups)
  const photos = usePhotoStore(s => s.photos)
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)

  const sorted = [...groups].sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0))
  const hasPhotos = photos.length > 0

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
            {sorted.map(group => (
              <SidebarItem key={group[0].name} group={group} />
            ))}
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
