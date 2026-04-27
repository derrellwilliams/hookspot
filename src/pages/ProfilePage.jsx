import { useAuthStore } from '../store/useAuthStore.js'
import { Button } from '../components/ui/index.js'
import styles from './ProfilePage.module.css'

export function ProfilePage() {
  const signOut = useAuthStore(s => s.signOut)

  return (
    <div className={styles.page}>
      <p className={styles.label}>Profile</p>
      <h1 className={styles.soon}>Coming soon</h1>
      <Button variant="secondary" onClick={signOut} className={styles.signOut}>
        Sign out
      </Button>
    </div>
  )
}
