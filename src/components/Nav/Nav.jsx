import { motion } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import styles from './Nav.module.css'

const spring = { type: 'spring', stiffness: 300, damping: 24 }
const springTight = { type: 'spring', stiffness: 400, damping: 35 }

export const NAV_ITEMS = [
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
              whileHover={{ scale: 1.007 }}
              whileTap={{ scale: 0.975 }}
              transition={spring}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-highlight"
                  className={styles.highlight}
                  initial={false}
                  transition={springTight}
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
          whileHover={{ scale: 1.007 }}
          whileTap={{ scale: 0.975 }}
          transition={spring}
        >
          <Plus width={24} height={24} />
        </motion.button>
      </div>
    </nav>
  )
}
