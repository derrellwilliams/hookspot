import React from 'react'
import { motion } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Map, User, Plus } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import styles from './Dock.module.css'

const springTight = { type: 'spring', stiffness: 400, damping: 35 }

const TABS = [
  { path: '/', label: 'Catches', Icon: Map },
  { path: '/profile', label: 'Profile', Icon: User },
]

export function DockTabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const user = useAuthStore(s => s.user)
  const path = location.pathname

  return (
    <div className={styles.tabRow}>
      {TABS.map(({ path: itemPath, label, Icon }, index) => {
        const isActive = path === itemPath || (itemPath === '/profile' && path.startsWith('/user/'))
        return (
          <React.Fragment key={itemPath}>
            <motion.button
              className={`${styles.tabItem} ${isActive ? styles.active : ''}`}
              onClick={() => navigate(itemPath)}
              aria-label={label}
              whileTap={{ scale: 0.975 }}
              transition={springTight}
            >
              <Icon width={22} height={22} strokeWidth={isActive ? 2 : 1.5} />
              <span className={styles.tabLabel}>{label}</span>
            </motion.button>
            {index === 0 && (
              <motion.button
                className={styles.tabPlus}
                onClick={() => user ? setUploadOpen(true) : navigate('/login')}
                aria-label="Add catch"
                whileTap={{ scale: 0.95 }}
                transition={springTight}
              >
                <Plus width={22} height={22} strokeWidth={2.5} />
              </motion.button>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
