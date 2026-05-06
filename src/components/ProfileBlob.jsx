import { useEffect, useRef } from 'react'
import { animateMesh, DEFAULT_BLOBS } from '../lib/mesh.js'
import styles from './ProfileBlob.module.css'

export function ProfileBlob() {
  const blobRef = useRef(null)

  useEffect(() => {
    if (!blobRef.current) return
    return animateMesh(blobRef.current, DEFAULT_BLOBS, { speed: 0.015 })
  }, [])

  return <div ref={blobRef} className={styles.blob} />
}
