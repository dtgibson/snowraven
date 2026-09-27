declare global {
  interface Window {
    srLaunch?: { release(): void; fail(): void }
  }
}

/** The static first frame owns its own lifetime; React only signals a committed destination. */
export function releaseLaunch(): void {
  window.srLaunch?.release()
}
