import { SidebarContent } from '../components/Sidebar/Sidebar.jsx'
import { CatchGrid } from '../components/CatchGrid/CatchGrid.jsx'
import { CatchDialog } from '../components/CatchDialog/CatchDialog.jsx'
import { DockSheet } from '../components/Dock/DockSheet.jsx'
import { MapView } from '../components/Map/MapView.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import styles from './MapPage.module.css'

export function MapPage({ active }) {
  const isMobile = useIsMobile()

  return (
    <div id="sidebar-anchor" className={styles.page}>
      {isMobile
        ? active && <DockSheet><SidebarContent /></DockSheet>
        : (
          <>
            <div className={styles.cardsPane}>
              <CatchGrid />
            </div>
            {/* Dialog portals to <body>, so gate on `active` — MapPage stays
                mounted (display:none) while other routes are shown */}
            {active && <CatchDialog />}
          </>
        )}
      <div className={styles.mapPane}>
        <MapView active={active} />
      </div>
    </div>
  )
}
