import React from 'react'
import ReactDOM from 'react-dom/client'
import './api'
import App from './App'
import { initMediaUrl } from './utils/mediaUrl'
import '@fontsource/outfit/700.css'
import '@fontsource/outfit/800.css'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles.css'

window.addEventListener('error', (e) => {
  window.api.logMessage('error', `window.onerror: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`)
})
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason instanceof Error ? e.reason.stack || e.reason.message : String(e.reason)
  window.api.logMessage('error', `unhandledrejection: ${reason}`)
})

await initMediaUrl()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
