import { motion } from 'motion/react'
import styles from './ui.module.css'

const spring = { type: 'spring', stiffness: 400, damping: 17 }

export function Button({ variant = 'primary', icon, children, className = '', ...props }) {
  const disabled = props.disabled
  return (
    <motion.button
      className={`${styles.btn} ${styles[`btn-${variant}`]} ${icon ? styles.btnWithIcon : ''} ${className}`}
      whileHover={disabled ? undefined : { scale: 1.015 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={spring}
      {...props}
    >
      {icon && <span className={styles.btnIcon}>{icon}</span>}
      {children}
    </motion.button>
  )
}
