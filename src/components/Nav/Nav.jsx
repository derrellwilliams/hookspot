import { useEffect, useRef, useState } from 'react'
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

const LOGO_TEXT = 'HookSpot'
// Matches logoWaveOut's duration + the last letter's stagger delay in Nav.module.css.
const LOGO_WAVE_OUT_MS = 420 + (LOGO_TEXT.length - 1) * 26

export function Nav() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const user = useAuthStore(s => s.user)
  const path = location.pathname
  const [logoPhase, setLogoPhase] = useState('idle') // 'idle' | 'in' | 'out'
  const logoOutTimer = useRef(null)

  useEffect(() => () => clearTimeout(logoOutTimer.current), [])

  return (
    <nav className={styles.navBar}>
      <motion.button
        className={styles.logo}
        onClick={() => navigate('/')}
        onHoverStart={() => {
          clearTimeout(logoOutTimer.current)
          setLogoPhase('in')
        }}
        onHoverEnd={() => {
          setLogoPhase('out')
          logoOutTimer.current = setTimeout(() => setLogoPhase('idle'), LOGO_WAVE_OUT_MS)
        }}
        aria-label="HookSpot — home"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={SPRING}
      >
        <span
          className={`${styles.logoText} ${logoPhase === 'in' ? styles.waveIn : ''} ${logoPhase === 'out' ? styles.waveOut : ''}`}
          aria-hidden="true"
        >
          {LOGO_TEXT.split('').map((ch, i) => (
            <span key={i} className={styles.logoLetter} style={{ '--i': i, '--ri': LOGO_TEXT.length - 1 - i }}>{ch}</span>
          ))}
        </span>
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
              whileHover={{ scale: 1.02 }}
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
