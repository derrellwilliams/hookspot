import { motion } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Search, Map, User } from '../icons.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { SPRING, SPRING_TIGHT } from '../../lib/motion.js'
import styles from './Nav.module.css'

export const NAV_ITEMS = [
  { path: '/', label: 'Catches', Icon: Map },
  { path: '/profile', label: 'Profile', Icon: User },
  { path: '/search', label: 'Search', Icon: Search },
]

export function Nav() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const user = useAuthStore(s => s.user)
  const path = location.pathname

  return (
    <nav className={styles.navBar}>
      <motion.button
        className={styles.logo}
        onClick={() => navigate('/')}
        aria-label="HookSpot — home"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={SPRING}
      >
        HookSpot
      </motion.button>
      <div className={styles.navGroup}>
        {NAV_ITEMS.map(({ path: itemPath, label, Icon }) => {
          const isActive = path === itemPath || (itemPath === '/profile' && path.startsWith('/user/'))
          return (
            <motion.button
              key={label}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={() => navigate(itemPath)}
              aria-label={label}
              whileHover={{ scale: 1.007 }}
              whileTap={{ scale: 0.975 }}
              transition={SPRING}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-highlight"
                  className={styles.highlight}
                  initial={false}
                  transition={SPRING_TIGHT}
                />
              )}
              <span className={styles.label}><Icon width={20} height={20} /></span>
            </motion.button>
          )
        })}
        <motion.button
          className={styles.addBtn}
          onClick={() => user ? setUploadOpen(true) : navigate('/login')}
          aria-label="Add catch"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={SPRING}
        >
          <Plus width={22} height={22} />
        </motion.button>
      </div>
    </nav>
  )
}
