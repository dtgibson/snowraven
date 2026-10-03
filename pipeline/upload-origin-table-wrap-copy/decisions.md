# Decisions — upload-origin-table-wrap-copy

## 1. Cross-site write refusal is backend-only (Stage 1, Guide, hands-off)

The brief offered two mechanisms. Chosen: refuse an unsafe-method request when
`Sec-Fetch-Site` is present and is not `same-origin`, falling back to an Origin check only
when `Sec-Fetch-Site` is absent. Every current browser sends `Sec-Fetch-Site`, and it reads
`same-origin` through the Vite dev proxy, `./start.sh`, a LAN hostname, nginx and
`tailscale serve` alike, because the browser judges the origin before any proxy rewrites
Host. The custom-header route would change `WebStorage`/`WebTransport` for no added
coverage. Requests with neither header (curl, TestClient, Node tooling) pass.

**REVERSED at QA attempt 1 (see section 4).** The premise was false: the Tester measured
that current Chromium and WebKit send no `Sec-Fetch-*` header at all to a plain-HTTP
address that is not loopback, so on a LAN Pi or a dev page opened by LAN address the
Origin fallback was the only check, and it refused the app's own writes behind the Vite
proxy and behind a Host-rewriting nginx.

## 2. Anti-framing is `DENY` with no override (Stage 1, Guide, hands-off)

The Evaluator noted that blocking all framing would break a self-hoster who embeds a Pi
install in a home-dashboard iframe, and left an environment override open. Not taken:
nothing in the repo frames the app, no user has asked for it, and an override is
complication this fix has not earned. Reversal condition: a self-hoster reports a
dashboard embed; the fix is then an env-gated `frame-ancestors` allowlist in the same
middleware.

## 3. Release ordering (Stage 1, Guide)

1.0.47 (targets-hotspot-link) was mid-ship in its own worktree when this run started. This
folder was fast-forwarded to `bf961b9` (1.0.47) before the Evaluator ran, so the Targets
wrap fix builds on 1.0.47's Last report changes. This run ships as 1.0.48 and does not
begin its release until 1.0.47 has shipped on every leg.

## 4. Cross-site write refusal uses a required request header (QA attempt 1, Guide, hands-off)

Replaces section 1. The app's own web writes carry a fixed custom request header, and the
backend refuses an unsafe-method request that came from a browser (it carries `Origin` or
any `Sec-Fetch-*` header) but lacks that header. A cross-site page cannot add a custom
header without a CORS preflight, which the existing CORS middleware refuses for any
foreign origin, so the check needs no Host, Origin or proxy comparison and works the same
on localhost, a LAN Pi, the Vite dev proxy, nginx and `tailscale serve`. Callers with no
`Origin` (curl, TestClient, Node tooling) pass. "Accept the limit" was not taken: it would
have broken writes for self-hosters behind a default nginx. The narrower Vite `xfwd` plus
nginx documentation route was not taken either, because it still relies on a header a
proxy may or may not forward.

**Vite's dev CORS turned off (QA attempt 1, Engineer, hands-off).** The header is
unforgeable only if nothing in front of the backend answers a preflight itself. Vite 8's
dev server does, for any `localhost` or `127.0.0.1` origin, echoing the requested headers;
measured in Chromium and WebKit, a page on another local port added the header and wrote
through the dev proxy. `frontend/vite.config.ts` now sets `server.cors: false`, so the
preflight reaches the backend's CORS and is refused. The app's dev page is same-origin with
Vite and never preflights. The browser marker is `Origin` or `Sec-Fetch-Site`, not any
`Sec-Fetch-*`: Node's `fetch` sends `Sec-Fetch-Mode: cors` with no Origin, and the Node
tooling in `website/tools` posts to the backend.

## 5. Audit findings (Stage 4, Guide, hands-off)

- **M1 (Medium), fixed before ship:** the backend's CORS still trusted
  `http://localhost:5173`, Vite's default port, so any other project served there could
  send the app's header, write to any reachable SnowRaven web/Pi server and read both
  stored API keys. Nothing needs the entry now that the dev page is same-origin through
  the Vite proxy, and the changelog's "only SnowRaven's own page" promise depends on its
  removal. `allow_origins` becomes empty; CORSMiddleware stays so foreign preflights keep
  their 400.
- **L1 (Low), accepted and recorded:** DNS rebinding passes the guard, as it passed the
  server before this fix; nothing checks Host. One sentence at the guard says so, and the
  Chronicler records an opt-in Host allowlist in ROADMAP.
- **I1 (Informational), accepted:** an unhandled-exception 500 carries none of the four
  headers; its body is a fixed "Internal Server Error".
