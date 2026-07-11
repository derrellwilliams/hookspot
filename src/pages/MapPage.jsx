import { useNavigate } from 'react-router-dom'
import { SidebarContent } from '../components/Sidebar/Sidebar.jsx'
import { CatchGrid } from '../components/CatchGrid/CatchGrid.jsx'
import { CatchDialog } from '../components/CatchDialog/CatchDialog.jsx'
import { DockSheet } from '../components/Dock/DockSheet.jsx'
import { MapView } from '../components/Map/MapView.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { Plus } from '../components/icons.js'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { useAuthStore } from '../store/useAuthStore.js'
import styles from './MapPage.module.css'

export function MapPage({ active }) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const user = useAuthStore(s => s.user)

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
      {isMobile && (
        <>
          <div className={styles.mobileLogo} aria-hidden="true">HookSpot</div>
          <button
            className={styles.mobileAdd}
            onClick={() => user ? setUploadOpen(true) : navigate('/login')}
            aria-label="Add catch"
          >
            <Plus width={22} height={22} strokeWidth={2.5} />
          </button>
        </>
      )}
    </div>
  )
}
