import { DitherMesh } from '../components/DitherMesh.jsx'
import styles from './LoginPage.module.css'

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <div className={styles.bgMesh}>
        <DitherMesh className={styles.meshNoise} />
        <div className={styles.meshOverlay} aria-hidden="true" />
      </div>
      <div className={styles.center}>
        <div className={styles.wordmark}>404</div>
        <div className={styles.sent}>This page doesn't seem to exist, sorry :(</div>
      </div>
    </div>
  )
}
