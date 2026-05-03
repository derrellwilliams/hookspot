import { useEffect } from 'react'
import { IconoirProvider } from 'iconoir-react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Nav } from './components/Nav/Nav.jsx'
import { Toast } from './components/Toast/Toast.jsx'
import { DropOverlay } from './components/DropOverlay/DropOverlay.jsx'
import { UploadDialog } from './components/UploadDialog/UploadDialog.jsx'
import { MapPage } from './pages/MapPage.jsx'
import { DesignPage } from './pages/DesignPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { ProfilePage } from './pages/ProfilePage.jsx'
import { RequireAuth } from './components/RequireAuth.jsx'
import { supabase } from './lib/supabase.js'
import { useAuthStore } from './store/useAuthStore.js'
import { usePhotoStore } from './store/usePhotoStore.js'
import { initPhotos } from './lib/fileLoader.js'
import styles from './App.module.css'

function AppInner() {
  const location = useLocation()
  const isLogin = location.pathname === '/login'
  const setUser = useAuthStore(s => s.setUser)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        initPhotos()
      }
      if (event === 'SIGNED_OUT') {
        usePhotoStore.getState().clearPhotos()
      }
    })
    return () => subscription.unsubscribe()
  }, [setUser])

  const isMap = location.pathname === '/'

  return (
    <div className={styles.app}>
      {!isLogin && <Nav />}
      <RequireAuth>
        <div style={{ display: isMap ? 'contents' : 'none' }}>
          <MapPage />
        </div>
      </RequireAuth>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/design" element={<DesignPage />} />
      </Routes>
      {!isLogin && <DropOverlay />}
      {!isLogin && <UploadDialog />}
      {!isLogin && <Toast />}
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
