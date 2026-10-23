import { createRoot } from 'react-dom/client'
// Static so it stays ahead of style.css (which overrides Mapbox's defaults) even
// though the mapbox-gl JS itself is lazy-loaded via loadMapbox().
import 'mapbox-gl/dist/mapbox-gl.css'
import App from './App.jsx'
import './style.css'

// A deploy replaces the hashed lazy chunks (mapbox-gl, heic2any), so a tab opened
// before it can 404 on first use — reload once to pick up the new build.
window.addEventListener('vite:preloadError', () => {
  try {
    const last = Number(sessionStorage.getItem('chunkReloadAt'))
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem('chunkReloadAt', String(Date.now()))
  } catch { /* storage blocked — still worth one reload */ }
  window.location.reload()
})

createRoot(document.getElementById('root')).render(<App />)
