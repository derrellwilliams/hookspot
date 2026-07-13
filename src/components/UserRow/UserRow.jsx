import { Avatar } from '../ui/index.js'
import styles from './UserRow.module.css'

export function UserRow({ user, onClick, active = false }) {
  return (
    <button className={`${styles.userRow} ${active ? styles.userRowActive : ''}`} onClick={onClick}>
      <Avatar user={user} />
      <div className={styles.userInfo}>
        <span className={styles.userDisplayName}>{user.display_name || user.username}</span>
        <span className={styles.userUsername}>@{user.username}</span>
      </div>
    </button>
  )
}
