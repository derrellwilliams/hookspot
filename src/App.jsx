import { useEffect } from 'react'
import { IconoirProvider } from 'iconoir-react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Nav } from './components/Nav/Nav.jsx'
import { Toast } from './components/Toast/Toast.jsx'
import { DropOverlay } from './components/DropOverlay/DropOverlay.jsx'
import { UploadDialog } from './components/UploadDialog/UploadDialog.jsx'
import { MapPage } from './pages/MapPage.jsx'
import { DesignPage } from './pages/DesignPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { OnboardingPage } from './pages/OnboardingPage.jsx'
import { ProfilePage } from './pages/ProfilePage.jsx'
import { UserProfilePage } from './pages/UserProfilePage.jsx'
import { RequireAuth } from './components/RequireAuth.jsx'
import { supabase } from './lib/supabase.js'
import { useAuthStore } from './store/useAuthStore.js'
import { usePhotoStore } from './store/usePhotoStore.js'
import { initPhotos } from './lib/fileLoader.js'
import styles from './App.module.css'

function AppInner() {
  const location = useLocation()
  const navigate = useNavigate()
  const setUser = useAuthStore(s => s.setUser)
  const setUsername = useAuthStore(s => s.setUsername)

  const isPublicPage = ['/login', '/onboarding'].includes(location.pathname)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        // Check onboarding before setUser so RequireAuth stays in loading state,
        // preventing a flash of the map before the redirect fires.
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .maybeSingle()

        setUser(session.user)

        if (profileError) {
          console.error('[auth] profile check failed', profileError)
        } else if (!profile?.username) {
          navigate('/onboarding', { replace: true })
        } else {
          setUsername(profile.username)
          initPhotos()
        }
      } else {
        setUser(session?.user ?? null)
        if (event === 'SIGNED_OUT') {
          usePhotoStore.getState().clearPhotos()
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [setUser, setUsername])

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
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/user/:username" element={<RequireAuth><UserProfilePage /></RequireAuth>} />
        <Route path="/design" element={<DesignPage />} />
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
