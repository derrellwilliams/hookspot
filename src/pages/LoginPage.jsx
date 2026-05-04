import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { animateMesh, DEFAULT_BLOBS } from '../lib/mesh.js'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const meshRef = useRef(null)

  useEffect(() => {
    if (!meshRef.current) return
    return animateMesh(meshRef.current, DEFAULT_BLOBS)
  }, [])

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [loading, user, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setSending(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className={styles.page}>
      <div className={styles.bgMesh}>
        <div className={styles.meshNoise} ref={meshRef} />
        <div className={styles.meshOverlay} aria-hidden="true" />
      </div>
      <div className={styles.center}>
        <div className={styles.wordmark}>Hook Spot</div>
        <div className={styles.card}>
          {sent ? (
            <div className={styles.sent}>
              <p>Check your email for a link to sign in.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <label className={styles.label}>Email</label>
              <input
                className={styles.input}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
              <button className={styles.button} disabled={sending}>
                {sending ? 'Sending…' : 'Create account'}
              </button>
              {error && <p className={styles.error}>{error}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
