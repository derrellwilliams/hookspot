import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { initPhotos } from './lib/fileLoader.js'
import './style.css'

createRoot(document.getElementById('root')).render(<App />)

// Kick off initial photo load after React has mounted
initPhotos()
