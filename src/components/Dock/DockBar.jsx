import { DockTabBar } from './DockTabBar.jsx'
import styles from './Dock.module.css'

export function DockBar() {
  return (
    <div className={styles.dockBar}>
      <div className={styles.dockBarHandle}>
        <div className={styles.grabber} />
      </div>
      <DockTabBar />
    </div>
  )
}
