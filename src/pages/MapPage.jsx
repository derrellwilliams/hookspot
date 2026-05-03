import { Sidebar } from '../components/Sidebar/Sidebar.jsx'
import { MapView } from '../components/Map/MapView.jsx'
import styles from './MapPage.module.css'

export function MapPage({ active }) {
  return (
    <div id="sidebar-anchor" className={styles.page}>
      <Sidebar />
      <MapView active={active} />
    </div>
  )
}
