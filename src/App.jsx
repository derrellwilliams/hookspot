import { useEffect } from 'react'
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
import { supabase } from './lib/supabase.js'
import { useAuthStore } from './store/useAuthStore.js'
import { usePhotoStore } from './store/usePhotoStore.js'
import { initPhotos } from './lib/fileLoader.js'
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
  const setUsername = useAuthStore(s => s.setUsername)

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
          const { username, error: profileError } = await res.json()
          if (profileError) {
            console.error('[auth] profile check failed', profileError)
          } else if (!username) {
            navigate('/onboarding', { replace: true })
          } else {
            setUsername(username)
            initPhotos()
          }
        } catch (err) {
          console.error('[auth] profile fetch failed', err)
        }
      } else {
        setUser(session?.user ?? null)
        if (event === 'SIGNED_OUT') {
          usePhotoStore.getState().clearPhotos()
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [setUser, setSession, setUsername])

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
    <IconoirProvider iconProps={{ strokeWidth: 2 }}>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </IconoirProvider>
  )
}
