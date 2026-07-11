import React from 'react'
import { motion } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Map, User, Plus } from '../icons.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import styles from './Dock.module.css'

const spring = { type: 'spring', stiffness: 500, damping: 30 }
const pillSpring = { type: 'spring', stiffness: 500, damping: 38 }

const iconVariants = {
  active:   { scale: [1, 1.2, 0.88, 1.06, 1] },
  inactive: { scale: 1 },
}
const iconTransition = { duration: 0.38, times: [0, 0.2, 0.5, 0.7, 1] }

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
              whileTap={{ scale: 0.9 }}
              transition={spring}
            >
              {isActive && (
                <motion.div
                  className={styles.activePill}
                  layoutId="tab-active-pill"
                  transition={pillSpring}
                />
              )}
              <motion.div
                className={styles.tabIconWrap}
                variants={iconVariants}
                animate={isActive ? 'active' : 'inactive'}
                transition={iconTransition}
              >
                <Icon width={22} height={22} strokeWidth={isActive ? 2.5 : 1.5} />
              </motion.div>
              <span className={styles.tabLabel}>{label}</span>
            </motion.button>
            {index === 0 && (
              <motion.button
                className={styles.tabPlus}
                onClick={() => user ? setUploadOpen(true) : navigate('/login')}
                aria-label="Add catch"
                whileTap={{ scale: 0.95 }}
                transition={spring}
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
