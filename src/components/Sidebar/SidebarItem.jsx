import { useEffect, useRef } from 'react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { formatDay, formatTime } from '../../lib/formatters.js'
import styles from './Sidebar.module.css'

export function SidebarItem({ group }) {
  const ref = useRef(null)
  const flyToPhoto = usePhotoStore(s => s.flyToPhoto)
  const activeGroup = usePhotoStore(s => s.activeGroup)
  const setActiveGroup = usePhotoStore(s => s.setActiveGroup)

  const isActive = activeGroup === group || activeGroup?.[0]?.name === group[0].name
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
        {lead.meta?.fly && <div className={styles.gear}>{lead.meta.fly}</div>}
      </div>
    </div>
  )
}
