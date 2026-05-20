import { useEffect, useRef } from 'react'
import { usePhotoStore } from '../store/usePhotoStore.js'
import { renderStats } from '../stats.js'
import styles from './StatsPage.module.css'

export function StatsPage() {
  const groups = usePhotoStore(s => s.groups)

  const monthlyRef = useRef(null)
  const hourlyRef = useRef(null)
  const speciesRef = useRef(null)
  const speciesMonthlyRef = useRef(null)
  const weatherCondRef = useRef(null)
  const weatherTempRef = useRef(null)

  useEffect(() => {
    renderStats(groups, {
      monthly: monthlyRef.current,
      hourly: hourlyRef.current,
      species: speciesRef.current,
      speciesMonthly: speciesMonthlyRef.current,
      weatherCond: weatherCondRef.current,
      weatherTemp: weatherTempRef.current,
    })
  }, [groups])

  return (
    <div className={styles.page}>
      <div className={styles.scroll}>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Catches per Month</div>
            <div ref={monthlyRef} />
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Time of Day</div>
            <div ref={hourlyRef} />
          </div>
          <div className={styles.row2}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Species</div>
              <div ref={speciesRef} />
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Species by Month</div>
              <div ref={speciesMonthlyRef} />
            </div>
          </div>
          <div className={styles.row2}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Catches by Condition</div>
              <div ref={weatherCondRef} />
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Catches by Temperature</div>
              <div ref={weatherTempRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
