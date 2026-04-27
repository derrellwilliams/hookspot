import styles from './ui.module.css'

export function Button({ variant = 'primary', icon, children, className = '', ...props }) {
  return (
    <button
      className={`${styles.btn} ${styles[`btn-${variant}`]} ${icon ? styles.btnWithIcon : ''} ${className}`}
      {...props}
    >
      {icon && <span className={styles.btnIcon}>{icon}</span>}
      {children}
    </button>
  )
}
