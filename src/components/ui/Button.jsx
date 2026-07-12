import { motion } from 'motion/react'
import { SPRING } from '../../lib/motion.js'
import styles from './ui.module.css'

export function Button({ variant = 'primary', icon, children, className = '', ...props }) {
  const disabled = props.disabled
  return (
    <motion.button
      className={`${styles.btn} ${styles[`btn-${variant}`]} ${icon ? styles.btnWithIcon : ''} ${className}`}
      whileHover={disabled ? undefined : { scale: 1.007 }}
      whileTap={disabled ? undefined : { scale: 0.975 }}
      transition={SPRING}
      {...props}
    >
      {icon && <span className={styles.btnIcon}>{icon}</span>}
      {children}
    </motion.button>
  )
}
