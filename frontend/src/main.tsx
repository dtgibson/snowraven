import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'
import App from './App.tsx'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import { applyPlatformRootMarkers } from './lib/rootMarkers'
import { reportPaintedTheme } from './lib/theme'

// Platform root markers (`sr-ios-app`, `sr-android-app`; lib/rootMarkers.ts).
// Synchronous, before render, so the first paint is already inset-padded.
applyPlatformRootMarkers(document.documentElement)

// Below the Android System WebView floor the index.html launch script has
// already put the floor message in the launch frame (android-release FR-33);
// mounting React there would only replace an honest sentence with a broken
// screen, so nothing below runs.
if (!window.__SR_WEBVIEW_BELOW_FLOOR__) {
  // Android: tell native which theme the anti-flash script painted, so the
  // status and navigation bar glyphs match from the first frame. A no-op
  // everywhere else (lib/theme.ts).
  reportPaintedTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>,
  )
}
