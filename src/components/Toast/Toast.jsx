import { usePhotoStore } from '../../store/usePhotoStore.js'
import styles from './Toast.module.css'

export function Toast() {
  const toast = usePhotoStore(s => s.toast)
  return (
    <div className={`${styles.toast} ${toast ? styles.show : ''}`}>
      {toast}
    </div>
  )
}
