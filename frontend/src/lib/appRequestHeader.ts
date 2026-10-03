// The request header every web/Pi write to SnowRaven's own backend carries
// (upload-origin-table-wrap-copy, decisions.md 4).
//
// The backend refuses a POST, PUT, PATCH or DELETE that a browser sent (it
// carries `Origin` or `Sec-Fetch-Site`) without this header, before routing
// (`is_refused_browser_write` in backend/main.py, which holds the other
// declaration; backend/tests/test_browser_protections.py compares the two). A
// page on another site cannot add a custom header without a CORS preflight,
// and the backend refuses that preflight, so the header is what separates the
// app's own writes from a forged one. Nothing is compared against Host or
// Origin, so it holds on a LAN Pi over plain HTTP, the Vite dev proxy (which
// forwards it as-is) and a proxy that rewrites Host.
//
// Every web/Pi write spreads `APP_REQUEST_HEADERS` into its `fetch` headers:
// `WebStorage` (storage.ts) and `WebTransport.post` (transport.ts) are the only
// writers. The Tauri halves never call the backend and never need it. A new
// write to the backend adds it too, or is refused with 403 in every browser.
//
// No imports: storage.ts and transport.ts are on the entry chunk.
export const APP_REQUEST_HEADER = 'X-SnowRaven-Request'
export const APP_REQUEST_HEADER_VALUE = '1'

export const APP_REQUEST_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  [APP_REQUEST_HEADER]: APP_REQUEST_HEADER_VALUE,
})
