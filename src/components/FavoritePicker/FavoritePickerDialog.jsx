import { useState, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { Check } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { formatDateFull, cleanSpecies } from '../../lib/formatters.js'
import styles from './FavoritePickerDialog.module.css'

export function FavoritePickerDialog({ open, current, onSelect, onRemove, onClose }) {
  const photos = usePhotoStore(s => s.photos)
  const [selected, setSelected] = useState(current)

  function handleOpenChange(o) {
    if (o) setSelected(current)
    else onClose()
  }

  const items = useMemo(() => {
    const sorted = [...photos].sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
    const result = []
    let lastKey = null
    for (const photo of sorted) {
      const monthKey = photo.time
        ? new Date(photo.time).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
        : null
      if (monthKey && monthKey !== lastKey) {
        result.push({ type: 'header', label: monthKey, key: monthKey })
        lastKey = monthKey
      }
      result.push({ type: 'photo', photo })
    }
    return result
  }, [photos])

  function handleSubmit() {
    const photo = photos.find(p => p.name === selected)
    if (photo) onSelect(photo)
    else onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.backdrop} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <Dialog.Title className={styles.srOnly}>Choose a favorite catch</Dialog.Title>

          {photos.length === 0 ? (
            <div className={styles.empty}>No catches yet — add some first.</div>
          ) : (
            <ScrollArea.Root className={styles.scrollRoot}>
              <ScrollArea.Viewport className={styles.scrollViewport}>
                <div className={styles.list}>
                  {items.map(item => {
                    if (item.type === 'header') {
                      return <div key={item.key} className={styles.monthHeader}>{item.label}</div>
                    }
                    const { photo } = item
                    const species = cleanSpecies(photo.species)
                    const isSelected = photo.name === selected
                    return (
                      <button
                        key={photo.name}
                        className={`${styles.item} ${isSelected ? styles.active : ''}`}
                        onClick={() => setSelected(photo.name)}
                      >
                        <img src={photo.url} alt={species ? `${species} catch` : 'Fishing catch photo'} className={styles.thumb} />
                        <div className={styles.meta}>
                          {species && <div className={styles.species}>{species}</div>}
                          <div className={styles.date}>
                            {photo.time ? formatDateFull(photo.time) : 'No date'}
                          </div>
                        </div>
                        {isSelected && <Check width={16} height={16} className={styles.check} />}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
                <ScrollArea.Thumb className={styles.scrollThumb} />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          )}

          <div className={styles.footer}>
            {current && onRemove && (
              <button className={styles.removeBtn} onClick={onRemove}>Remove</button>
            )}
            <div className={styles.footerActions}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button className={styles.selectBtn} onClick={handleSubmit} disabled={!selected}>Select</button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
