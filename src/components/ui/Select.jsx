import styles from './ui.module.css'

export function Select({ className = '', children, ...props }) {
  return (
    <div className={styles.selectWrap}>
      <select className={`${styles.select} ${className}`} {...props}>
        {children}
      </select>
    </div>
  )
}
