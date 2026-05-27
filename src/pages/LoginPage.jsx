import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { animateMesh, DEFAULT_BLOBS } from '../lib/mesh.js'
import { Button } from '../components/ui/Button.jsx'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)
  const username = useAuthStore(s => s.username)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(null)
  const meshRef = useRef(null)

  useEffect(() => {
    if (!meshRef.current) return
    return animateMesh(meshRef.current, DEFAULT_BLOBS)
  }, [])

  useEffect(() => {
    if (!loading && user && username) navigate('/', { replace: true })
  }, [loading, user, username, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setSending(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  async function handleVerify(e) {
    e.preventDefault()
    setVerifying(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    setVerifying(false)
    if (error) setError(error.message)
    // on success, auth state change in App.jsx will navigate away
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
          {!sent ? (
            <form onSubmit={handleSubmit} className={styles.form}>
              <input
                className={styles.input}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Button className={styles.button} disabled={sending}>
                {sending ? 'Sending…' : 'Continue'}
              </Button>
              {error && <p className={styles.error}>{error}</p>}
            </form>
          ) : (
            <form onSubmit={handleVerify} className={styles.form}>
              <div className={styles.sent}>Check your email for a 6-digit code.</div>
              <input
                className={styles.input}
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
              />
              <Button className={styles.button} disabled={verifying || code.length < 6}>
                {verifying ? 'Verifying…' : 'Sign in'}
              </Button>
              {error && <p className={styles.error}>{error}</p>}
              <button type="button" className={styles.resend} onClick={() => { setSent(false); setCode(''); setError(null) }}>
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
