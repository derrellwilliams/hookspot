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
      <div className={styles.blurContainer}>
        <div className={styles.shape} style={{ '--background': 'linear-gradient(135deg, #2563eb, #1A1953)', '--width': '55%', '--top': '-10%', '--left': '40%', '--speed': '12000ms', '--opacity': '0.7', '--offset': '20deg', '--path': 'polygon(50% 0%, 85% 15%, 100% 50%, 80% 85%, 50% 100%, 15% 85%, 0% 50%, 20% 15%)' }} />
        <div className={styles.shape} style={{ '--background': 'linear-gradient(45deg, #1A1953, #2563eb)', '--width': '50%', '--top': '50%', '--left': '-5%', '--speed': '16000ms', '--opacity': '0.6', '--offset': '-40deg', '--path': 'polygon(40% 0%, 80% 10%, 100% 45%, 85% 80%, 50% 100%, 10% 90%, 0% 50%, 15% 15%)' }} />
        <div className={styles.shape} style={{ '--background': 'linear-gradient(90deg, #2c2c2e, #3a3a3c)', '--width': '44%', '--top': '25%', '--left': '58%', '--speed': '10000ms', '--opacity': '0.9', '--offset': '60deg', '--path': 'polygon(60% 5%, 90% 30%, 95% 65%, 65% 90%, 30% 95%, 5% 70%, 0% 35%, 30% 5%)' }} />
        <div className={styles.shape} style={{ '--background': 'linear-gradient(180deg, #2563eb, #3a3a3c)', '--width': '46%', '--top': '10%', '--left': '8%', '--speed': '14000ms', '--opacity': '0.55', '--offset': '-20deg', '--path': 'polygon(55% 0%, 90% 20%, 100% 60%, 75% 95%, 40% 100%, 5% 80%, 0% 40%, 25% 5%)' }} />
        <div className={styles.shape} style={{ '--background': 'linear-gradient(225deg, #2c2c2e, #1A1953)', '--width': '40%', '--top': '62%', '--left': '52%', '--speed': '9000ms', '--opacity': '0.65', '--offset': '80deg', '--path': 'polygon(50% 5%, 80% 20%, 95% 55%, 75% 88%, 45% 98%, 12% 82%, 2% 48%, 22% 18%)' }} />
      </div>
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
