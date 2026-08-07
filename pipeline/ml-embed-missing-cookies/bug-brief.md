# Bug Brief — ML Embed Missing Cookies

## What is broken

Inline Macaulay Library media embeds render Cornell's "Missing feature Cookies"
error card instead of the photo, audio, or video. Cornell has put **Anubis** (an
anti-scraper proof-of-work gate) in front of `macaulaylibrary.org`. A browser
request to `/asset/<id>/embed` now returns an Anubis challenge whose cookies are
`Secure; SameSite=None; Partitioned`; inside a cross-site iframe those cookies
are unavailable, so the challenge can never complete. SnowRaven's own fallback
never fires, because the challenge page is an HTTP 200 that fires `onLoad`.

## Steps to reproduce

1. Open the web app (observed at `http://birdnetpi:1620`) in Safari.
2. Go to a Named Birds row with media, or Species Detail's Recent Media.
3. Every tile shows "Missing feature Cookies" over the Cornell Lab logo.

Verified out of band: `curl` with a Safari UA on `/asset/662004247/embed` returns
the Anubis challenge (`macaulaylibrary.org-anubis-auth` cookie, `anubis_challenge`
markers, `logo-clo-primary.jpg`); the same URL with curl's default UA returns the
real page. Two independent blockers stack: Safari blocks third-party cookies
outright (reported against Anubis upstream as TecharoHQ/anubis#1482, open, no
fix), and a `Secure` cookie is rejected in any browser when the top-level page is
plain HTTP, as this host is.

## Expected behavior

The media plays inline. Where it genuinely cannot, SnowRaven's own fallback
(local metadata, checklist link, "View on Macaulay Library") shows instead of a
foreign error card.

## Blast radius

Both embed surfaces, through the single shared `MediaFrame`:
`NamedBirdMedia.tsx:236` and `RecentMediaEmbed.tsx:48`. Link-outs are unaffected
(they open first-party, where Anubis passes normally). The desktop app's
WKWebView shares Safari's cookie policy and is very likely affected too;
Windows/WebView2 is unverified. Serving the app over HTTPS clears only the
`Secure`-cookie half, not Safari's; the upstream report is from an HTTPS site.

## Fix direction — DECIDED: keep the embed, make the failure honest

Chosen by the user at Stage 1. SnowRaven stays on Cornell's sanctioned embed
path and does not route around their scraper protection: when the gate blocks a
frame, the user sees SnowRaven's own fallback card (date, checklist link, "View
on Macaulay Library") instead of a foreign error. Inline playback is expected to
stop wherever the gate can't pass, until Cornell resolves it upstream.

Rejected: rendering native `<img>`/`<audio>`/`<video>` straight from
`cdn.download.ams.birds.cornell.edu/api/v2/asset/<id>/…` (verified reachable to a
Safari UA with no cookies and no gate: photo `/1200`, audio `/mp3`, video
`/mp4/1280`). It would restore playback, but it steps off the sanctioned path
immediately after Cornell deployed that protection. Recorded here so the choice
is not silently re-litigated later.

**The detection constraint The Engineer inherits.** `onError` cannot see this:
the challenge is a same-status 200 in a cross-origin frame, so nothing readable
reaches the parent. Detection needs an out-of-band probe through the existing
transport seam (backend on web/Pi, the TypeScript service on desktop) asking
whether a browser-UA request to the embed URL comes back as an Anubis challenge.
That yields a global "embeds are gated" signal rather than a per-viewer one, so
it must fail toward showing the real embed, and must clear itself automatically
when Cornell lifts the gate.

## What done looks like

Media surfaces show either working media or SnowRaven's own fallback. No foreign
error card reaches the user on either surface, in Safari and in the desktop app.
