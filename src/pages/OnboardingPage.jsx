import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditPencil, User } from 'iconoir-react'
import { Button } from '../components/ui/index.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { uploadAvatar } from '../lib/avatarUpload.js'
import { initPhotos } from '../lib/fileLoader.js'
import { DitherMesh } from '../components/DitherMesh.jsx'
import { USERNAME_RE } from '../lib/validation.js'
import styles from './OnboardingPage.module.css'

export function OnboardingPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const setStoreUsername = useAuthStore(s => s.setUsername)
  const session = useAuthStore(s => s.session)

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.display_name || user?.user_metadata?.full_name || ''
  )
  const [bio, setBio] = useState(user?.user_metadata?.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [usernameError, setUsernameError] = useState('')
  const [usernameOk, setUsernameOk] = useState(false)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fileInputRef = useRef(null)
  const checkCountRef = useRef(0)
  const lastCheckedRef = useRef({ val: null, result: false })

  async function checkUsername(val) {
    if (!USERNAME_RE.test(val)) {
      setUsernameError('3–20 chars: lowercase letters, numbers, - or _')
      setUsernameOk(false)
      return false
    }
    if (lastCheckedRef.current.val === val) return lastCheckedRef.current.result
    setChecking(true)
    const thisCheck = ++checkCountRef.current
    let available = false
    try {
      const res = await fetch(`/api/check-username?username=${encodeURIComponent(val)}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      available = json.available
    } catch (err) {
      console.error('[checkUsername] failed', err)
      if (thisCheck !== checkCountRef.current) return false
      setChecking(false)
      setUsernameError('Could not check username. Try again.')
      return false
    }
    if (thisCheck !== checkCountRef.current) return false
    setChecking(false)
    if (!available) {
      lastCheckedRef.current = { val, result: false }
      setUsernameError('That username is taken')
      setUsernameOk(false)
      return false
    } else {
      lastCheckedRef.current = { val, result: true }
      setUsernameError('')
      setUsernameOk(true)
      return true
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarUrl(URL.createObjectURL(file))
    e.target.value = ''
  }

  async function handleSave(e) {
    e.preventDefault()
    if (saving || !session) return
    // Re-validate at submit time to guard against stale usernameOk state
    const valid = await checkUsername(username)
    if (!valid) return
    setSaving(true)
    setSaveError('')
    try {
      const storedAvatarUrl = avatarFile
        ? await uploadAvatar(user.id, avatarFile)
        : (avatarUrl || null)
      const res = await fetch('/api/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: session.access_token,
          username,
          displayName: displayName.trim() || null,
          bio: bio.trim() || null,
          avatarUrl: storedAvatarUrl,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      // Merge updated metadata into the existing user object to preserve the correct shape
      if (user) setUser({ ...user, user_metadata: { ...user.user_metadata, ...json.user.user_metadata } })
      setStoreUsername(username)
      initPhotos()
      navigate('/', { replace: true })
    } catch (err) {
      console.error('[onboarding] save failed', err)
      setSaveError(err.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.bgMesh}>
        <DitherMesh className={styles.meshNoise} />
        <div className={styles.meshOverlay} aria-hidden="true" />
      </div>
      <div className={styles.wordmark}>HookSpot</div>
      <form className={styles.card} onSubmit={handleSave}>
        <h1 className={styles.title}>Let's setup your profile.</h1>
        <div className={styles.avatarField}>
          <label className={styles.label}>Profile photo <span className={styles.required}>*</span></label>
          <div className={styles.avatarRow}>
            <div className={styles.avatarWrap}>
              <button type="button" className={styles.avatarBtn} onClick={() => fileInputRef.current?.click()}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" className={styles.avatarImg} />
                  : <User width={36} height={36} className={styles.avatarPlaceholder} />
                }
              </button>
              {avatarUrl && (
                <Button type="button" variant="icon-sm" className={styles.avatarEditBadge} onClick={() => fileInputRef.current?.click()} aria-label="Change profile photo">
                  <EditPencil width={12} height={12} />
                </Button>
              )}
            </div>
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Upload photo
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Username <span className={styles.required}>*</span>
          </label>
          <input
            className={`${styles.input} ${usernameError ? styles.inputError : usernameOk ? styles.inputOk : ''}`}
            value={username}
            onChange={e => {
              const v = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
              setUsername(v)
              setUsernameOk(false)
              setUsernameError('')
              lastCheckedRef.current = { val: null, result: false }
            }}
            onBlur={() => username && checkUsername(username)}
            placeholder="your-handle"
            maxLength={20}
            autoFocus
          />
          {usernameError && <div className={styles.fieldError}>{usernameError}</div>}
          {checking && <div className={styles.fieldHint}>Checking availability…</div>}
          {!usernameError && !checking && usernameOk && (
            <div className={styles.fieldOk}>@{username} is available</div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Full name</label>
          <input
            className={styles.input}
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={60}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Bio</label>
          <textarea
            className={styles.textarea}
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell us about yourself"
            maxLength={200}
            rows={3}
          />
        </div>

        {saveError && <div className={styles.saveError}>{saveError}</div>}

        <Button className={styles.saveBtn} disabled={saving || !usernameOk || !avatarUrl} type="submit">
          {saving ? 'Saving…' : 'Get started'}
        </Button>
      </form>
    </div>
  )
}
