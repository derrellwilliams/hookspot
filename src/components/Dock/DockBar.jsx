import { DockTabBar } from './DockTabBar.jsx'
import styles from './Dock.module.css'

export function DockBar() {
  return (
    <div className={styles.dockBar}>
      <DockTabBar />
    </div>
  )
}
