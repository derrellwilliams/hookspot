import { useState } from 'react'
import { motion } from 'motion/react'
import { CatchGrid } from '../components/CatchGrid/CatchGrid.jsx'
import { CatchDialog } from '../components/CatchDialog/CatchDialog.jsx'
import { MapView } from '../components/Map/MapView.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { ListView, MapPin } from '../components/icons.js'
import { SPRING_SNAPPY } from '../lib/motion.js'
import styles from './MapPage.module.css'

const VIEWS = [
  { id: 'list', label: 'List view', Icon: ListView },
  { id: 'map', label: 'Map view', Icon: MapPin },
]

export function MapPage({ active }) {
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = useState('list')

  return (
    <div id="sidebar-anchor" className={styles.page}>
      {!isMobile && (
        <div className={styles.cardsPane}>
          <CatchGrid />
        </div>
      )}
      {/* Dialog portals to <body>, so gate on `active` — MapPage stays
          mounted (display:none) while other routes are shown */}
      {active && <CatchDialog />}
      <div className={`${styles.mapPane} ${isMobile && mobileView === 'list' ? styles.mapPaneHidden : ''}`}>
        <MapView active={active && (!isMobile || mobileView === 'map')} />
      </div>
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
