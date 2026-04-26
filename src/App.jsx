import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Nav } from './components/Nav/Nav.jsx'
import { Toast } from './components/Toast/Toast.jsx'
import { DropOverlay } from './components/DropOverlay/DropOverlay.jsx'
import { UploadDialog } from './components/UploadDialog/UploadDialog.jsx'
import { MapPage } from './pages/MapPage.jsx'
import { StatsPage } from './pages/StatsPage.jsx'
import { DesignPage } from './pages/DesignPage.jsx'
import styles from './App.module.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className={styles.app}>
        <Nav />
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/design" element={<DesignPage />} />
        </Routes>
        <DropOverlay />
        <UploadDialog />
        <Toast />
      </div>
    </BrowserRouter>
  )
}
