import styles from './UserRow.module.css'

export function UserRow({ user, onClick, active = false }) {
  const initial = (user.display_name || user.username || '?')[0].toUpperCase()
  return (
    <button className={`${styles.userRow} ${active ? styles.userRowActive : ''}`} onClick={onClick}>
      {user.avatar_url
        ? <img src={user.avatar_url} alt={user.display_name || user.username} className={styles.userAvatar} />
        : <div className={styles.userAvatarFallback}>{initial}</div>
      }
      <div className={styles.userInfo}>
        <span className={styles.userDisplayName}>{user.display_name || user.username}</span>
        <span className={styles.userUsername}>@{user.username}</span>
      </div>
    </button>
  )
}
