import { motion } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import styles from './Nav.module.css'

const NAV_ITEMS = [
  { path: '/', label: 'Catches' },
  { path: '/profile', label: 'Profile' },
]

export function Nav() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const path = location.pathname

  return (
    <nav className={styles.navBar}>
      <div className={styles.pill}>
        {NAV_ITEMS.map(({ path: itemPath, label }) => {
          const isActive = path === itemPath || (itemPath === '/profile' && path.startsWith('/user/'))

          return (
            <button
              key={itemPath}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={() => navigate(itemPath)}
              aria-label={label}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-highlight"
                  className={styles.highlight}
                  initial={false}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
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
