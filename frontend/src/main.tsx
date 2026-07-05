import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'
import App from './App.tsx'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import { isIOS } from './lib/platform'

// iOS-APP root marker (mobile-app, QA round-1 fix). The safe-area inset rules
// in globals.css hang off `.sr-ios-app` so they apply ONLY in the Tauri iOS
// app — NOT in the web build viewed in iOS Safari, where viewport-fit=cover
// also yields nonzero env() values and ungated rules would have changed the
// shipped web rendering (byte-parity contract). Synchronous, before render,
// so the first paint is already inset-padded on iOS.
if (isIOS()) {
  document.documentElement.classList.add('sr-ios-app')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
