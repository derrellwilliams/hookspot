import { memo, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { formatDateFull, cleanSpecies, formatLocation, getDisplayName } from '../../lib/formatters.js'
import styles from './Sidebar.module.css'

export const SidebarItem = memo(function SidebarItem({ group }) {
  const ref = useRef(null)
  const leadName = group[0].name
  const isActive = usePhotoStore(s => s.activeGroup?.[0]?.name === leadName)
  const user = useAuthStore(s => s.user)

  const lead = group.find(p => p.species) ?? group[0]
  const species = cleanSpecies(lead.species)

  const isOwn = group[0].isOwn ?? true
  const ownerProfile = group[0].ownerProfile
  const avatarUrl = isOwn
    ? user?.user_metadata?.avatar_url
    : ownerProfile?.avatar_url
  const displayName = isOwn ? getDisplayName(user?.user_metadata) : getDisplayName(ownerProfile)
  const initial = displayName ? displayName[0].toUpperCase() : '?'
  const locationStr = formatLocation(lead.meta?.location)

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
    <motion.button
      ref={ref}
      className={`${styles.item} ${isActive ? styles.active : ''}`}
      onClick={handleClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
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
    </motion.button>
  )
})
