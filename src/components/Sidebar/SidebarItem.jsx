import { memo, useEffect, useRef } from 'react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { formatDateFull, cleanSpecies } from '../../lib/formatters.js'
import styles from './Sidebar.module.css'

export const SidebarItem = memo(function SidebarItem({ group }) {
  const ref = useRef(null)
  const leadName = group[0].name
  const isActive = usePhotoStore(s => s.activeGroup?.[0]?.name === leadName)
  const user = useAuthStore(s => s.user)

  const lead = group.find(p => p.species) ?? group[0]
  const species = cleanSpecies(lead.species)

  const avatarUrl = user?.user_metadata?.avatar_url
  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || ''
  const initial = displayName ? displayName[0].toUpperCase() : '?'

  const location = lead.meta?.location
  const locationStr = location?.city && location?.state
    ? `${location.city}, ${location.state}`
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
    <button
      ref={ref}
      className={`${styles.item} ${isActive ? styles.active : ''}`}
      onClick={handleClick}
    >
      <div className={styles.thumbWrap}>
        <img className={styles.thumb} src={lead.url} alt={species ? `${species} catch` : 'Fishing catch photo'} loading="lazy" />
      </div>
      <div className={styles.meta}>
        <div className={styles.angler}>
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} className={styles.anglerAvatar} />
            : <div className={styles.anglerAvatarFallback}>{initial}</div>
          }
          {displayName && <span className={styles.anglerName}>{displayName}</span>}
        </div>
        {species && <div className={styles.species}>{species}</div>}
        {lead.time && (
          <div className={styles.datetime}>{formatDateFull(lead.time)}</div>
        )}
        {locationStr && (
          <div className={styles.location}>{locationStr}</div>
        )}
      </div>
    </button>
  )
})
