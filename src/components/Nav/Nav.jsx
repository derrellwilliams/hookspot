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
            <motion.button
              key={itemPath}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={() => navigate(itemPath)}
              aria-label={label}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
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
            </motion.button>
          )
        })}
        <motion.button
          className={styles.plusBtn}
          onClick={() => setUploadOpen(true)}
          aria-label="Add catch"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <Plus width={24} height={24} />
        </motion.button>
      </div>
    </nav>
  )
}
