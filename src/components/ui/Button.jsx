import styles from './ui.module.css'

export function Button({ variant = 'primary', children, className = '', ...props }) {
  return (
    <button
      className={`${styles.btn} ${styles[`btn-${variant}`]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
