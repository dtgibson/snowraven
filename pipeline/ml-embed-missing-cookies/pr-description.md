## ML embeds: show our own card when Cornell's bot check is up (0.5.76)

### What this does

The Cornell Lab put Anubis (a proof-of-work anti-scraper gate) in front of
`macaulaylibrary.org`. Its interstitial needs a cookie that a cross-site iframe
cannot hold, so every embedded Macaulay player in SnowRaven rendered Cornell's
"Missing feature Cookies" card. The app's existing give-up/`onError` fallback
could not catch it: the interstitial is a successful HTTP 200 that fires
`onLoad`.

SnowRaven now probes the embed endpoint out-of-band and, when the gate is up,
renders its own fallback (local date, checklist link, "View on Macaulay
Library") instead of mounting a frame at all. No iframe is created while the
gate is up, so the app is not hammering protection Cornell deployed
deliberately.

The alternative of rendering media directly from Cornell's CDN was verified to
work and **deliberately rejected** at Stage 1: it routes around that protection.
The reasoning is recorded in `bug-brief.md` so it is not silently re-litigated.

### How to test

1. `cd backend && uvicorn main:app --reload --port 1620`
2. `cd frontend && npm run dev`, then open http://localhost:5173
3. Open Named Birds, expand an individual that has media (or open Species
   Detail for a species with a Macaulay upload).
4. While the gate is up, every tile shows "Media can't play here right now"
   with its date, checklist link, and a working "View on Macaulay Library"
   button. No Cornell error card appears, and no `<iframe>` is in the DOM.
5. `curl "http://localhost:1620/media/embed-status?catalogId=662004247"` returns
   `{"gated":true}` while the gate is up.

### Notes for reviewer

- **New route `/media/embed-status`** (`backend/routers/media.py`) with the
  desktop twin `lib/tauri/mediaService.ts`. Keep them in lockstep: same browser
  User-Agent (the gate only challenges browser-shaped requests), same two
  markers, same result shape. `/media` was added to the Vite dev proxy.
- **Detection uses two independent signals** (the interstitial's markup ids and
  its `anubis` cookie name) so a change to either alone does not blind the
  probe. It deliberately does **not** match the visible "Missing feature
  Cookies" string: that text is not in the HTML, it is written later by the
  challenge's own script.
- **Fails open.** Any probe failure resolves to "not gated", so a probe that
  cannot run never hides media that would have played. Covered by a test in
  both the lib and the component suites.
- **The signal is global, not per-viewer.** Nothing in the page can observe a
  cross-origin frame's outcome, so a browser that could pass the challenge
  (Chrome on an HTTPS origin) sees our card rather than a player. Accepted
  deliberately: Safari blocks third-party cookies outright and is also the
  engine behind the macOS and iOS apps. It self-heals when Cornell lifts the
  gate, with no code change.
- **Not in `CACHED_GET_PATHS`.** `lib/mlEmbedGate.ts` owns the caching with a
  session-scoped single-flight probe (one caching layer per call).
- The probe is skipped entirely when "Disable embedded media" is on, so a
  deliberately disabled surface makes no network call.
