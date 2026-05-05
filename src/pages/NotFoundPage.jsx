import { useRef, useEffect } from 'react'
import { animateMesh, DEFAULT_BLOBS } from '../lib/mesh.js'
import styles from './LoginPage.module.css'

export function NotFoundPage() {
  const meshRef = useRef(null)

  useEffect(() => {
    if (!meshRef.current) return
    return animateMesh(meshRef.current, DEFAULT_BLOBS)
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.bgMesh}>
        <div className={styles.meshNoise} ref={meshRef} />
        <div className={styles.meshOverlay} aria-hidden="true" />
      </div>
      <div className={styles.center}>
        <div className={styles.wordmark}>404</div>
        <div className={styles.sent}>This page doesn't seem to exist, sorry :(</div>
      </div>
    </div>
  )
}
