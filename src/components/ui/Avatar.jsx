import styles from './ui.module.css'

export function Avatar({ user, size = 36, className = '' }) {
  const initial = (user?.display_name || user?.username || '?')[0].toUpperCase()
  const style = { '--avatar-size': `${size}px` }
  return user?.avatar_url
    ? <img src={user.avatar_url} alt={user.display_name || user.username} className={`${styles.avatar} ${className}`} style={style} />
    : <div className={`${styles.avatarFallback} ${className}`} style={style}>{initial}</div>
}
