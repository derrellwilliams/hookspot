import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Plus, Search, Settings, Map, User } from '../icons.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import styles from './Nav.module.css'

const spring = { type: 'spring', stiffness: 300, damping: 24 }
const springTight = { type: 'spring', stiffness: 400, damping: 35 }

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
  const signOut = useAuthStore(s => s.signOut)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const path = location.pathname

  return (
    <nav className={styles.navBar}>
      <motion.button
        className={styles.logo}
        onClick={() => navigate('/')}
        aria-label="HookSpot — home"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={spring}
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
              <span className={styles.label}><Icon width={20} height={20} /></span>
            </motion.button>
          )
        })}
        {user ? (
          <DropdownMenu.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DropdownMenu.Trigger asChild>
              <button className={styles.iconBtn} aria-label="Settings">
                <Settings width={20} height={20} />
              </button>
            </DropdownMenu.Trigger>
            <AnimatePresence>
              {settingsOpen && (
                <DropdownMenu.Portal forceMount>
                  <DropdownMenu.Content forceMount sideOffset={6} align="end" asChild>
                    <motion.div
                      className={styles.dropdownContent}
                      initial={{ opacity: 0, scale: 0.92, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: -6 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)' }}
                    >
                      <DropdownMenu.Item className={styles.dropdownItem} onSelect={() => navigate('/profile?edit=profile')}>
                        Edit profile
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className={styles.dropdownItem} onSelect={() => navigate('/profile?edit=gear')}>
                        Edit gear
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className={styles.dropdownItem} onSelect={signOut}>
                        Log out
                      </DropdownMenu.Item>
                    </motion.div>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              )}
            </AnimatePresence>
          </DropdownMenu.Root>
        ) : (
          <button className={styles.iconBtn} aria-label="Settings" onClick={() => navigate('/login')}>
            <Settings width={20} height={20} />
          </button>
        )}
        <motion.button
          className={styles.addBtn}
          onClick={() => user ? setUploadOpen(true) : navigate('/login')}
          aria-label="Add catch"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={spring}
        >
          <Plus width={22} height={22} />
        </motion.button>
      </div>
    </nav>
  )
}
