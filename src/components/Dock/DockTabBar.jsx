import { motion } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Map, Search, User } from '../icons.js'
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
  { path: '/search', label: 'Search', Icon: Search },
]

export function DockTabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname

  return (
    <div className={styles.tabRow}>
      {TABS.map(({ path: itemPath, label, Icon }) => {
        const isActive = path === itemPath || (itemPath === '/profile' && path.startsWith('/user/'))
        return (
          <motion.button
            key={itemPath}
            className={`${styles.tabItem} ${isActive ? styles.active : ''}`}
            onClick={() => navigate(itemPath)}
            aria-label={label}
            whileTap={{ scale: 0.9 }}
            transition={spring}
          >
            <div className={styles.tabBubble}>
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
                <Icon width={24} height={24} strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
