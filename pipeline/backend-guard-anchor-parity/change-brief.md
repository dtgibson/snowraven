# Change Brief — backend-guard-anchor-parity

## What is changing

Two backend route guards are corrected so each enforces what it claims to. They are the
same class of defect (a regex that admits values its own contract excludes) but they do
**not** share a fix, and neither fix would close the other. **Finding 1** is an *anchor*
bug: `settingskv.py`'s `_KEY_RE.match(key)` uses `$`, which in Python matches before a
trailing newline, so `"theme\n"` passes a guard that shape-validates a key before it
becomes a filesystem path. Its character class is already explicit ASCII, so the class
rule does not apply. **Finding 2** is a *character-class* bug: `weather.py` and `tide.py`
use `re.fullmatch(r"S\d+")` where Python's `\d` is Unicode-aware, so `S٠١٢` passes the
backend and fails the frontend twin `/^S\d+$/` (JS `\d` is ASCII-only). Their anchor is
already correct — `fullmatch` — so the anchor rule does not apply.

## Why now

Both are `Open` findings carried forward from the v0.5.87 security review, deliberately
left to their own change; both are captured as saved ideas and both are the first
"On the Horizon" bullet in `ROADMAP.md`. Shipping this closes that item. Each finding is
the still-live instance of a rule this repo already fixed elsewhere and promoted to
`CLAUDE.md`: finding 1 is the v0.5.87 anchor rule (fixed in `services/ebird.py`'s
transport twins), finding 2 is the v0.5.54 explicit-ASCII-class rule (fixed in `map.py`).

Both reproduce through the real routes, not just at the regex:

- `POST /settings/theme%0A` → **200**, writing a second file `theme\n.json` beside
  `theme.json`. It also bypasses the `_RESERVED_KEYS` defense-in-depth layer:
  `POST /settings/keys%0A` → **200** where `POST /settings/keys` → 404.
- `GET /weather/S%D9%A0%D9%A1%D9%A2` and the `/tide` twin get **past** the 400 guard
  (a control `GET /weather/XYZ` → 400).

## User-facing impact

None. No UI, copy, layout, count, or user-visible behavior changes. Every currently valid
key and checklist id is accepted exactly as today; only inputs that were already outside
the guards' stated contracts are now rejected.

Residual being closed, stated precisely so it is neither over- nor under-sold: **no
traversal is reachable** and none ever was — `..`, `a/b` and percent-encoded variants are
rejected upstream by routing (405) before `_key_path` runs, and `api-keys.json` is never
touched. The real residual is settings-namespace pollution plus the bypassable
reserved-key check. Finding 2 is not SSRF; a Unicode-digit id simply 404s at eBird.

## Design pass

**Not needed — no visual change.** Backend regex guards, their tests, and documentation.
No component, stylesheet, token, or rendered surface is touched.

## Decisions touched

Two entries are **extended and completed, not reversed** — name them as such:

- **v0.5.87** (the escapee-count entry, `DECISIONS.md`): its security review recorded
  anchor parity as one of four closed findings and promoted the rule to `CLAUDE.md`,
  explicitly deferring these two pre-existing counter-examples. This is that deferral.
- **v0.5.54** (County Completeness): recorded the `\d`-accepts-Unicode-digits fix and
  promoted the explicit-ASCII-class rule. Finding 2 is the last live instance.

`CLAUDE.md` itself must change in the same edit: its anchor-parity bullet currently names
both of these as "open counter-examples ... belonging to their own change", a sentence
that becomes false on ship. The pydantic carve-out beside it stays and must be preserved
verbatim in meaning (see below).

## Scope

**In scope (change):**

- `backend/routers/settingskv.py` — `_KEY_RE.match` → `_KEY_RE.fullmatch`, with the
  reason at the call site (the house form for the Python half of a shape guard).
- `backend/routers/weather.py`, `backend/routers/tide.py` — `S\d+` → `S[0-9]+`.
  These are two byte-identical copies of a guard that twins one frontend constant;
  single-source them onto `services/ebird.py` (both routers already import from it), so
  the twin relationship is one-to-one as it is on the JS side.
- Tests (below), plus version bump, `CHANGELOG.md`, `CLAUDE.md`, `ROADMAP.md`.

**Explicitly NOT in scope — the carve-out, verified accurate as written:**
`backend/routers/map.py` (lines 51, 79) and `backend/routers/media.py` (lines 40, 47) are
**correct as they stand and must not be swept in**. All four are pydantic `pattern=`
constraints, which run on the Rust regex engine — that engine rejects a trailing newline,
and all four already use explicit ASCII classes (`[A-Z]`, `[0-9]`). `CLAUDE.md` records
this carve-out beside the anchor rule; a later reader "fixing" them toward `fullmatch`
would be undoing correct code.

**Swept and deliberately excluded, named so a later reader knows they were seen:**
`backend/services/tide.py` (3 sites) uses `\d` under `re.match`/`re.search`. They are
parsers of trusted NOAA response timestamps, not shape guards on user input; they carry
no `$` anchor and no JS twin, so neither rule reaches them. `services/ebird.py` is
already correct (the v0.5.87 fix). **Scope of this claim:** the sweep covered
`backend/**.py` excluding `.venv`, `tests/`, and `__pycache__`, on 2026-08-12; it is a
sweep with a date on it, not a guarantee.

**Version bump is IN scope.** This changes shipped backend code (the FastAPI backend
serves the web/Pi path and `start.sh`), so it is not the dev-only carve-out. Patch bump
0.5.87 → 0.5.88 in **both** `frontend/package.json` and `src-tauri/tauri.conf.json`, a
`CHANGELOG.md` entry, and the `website/index.html` version pill + footer version
(2 sites, lines 48 and 666). That means a real release: tag → Windows CI → `release.sh`
→ iOS TestFlight, per the standing all-platforms rule.

## What done looks like

Each fix is proven by a test that **goes red when the fix alone is reverted** — a test
that stays green under revert is not a guard. The discriminating inputs are named, and
each was confirmed live through the real route, not just against the regex:

1. **Finding 1** — `POST /settings/theme%0A` returns 422 (today: 200 + a `theme\n.json`
   file), and `POST /settings/keys%0A` returns 404 like its un-suffixed form (today:
   200). Leading and embedded newlines already fail and stay failing; `theme` and every
   valid key still round-trip. Reverting `fullmatch` → `match` turns these red.
2. **Finding 2** — `GET /weather/S٠١٢` and `GET /tide/S٠١٢` return 400 (today: they pass
   the guard). `S12345678` is untouched. Reverting `[0-9]` → `\d` turns these red.

**Test placement is deliberately asymmetric, and this is the one thing not to get wrong.**
Finding 2 has a genuine frontend twin (`SUBMISSION_ID_RE = /^S\d+$/`,
`frontend/src/components/speciesDetail/ui.tsx:50`), so it earns a shared fixture on the
v0.5.87 model (`checklistProvenance.fixture.json` + a pytest half + a vitest half, both
driven through shipped code, plus a non-vacuity test asserting the fixture still carries
its hostile rows). Finding 1 has **no** frontend twin — grep confirms the storage seam
builds `/settings/{key}` from hardcoded keys with no JS shape guard — so a shared fixture
there would invent a parity that does not exist; it extends `test_settingskv_router.py`
instead. Because the weather/tide guard is being single-sourced, **each router keeps its
own test**: single-sourcing prevents drift between copies, not a copy being dropped.

Also green: `pytest` (backend), `npm run build` (`tsc -b && vite build`, not just vitest
+ lint), `npm run lint`, and vitest.
