import { memo, useEffect, useRef } from 'react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { formatDay, formatTime } from '../../lib/formatters.js'
import styles from './Sidebar.module.css'

export const SidebarItem = memo(function SidebarItem({ group }) {
  const ref = useRef(null)
  const leadName = group[0].name
  const isActive = usePhotoStore(s => s.activeGroup?.[0]?.name === leadName)

  const lead = group.find(p => p.species) ?? group[0]
  const species = lead.species && lead.species !== 'none'
    ? lead.species.replace(/\s*\(.*?\)/g, '').trim()
    : null

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' })
    }
  }, [isActive])

  function handleClick() {
    const { setActiveGroup, flyToPhoto } = usePhotoStore.getState()
    setActiveGroup(group)
    flyToPhoto?.(group[0])
  }

  return (
    <div
      ref={ref}
      className={`${styles.item} ${isActive ? styles.active : ''}`}
      onClick={handleClick}
    >
      <div className={styles.thumbWrap}>
        <img className={styles.thumb} src={lead.url} alt={lead.name} loading="lazy" />

      </div>
      <div className={styles.meta}>
        {species && <div className={styles.species}>{species}</div>}
        {lead.time
          ? <div className={styles.date}><span className={styles.mono}>{formatDay(lead.time)} {formatTime(lead.time)}</span></div>
          : <div className={styles.date}>No date</div>
        }
      </div>
    </div>
  )
})
