// Open an external URL in the user's default browser, programmatically, working
// in BOTH the web build and the Tauri desktop app.
//
// DO NOT use `window.open()` for this. In the Tauri desktop WebView (WKWebView) a
// programmatic `window.open()` is silently dropped — it never reaches the system
// browser. The app opens external links exclusively through `tauri-plugin-opener`
// (registered in `src-tauri/src/lib.rs`, `opener:default` capability), which
// intercepts CLICKS on `<a target="_blank">` anchors — the app-wide
// OutboundLink / ChecklistLink mechanism — NOT `window.open`. So to open a URL
// from code (e.g. after an async step, where there's no anchor for the user to
// click) we synthesize exactly what the opener plugin listens for: a real click
// on a transient, detached `<a target="_blank">`. This also works on the web
// build, where it opens a new tab just as `window.open` would.
//
// This is the programmatic sibling of the OutboundLink convention: use
// OutboundLink / ChecklistLink for a link the user clicks; use this seam when the
// open must happen from code.
export function openExternalUrl(url: string): void {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
