import { Sidebar, SidebarContent } from '../components/Sidebar/Sidebar.jsx'
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
        : <Sidebar />}
      <MapView active={active} />
    </div>
  )
}
