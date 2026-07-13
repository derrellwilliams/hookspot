import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Plus, Search, User } from '../icons.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { useReducedMotion } from '../../hooks/useIsMobile.js'
import { SPRING_SNAPPY } from '../../lib/motion.js'
import styles from './MobileNav.module.css'

const TABS = [
  { path: '/', label: 'Catches', Icon: Home },
  { path: '/profile', label: 'Profile', Icon: User },
  { path: '/search', label: 'Search', Icon: Search },
]

const iconVariants = {
  active:   { scale: [1, 1.2, 0.88, 1.06, 1] },
  inactive: { scale: 1 },
}
const iconTransition = { duration: 0.38, times: [0, 0.2, 0.5, 0.7, 1] }
const REDUCED_ICON_TRANSITION = { duration: 0.15 }

// Instagram-metric geometry: full-size ↔ compact, driven by scroll direction.
// SHRINK_RATIO is the compact/full bar-height ratio (46px / 58px) — applied
// as a uniform transform scale on .wrap instead of animating padding/height/width
// (layout properties). Full-size dimensions now live as static CSS in
// MobileNav.module.css (.pill height, .wrap padding, .addBtn size).
const SHRINK_RATIO = 46 / 58
const SHRINK_SPRING = { stiffness: 320, damping: 34 }
const SCROLL_SLOP = 12
const TOP_ZONE = 24

export function MobileNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const user = useAuthStore(s => s.user)
  const path = location.pathname
  const reducedMotion = useReducedMotion()

  // 0 = full size, 1 = compact
  const t = useSpring(0, SHRINK_SPRING)
  const navScale = useTransform(t, [0, 1], [1, SHRINK_RATIO])

  // Instagram behavior: shrink on scroll down, expand on scroll up or near top.
  // Capture-phase listener sees scrolls from any nested scroller (feed, profile,
  // search results); per-target last positions keep deltas independent.
  useEffect(() => {
    if (reducedMotion) return
    const lastTops = new WeakMap()
    function onScroll(e) {
      const el = e.target === document ? document.scrollingElement : e.target
      if (!el || typeof el.scrollTop !== 'number') return
      const top = el.scrollTop
      const last = lastTops.get(el) ?? top
      lastTops.set(el, top)
      const delta = top - last
      if (top <= TOP_ZONE) t.set(0)
      else if (delta > SCROLL_SLOP) t.set(1)
      else if (delta < -SCROLL_SLOP) t.set(0)
    }
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [t, reducedMotion])

  // Fresh page starts at full size
  useEffect(() => {
    t.set(0)
  }, [path, t])

  return (
    <motion.div className={styles.wrap} style={{ scale: reducedMotion ? 1 : navScale }}>
      <motion.nav className={styles.pill} aria-label="Main">
        {TABS.map(({ path: itemPath, label, Icon }) => {
          const isActive = path === itemPath || (itemPath === '/profile' && path.startsWith('/user/'))
          return (
            <motion.button
              key={itemPath}
              className={`${styles.tab} ${isActive ? styles.active : ''}`}
              onClick={() => navigate(itemPath)}
              aria-label={label}
              whileTap={{ scale: 0.9 }}
            >
              {isActive && (
                <motion.div
                  className={styles.stadium}
                  layoutId="mobile-nav-stadium"
                  transition={SPRING_SNAPPY}
                />
              )}
              <motion.div className={styles.iconWrap}>
                <motion.div
                  variants={iconVariants}
                  animate={isActive ? 'active' : 'inactive'}
                  transition={reducedMotion ? REDUCED_ICON_TRANSITION : iconTransition}
                >
                  <Icon width={24} height={24} strokeWidth={isActive ? 2.5 : 2} />
                </motion.div>
              </motion.div>
            </motion.button>
          )
        })}
      </motion.nav>
      <motion.button
        className={styles.addBtn}
        onClick={() => user ? setUploadOpen(true) : navigate('/login')}
        aria-label="Add catch"
        whileTap={{ scale: 0.92 }}
      >
        <motion.div className={styles.iconWrap}>
          <Plus width={26} height={26} strokeWidth={2.5} />
        </motion.div>
      </motion.button>
    </motion.div>
  )
}
