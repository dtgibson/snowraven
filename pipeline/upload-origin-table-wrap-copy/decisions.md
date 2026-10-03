# Decisions — upload-origin-table-wrap-copy

## 1. Cross-site write refusal is backend-only (Stage 1, Guide, hands-off)

The brief offered two mechanisms. Chosen: refuse an unsafe-method request when
`Sec-Fetch-Site` is present and is not `same-origin`, falling back to an Origin check only
when `Sec-Fetch-Site` is absent. Every current browser sends `Sec-Fetch-Site`, and it reads
`same-origin` through the Vite dev proxy, `./start.sh`, a LAN hostname, nginx and
`tailscale serve` alike, because the browser judges the origin before any proxy rewrites
Host. The custom-header route would change `WebStorage`/`WebTransport` for no added
coverage. Requests with neither header (curl, TestClient, Node tooling) pass.

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
