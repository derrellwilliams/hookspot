import styles from './ui.module.css'

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`${styles.card} ${className}`} {...props}>
      {children}
    </div>
  )
}
