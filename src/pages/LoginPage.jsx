import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from '../store/useAuthStore.js'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const fishRef = useRef(null)

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [loading, user, navigate])

  useEffect(() => {
    const fish = fishRef.current
    if (!fish) return

    let x = -110
    let direction = 1
    let y = 20 + Math.random() * 60
    let rafId

    function step() {
      x += direction * 1.5
      fish.style.left = `${x}px`
      fish.style.top = `${y}%`
      fish.style.transform = `translateY(-50%) scaleX(${-direction})`

      if (direction === 1 && x > window.innerWidth + 10) {
        direction = -1
        y = 20 + Math.random() * 60
      } else if (direction === -1 && x < -110) {
        direction = 1
        y = 20 + Math.random() * 60
      }

      rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [])

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
      <img ref={fishRef} className={styles.fish} src="/fish.svg" alt="" aria-hidden="true" />
      <div className={styles.center}>
        <div className={styles.wordmark}>
          <div>Hook</div>
          <div className={styles.wordmarkSpot}>Spot</div>
        </div>
        {sent ? (
          <div className={styles.sent}>
            <p>Magic link sent!</p>
            <p className={styles.sentHint}>Check your email and click the link to sign in.</p>
          </div>
        ) : (
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
            <button className={styles.button} disabled={sending}>
              {sending ? 'Sending…' : 'Send magic link'}
            </button>
            {error && <p className={styles.error}>{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
