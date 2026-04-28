import { useNavigate, useLocation } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { NavArrowDown, ArrowLeft, Plus, User } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { Button, Tooltip } from '../ui/index.js'
import styles from './Nav.module.css'

export function Nav() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)

  const path = location.pathname

  return (
    <div className={styles.navBar}>
      <div className={styles.navCenter}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <div className={styles.navPill}>
              <button className={styles.navBtn}>
                Hook Spot
                <NavArrowDown className={styles.chevron} width={24} height={24} />
              </button>
            </div>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.dropMenu} sideOffset={8} align="start">
              <DropdownMenu.Item
                className={`${styles.dropItem} ${path === '/' ? styles.active : ''}`}
                onSelect={() => navigate('/')}
              >
                Map
                {path === '/' && <ArrowLeft className={styles.activeArrow} width={14} height={14} />}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={`${styles.dropItem} ${path === '/stats' ? styles.active : ''}`}
                onSelect={() => navigate('/stats')}
              >
                Stats
                {path === '/stats' && <ArrowLeft className={styles.activeArrow} width={14} height={14} />}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={`${styles.dropItem} ${path === '/feed' ? styles.active : ''}`}
                onSelect={() => navigate('/feed')}
              >
                Feed
                {path === '/feed' && <ArrowLeft className={styles.activeArrow} width={14} height={14} />}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      <div className={styles.navRight}>
        <Tooltip label="Add catch" side="bottom">
          <Button variant="icon" className={styles.addCatchBtn} onClick={() => setUploadOpen(true)} aria-label="Add catch">
            <Plus width={20} height={20} />
          </Button>
        </Tooltip>
        <Tooltip label="Profile" side="bottom">
          <Button variant="icon" onClick={() => navigate('/profile')} aria-label="Profile">
            <User width={20} height={20} />
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
