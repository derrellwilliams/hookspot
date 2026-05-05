import { useMemo, useRef } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { Plus } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { handleFiles } from '../../lib/fileLoader.js'
import { SidebarItem } from './SidebarItem.jsx'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const groups = usePhotoStore(s => s.groups)
  const hasPhotos = usePhotoStore(s => s.photos.length > 0)
  const photosInitialized = usePhotoStore(s => s.photosInitialized)
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const bulkUploading = usePhotoStore(s => s.bulkUploading)
  const setBulkUploading = usePhotoStore(s => s.setBulkUploading)
  const setPendingUploadFiles = usePhotoStore(s => s.setPendingUploadFiles)
  const showToast = usePhotoStore(s => s.showToast)
  const fileInputRef = useRef(null)
  const ownOnly = usePhotoStore(s => s.ownOnly)
  const setOwnOnly = usePhotoStore(s => s.setOwnOnly)

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

  async function onFileChange(e) {
    const files = Array.from(e.target.files).filter(
      f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)
    )
    e.target.value = ''
    if (!files.length) return

    if (files.length === 1) {
      setPendingUploadFiles(files)
      setUploadOpen(true)
    } else {
      setBulkUploading(true)
      try {
        await handleFiles(files, {})
        showToast(`${files.length} catches added!`)
      } catch {
        showToast('Upload failed.')
      } finally {
        setBulkUploading(false)
      }
    }
  }

  return (
    <aside id="sidebar" className={styles.sidebar}>
      <div className={styles.filterRow}>
        <span className={styles.filterTitle}>Latest Catches</span>
        {hasOthers && (
          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterTab} ${!ownOnly ? styles.filterTabActive : ''}`}
              onClick={() => setOwnOnly(false)}
            >All</button>
            <button
              className={`${styles.filterTab} ${ownOnly ? styles.filterTabActive : ''}`}
              onClick={() => setOwnOnly(true)}
            >Mine</button>
          </div>
        )}
      </div>
      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport className={styles.scrollViewport}>
          <div className={styles.list}>
            {!photosInitialized ? (
              <div className={styles.loadingState} />
            ) : !hasPhotos ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>Welcome to Hook Spot!</p>
                <p className={styles.emptySubtitle}>Add photos of your catches to pin them to the map. Follow other anglers to see their catches here too.</p>
              </div>
            ) : null}
            {items.map(item =>
              item.type === 'header'
                ? <div key={item.key} className={styles.monthHeader}>{item.label}</div>
                : <SidebarItem key={item.group[0].name} group={item.group} />
            )}
            {bulkUploading ? (
              <div className={styles.bulkProgress}>
                <div className={styles.spinner} />
                <span className={styles.addLabel}>Uploading…</span>
              </div>
            ) : (
              <button className={styles.addCard} onClick={() => setUploadOpen(true)}>
                <Plus width={24} height={24} className={styles.addIcon} />
                <span className={styles.addLabel}>Add catches</span>
              </button>
            )}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
          <ScrollArea.Thumb className={styles.scrollThumb} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
    </aside>
  )
}
