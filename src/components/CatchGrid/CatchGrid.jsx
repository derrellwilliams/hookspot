import { useMemo, useEffect, useRef, memo } from 'react'
import { motion } from 'motion/react'
import { Plus } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { formatDateNumeric, cleanSpecies, formatCatchLocation, getDisplayName } from '../../lib/formatters.js'
import styles from './CatchGrid.module.css'

const spring = { type: 'spring', stiffness: 300, damping: 24 }

const CatchCard = memo(function CatchCard({ group }) {
  const ref = useRef(null)
  const leadName = group[0].name
  const isActive = usePhotoStore(s => s.activeGroup?.[0]?.name === leadName)
  const setHoveredPhotoName = usePhotoStore(s => s.setHoveredPhotoName)
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
  const locationStr = formatCatchLocation(lead.meta)

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
      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setHoveredPhotoName(leadName)}
      onMouseLeave={() => setHoveredPhotoName(null)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className={styles.imageWrap}>
        <img
          className={styles.image}
          src={lead.url}
          alt={species ? `${species} catch` : 'Fishing catch photo'}
          loading="lazy"
        />
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
        {lead.time && <div className={styles.datetime}>{formatDateNumeric(lead.time)}</div>}
        {locationStr && <div className={styles.location}>{locationStr}</div>}
      </div>
    </motion.button>
  )
})

export function CatchGrid() {
  const groups = usePhotoStore(s => s.groups)
  const hasPhotos = usePhotoStore(s => s.photos.length > 0)
  const photosInitialized = usePhotoStore(s => s.photosInitialized)
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)

  const sorted = useMemo(
    () => [...groups].sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0)),
    [groups]
  )

  if (!photosInitialized) {
    return (
      <div className={styles.loadingCentered}>
        <div className={styles.spinner} />
      </div>
    )
  }

  return (
    <div className={styles.grid}>
      {sorted.map(group => (
        <CatchCard key={`${group[0].userId}/${group[0].name}`} group={group} />
      ))}
      {!hasPhotos && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Welcome to Hook Spot!</p>
          <p className={styles.emptySubtitle}>Add photos of your catches to pin them to the map. Follow other anglers to see their catches here too.</p>
        </div>
      )}
      <motion.button
        className={styles.addCard}
        onClick={() => setUploadOpen(true)}
        whileHover={{ scale: 1.007 }}
        whileTap={{ scale: 0.975 }}
        transition={spring}
      >
        <Plus width={24} height={24} className={styles.addIcon} />
        <span className={styles.addLabel}>Add catches</span>
      </motion.button>
    </div>
  )
}
