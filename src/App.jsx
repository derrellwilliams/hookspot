import { useEffect } from 'react'
import { MotionConfig } from 'motion/react'
import { IconoirProvider } from 'iconoir-react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Nav } from './components/Nav/Nav.jsx'
import { Toast } from './components/Toast/Toast.jsx'
import { DropOverlay } from './components/DropOverlay/DropOverlay.jsx'
import { UploadDialog } from './components/UploadDialog/UploadDialog.jsx'
import { MapPage } from './pages/MapPage.jsx'
import { DesignPage } from './pages/DesignPage.jsx'
import { NotFoundPage } from './pages/NotFoundPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { OnboardingPage } from './pages/OnboardingPage.jsx'
import { UserProfilePage } from './pages/UserProfilePage.jsx'
import { RequireAuth } from './components/RequireAuth.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { supabase } from './lib/supabase.js'
import { useAuthStore } from './store/useAuthStore.js'
import { usePhotoStore } from './store/usePhotoStore.js'
import { initPhotos, clearUploadingNames } from './lib/fileLoader.js'
import styles from './App.module.css'

function ProfileRedirect() {
  const username = useAuthStore(s => s.username)
  if (!username) return null
  return <Navigate to={`/user/${username}`} replace />
}

function AppInner() {
  const location = useLocation()
  const navigate = useNavigate()
  const setUser = useAuthStore(s => s.setUser)
  const setSession = useAuthStore(s => s.setSession)
  const setUserAndUsername = useAuthStore(s => s.setUserAndUsername)

  const knownRoutes = ['/', '/login', '/onboarding', '/profile', '/design']
  const isKnownRoute = knownRoutes.includes(location.pathname) || location.pathname.startsWith('/user/')
  const isPublicPage = ['/login', '/onboarding'].includes(location.pathname) || !isKnownRoute

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        setUser(session.user)
        setSession(session)

        try {
          const res = await fetch(`/api/profile?userId=${session.user.id}`)
          if (!res.ok) throw new Error(`Profile fetch error: ${res.status}`)
          const { username, avatar_url, error: profileError } = await res.json()
          if (profileError) {
            console.error('[auth] profile check failed', profileError)
            initPhotos()
          } else if (!username) {
            navigate('/onboarding', { replace: true })
          } else {
            // Atomically set user (with synced avatar) + username to prevent
            // an intermediate render where username is set but avatar is still stale.
            const syncedUser = avatar_url
              ? { ...session.user, user_metadata: { ...session.user.user_metadata, avatar_url } }
              : session.user
            setUserAndUsername(syncedUser, username)
            initPhotos()
            // If an old code path wrote a base64 data URL into user_metadata, the JWT
            // grows to ~18KB and Supabase Storage's nginx proxy rejects uploads (400).
            // Clear it so future JWTs stay small; local state still shows the avatar.
            if (session.user.user_metadata?.avatar_url?.startsWith('data:')) {
              supabase.auth.updateUser({ data: { avatar_url: null } }).catch(() => {})
            }
          }
        } catch (err) {
          console.error('[auth] profile fetch failed', err)
          initPhotos()
        }
      } else {
        setUser(session?.user ?? null)
        if (event === 'SIGNED_OUT') {
          clearUploadingNames()
          usePhotoStore.getState().clearPhotos()
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [setUser, setSession, setUserAndUsername])

  const isMap = location.pathname === '/'

  return (
    <div className={styles.app}>
      {!isPublicPage && <Nav />}
      <RequireAuth>
        <div style={{ display: isMap ? 'contents' : 'none' }}>
          <MapPage active={isMap} />
        </div>
      </RequireAuth>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfileRedirect /></RequireAuth>} />
        <Route path="/user/:username" element={<RequireAuth><UserProfilePage /></RequireAuth>} />
        <Route path="/" element={null} />
        <Route path="/design" element={<DesignPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!isPublicPage && <DropOverlay />}
      {!isPublicPage && <UploadDialog />}
      {!isPublicPage && <Toast />}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <IconoirProvider iconProps={{ strokeWidth: 2 }}>
          <BrowserRouter>
            <AppInner />
          </BrowserRouter>
        </IconoirProvider>
      </MotionConfig>
    </ErrorBoundary>
  )
}
