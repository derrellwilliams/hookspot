import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, User, Compass, List } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import styles from './Nav.module.css'

const NAV_ITEMS = [
  { path: '/', icon: Compass, label: 'Map' },
  { path: '/feed', icon: List, label: 'Feed' },
  { path: '/profile', icon: User, label: 'Profile' },
]

export function Nav() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const path = location.pathname

  return (
    <nav className={styles.navBar}>
      <div className={styles.pill}>
        {NAV_ITEMS.map(({ path: itemPath, icon: Icon, label }) => {
          const isActive = path === itemPath
          return (
            <button
              key={itemPath}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={() => navigate(itemPath)}
              aria-label={label}
            >
              <Icon width={20} height={20} />
              <span className={styles.label}>{label}</span>
            </button>
          )
        })}
        <button
          className={styles.plusBtn}
          onClick={() => setUploadOpen(true)}
          aria-label="Add catch"
        >
          <Plus width={24} height={24} />
        </button>
      </div>
    </nav>
  )
}
