import { motion } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { NAV_ITEMS } from '../Nav/Nav.jsx'
import styles from './Dock.module.css'

const springTight = { type: 'spring', stiffness: 400, damping: 35 }

export function DockTabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const path = location.pathname

  return (
    <div className={styles.tabRow}>
      {NAV_ITEMS.map(({ path: itemPath, label }) => {
        const isActive = path === itemPath || (itemPath === '/profile' && path.startsWith('/user/'))

        return (
          <motion.button
            key={itemPath}
            className={`${styles.tabItem} ${isActive ? styles.active : ''}`}
            onClick={() => navigate(itemPath)}
            aria-label={label}
            whileTap={{ scale: 0.975 }}
            transition={springTight}
          >
            {isActive && (
              <motion.div
                layoutId="dock-nav-highlight"
                className={styles.tabHighlight}
                initial={false}
                transition={springTight}
              />
            )}
            <span className={styles.tabLabel}>{label}</span>
          </motion.button>
        )
      })}
      <motion.button
        className={styles.tabPlus}
        onClick={() => setUploadOpen(true)}
        aria-label="Add catch"
        whileTap={{ scale: 0.95 }}
        transition={springTight}
      >
        <Plus width={24} height={24} />
      </motion.button>
    </div>
  )
}
