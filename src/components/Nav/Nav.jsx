import { useNavigate, useLocation } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { NavArrowDown, Plus } from 'iconoir-react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import styles from './Nav.module.css'

export function Nav() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)

  const isStats = location.pathname === '/stats'

  return (
    <div className={styles.navBar}>
      <div className={styles.navPill}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className={styles.navBtn}>
              Hook Spot
              <NavArrowDown className={styles.chevron} width={24} height={24} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.dropMenu} sideOffset={8} align="start">
              <DropdownMenu.Item
                className={`${styles.dropItem} ${!isStats ? styles.active : ''}`}
                onSelect={() => navigate('/')}
              >
                Map
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={`${styles.dropItem} ${isStats ? styles.active : ''}`}
                onSelect={() => navigate('/stats')}
              >
                Stats
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      <button className={styles.fabAdd} onClick={() => setUploadOpen(true)} aria-label="Add catch"><Plus width={24} height={24} /></button>
    </div>
  )
}
