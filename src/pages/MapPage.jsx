import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { CatchGrid } from '../components/CatchGrid/CatchGrid.jsx'
import { CatchDialog } from '../components/CatchDialog/CatchDialog.jsx'
import { MapView } from '../components/Map/MapView.jsx'
import { useIsMobile, useReducedMotion } from '../hooks/useIsMobile.js'
import { ListView, MapPin, MapExpand, MapCollapse } from '../components/icons.js'
import { SPRING, SPRING_SMOOTH, SPRING_SNAPPY } from '../lib/motion.js'
import styles from './MapPage.module.css'

const VIEWS = [
  { id: 'list', label: 'List view', Icon: ListView },
  { id: 'map', label: 'Map view', Icon: MapPin },
]

export function MapPage({ active }) {
  const isMobile = useIsMobile()
  const reducedMotion = useReducedMotion()
  const [mobileView, setMobileView] = useState('list')
  const [mapExpanded, setMapExpanded] = useState(false)

  // Collapsed state is desktop-only — drop it on the way into mobile so a
  // later resize back doesn't restore a stale expanded map.
  useEffect(() => {
    if (isMobile) setMapExpanded(false)
  }, [isMobile])

  return (
    <div id="sidebar-anchor" className={styles.page}>
      {!isMobile && (
        <motion.div
          layout={!reducedMotion}
          animate={{ opacity: mapExpanded ? 0 : 1 }}
          transition={{ layout: SPRING_SMOOTH, opacity: { duration: 0.15 } }}
          className={`${styles.cardsPane} ${mapExpanded ? styles.cardsPaneCollapsed : ''}`}
        >
          <CatchGrid />
        </motion.div>
      )}
      {/* Dialog portals to <body>, so gate on `active` — MapPage stays
          mounted (display:none) while other routes are shown */}
      {active && <CatchDialog />}
      <motion.div
        layout={!isMobile && !reducedMotion}
        transition={SPRING_SMOOTH}
        className={`${styles.mapPane} ${isMobile && mobileView === 'list' ? styles.mapPaneHidden : ''}`}
      >
        <MapView active={active && (!isMobile || mobileView === 'map')} />
      </motion.div>
      {/* Rendered as a sibling of .mapPane, not a child — .mapPane's `layout`
          FLIP animation applies a non-uniform scaleX transform to itself
          during the resize, and any CSS transform affects all descendants.
          Keeping this button out of that subtree means it never inherits
          the distortion, so it doesn't need (and shouldn't have) its own
          `layout` prop just to correct for it. */}
      {!isMobile && (
        <motion.button
          className={styles.expandMapBtn}
          onClick={() => setMapExpanded(v => !v)}
          aria-label={mapExpanded ? 'Show catch list' : 'Expand map'}
          aria-pressed={mapExpanded}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.975 }}
          transition={SPRING}
        >
          {mapExpanded ? (
            <MapCollapse width={16} height={16} />
          ) : (
            <MapExpand width={16} height={16} />
          )}
        </motion.button>
      )}
      {isMobile && (
        <>
          {mobileView === 'list' ? (
            <div className={styles.feedScroll}>
              <div className={styles.feedLogo} aria-hidden="true">HookSpot</div>
              <CatchGrid />
            </div>
          ) : (
            <div className={`${styles.feedLogo} ${styles.feedLogoOverlay}`} aria-hidden="true">HookSpot</div>
          )}
          <div className={styles.viewToggle} role="tablist" aria-label="Feed view">
              {VIEWS.map(({ id, label, Icon }) => {
                const isViewActive = mobileView === id
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={isViewActive}
                    aria-label={label}
                    className={`${styles.viewToggleBtn} ${isViewActive ? styles.viewToggleActive : ''}`}
                    onClick={() => setMobileView(id)}
                  >
                    {isViewActive && (
                      <motion.div
                        className={styles.viewToggleThumb}
                        layoutId="feed-view-thumb"
                        transition={SPRING_SNAPPY}
                      />
                    )}
                    <Icon width={17} height={17} className={styles.viewToggleIcon} />
                  </button>
                )
              })}
          </div>
        </>
      )}
    </div>
  )
}
