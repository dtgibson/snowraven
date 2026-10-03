declare global {
  interface Window {
    srLaunch?: { release(): void; fail(): void }
    // Set by the index.html launch script when the Android System WebView is
    // below the floor (lib/webviewFloor.ts); main.tsx then never mounts React.
    __SR_WEBVIEW_BELOW_FLOOR__?: boolean
  }
}

/** The static first frame owns its own lifetime; React only signals a committed destination. */
export function releaseLaunch(): void {
  window.srLaunch?.release()
}
