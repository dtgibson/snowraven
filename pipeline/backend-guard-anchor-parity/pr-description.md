## Backend guard anchor and character-class parity (v0.5.88)

### What this does

Corrects two backend route guards so each enforces what it claims to. They are
the same *class* of defect (a regex admitting values its own contract excludes)
but they are two independent bugs, and neither fix would have closed the other.

**Finding 1 — an anchor bug.** `backend/routers/settingskv.py` validated a
settings key with `_KEY_RE.match(key)`. Python's `$` matches *before* a trailing
newline, so `"theme\n"` passed a guard that shape-checks a value one line before
it becomes a filename. `POST /settings/theme%0A` returned 200 and wrote a second
file `theme\n.json` beside `theme.json`, and `POST /settings/keys%0A` walked past
the `_RESERVED_KEYS` defense-in-depth layer where the un-suffixed form 404s. Now
`fullmatch`, the house form for the Python half of any shape guard. Its character
class was already explicit ASCII, so the v0.5.54 class rule did not apply here.

**Finding 2 — a character-class bug.** `weather.py` and `tide.py` each carried a
byte-identical `re.fullmatch(r"S\d+", checklist_id)`. Python's `\d` matches every
Unicode decimal digit, so `S٠١٢` (Arabic-Indic) passed the backend while the JS
guard on the same request path rejected it. Now `^S[0-9]+$`, and **single-sourced
onto `services/ebird.py` as `CHECKLIST_ID_RE`** — both routers already imported
from that module. Their anchor was already `fullmatch` and is unchanged.

Not swept in, deliberately: the four pydantic `pattern=` constraints in
`routers/map.py` and `routers/media.py` are correct as they stand (Rust regex
engine, already explicit ASCII), and `services/tide.py`'s three `\d` sites are
NOAA response parsers with no anchor and no twin.

### User-facing impact

None. Every currently valid settings key and checklist id is accepted exactly as
before; only inputs already outside the guards' stated contracts are now
rejected. No traversal was ever reachable through the settings store and none is
now (`..` and `a/b` are rejected upstream by routing, before `_key_path` runs);
the real residual closed is settings-namespace pollution plus the bypassable
reserved-key check. Finding 2 was never SSRF: a Unicode-digit id simply 404s at
eBird.

### How to test

See `how-to-see.md` in this folder for the route-level walkthrough. In short:
start the backend, then `POST /settings/theme%0A` (now 422, previously 200 plus a
stray file) and `GET /weather/S٠١٢` (now 400).

### Notes for reviewer

**Each fix was proven by reverting it alone and watching the right tests go red.**
Not reasoned about — run, with the files restored byte-identically afterwards
(sha-verified):

| Experiment | Result |
|---|---|
| Revert finding 1 alone (`fullmatch` → `match`) | 3 settingskv tests RED; all 27 finding-2 tests GREEN |
| Revert finding 2 alone (`[0-9]` → `\d`) | 4 tests RED (parity ×2, weather, tide); all 25 settingskv tests GREEN |
| Revert **both** | the two cross-direction "was ALREADY correct" tests stay GREEN |
| Mutate settingskv's *class* to `\d` | its class test goes RED (so that test is not vacuous) |
| Mutate the compiled *pattern* off `fullmatch` | the parity test's anchor assertions go RED |
| Mutate **both router call sites** to `.match(...)` | both routers' route tests go RED (2 failed, 225 passed) |
| Mutate **one** router call site | only that router's route test goes RED |
| Mutate either JS guard to a Unicode-aware class | the vitest half goes RED (so it drives shipped code) |

The third row is the evidence these are genuinely two defects: applying either
finding's rule to the other's file changes nothing, because each file already
satisfied it.

**Rows 6 and 7 exist because row 5 measured the wrong thing, and QA caught it.**
Row 5 as originally written mutated the *compiled pattern* and reported that the
anchor was pinned. It was not: the shared fixture's newline rows and the parity
test's `_accepts` helper both exercise `CHECKLIST_ID_RE` directly, so they pin
the **pattern**, never the **call sites**. Mutating both routers to
`CHECKLIST_ID_RE.match(checklist_id)` left the entire 227-test suite green while
the mutation was behaviorally live — `GET /weather/S123%0A` passed the guard,
where shipped code refuses it, because Python's `$` matches before a trailing
newline. That is precisely the defect class this change exists to close, one
level up from where it was being measured. The route tests now carry
trailing- and leading-newline rows, so the call sites are pinned separately from
the pattern, and the mutation is caught per-router rather than only in
aggregate. `HEAD` already used `fullmatch` at those call sites, so nothing
shipped was wrong; the *test* was, and a mutation expected to go red that does
not is a finding about the test.

Two details that make those rows real rather than nominal: the newline is written
as a `%0A` URL escape (never a literal) with the decoded value pinned by
`unquote(...) == "S123" + chr(10)`, and it was verified out-of-band that `%0A`
genuinely survives Starlette's routing — the handler receives `'S123\n'` rather
than the request 404ing before the guard runs, which would have made the row
pass for the wrong reason. Both route tests set the API keys and mock
`fetch_checklist` with `assert_not_awaited()`, so a 400 can only be the shape
guard and a mutated build cannot reach the network. The mutation harness was
sanity-checked against an unmutated baseline first (2 passed, a visible count),
so a harness that silently ran zero tests could not have reported green.

**Test placement is deliberately asymmetric.** Finding 2 has real frontend twins,
so it gets a shared fixture (`frontend/src/lib/checklistId.fixture.json`) driven
by both a pytest half and a vitest half through shipped code, plus non-vacuity
tests on both sides. Finding 1 has **no** JS twin — the storage seam builds
`/settings/{key}` from hardcoded keys with no shape guard — so a shared fixture
there would invent a parity that does not exist; it extends
`test_settingskv_router.py` instead. And because the weather/tide guard is now
single-sourced, **each router keeps its own route-level test**: single-sourcing
prevents the copies drifting, not a copy being dropped.

**One claim in the brief did not survive grepping, and I corrected it rather than
shipping it.** The brief (and the source comments I first wrote from it) said
single-sourcing makes the twin relationship "one-to-one as it is on the JS side."
The JS side is *not* one-to-one: `/^S\d+$/` appears in six places —
`SUBMISSION_ID_RE` (`components/speciesDetail/ui.tsx`), `isValidChecklistId`
(`lib/checklistId.ts`), and local copies in `lib/mediaStats.ts`,
`lib/speciesStats.ts`, `map/TargetMarkers.tsx`, `map/NearbyLiferMarkers.tsx`.
They all agree today because JS `\d` is ASCII-only. Two consequences:

1. The guard that actually gates the *request* to `/weather/{id}` and
   `/tide/{id}` is `isValidChecklistId` (App.tsx checks it before fetching), not
   `SUBMISSION_ID_RE`, which gates whether an id becomes a link. **The vitest
   half now drives both**, and asserts they agree with each other on every row,
   so neither can drift away from the backend with the file still green. That
   third assertion is what caught the mutation in the last table row above.
2. Four artifacts now state the scoped version of this claim and are checked to
   agree: the definition site (`services/ebird.py`, above `CHECKLIST_ID_RE`),
   `checklistId.fixture.json`, `test_checklist_id_parity.py`, and
   `checklistId.parity.test.ts`. Each says single-sourced **for this transport**,
   names `isValidChecklistId` as the request-path guard and `SUBMISSION_ID_RE` as
   the link guard, and names the same four out-of-scope copies. `grep` over the
   changed files returns no surviving one-to-one claim outside this paragraph,
   which rejects it. Consolidating the JS side is separate work (ROADMAP).

**That claim regressed during review and was restored; declaring it rather than
leaving it in the shas.** In QA round 2 the definition-site comment reverted to
the wrong one-to-one text (`services/ebird.py`, 23 → 15 insertions) as an
undeclared production-file change. Cause: my mutation harness snapshots each
source file before an experiment and copies it back afterwards, and the snapshot
of `ebird.py` had been taken *before* the round-1 correction. Round 2 refreshed
the snapshots for `weather.py` and `tide.py` but not that one, so the restore
faithfully reinstated stale content. The harm was compounded by the verification
step: it diffed the restored file against the same snapshot it had restored
*from*, so it could only ever confirm the copy succeeded, never that the content
was correct, and it reported "restored byte-identical" while the correction was
gone. **A restore-verification must compare against the intended content, not
against the snapshot used to perform the restore** — the two are the same bytes
by construction, so that check is self-confirming. This is the same shape as the
finding above it: something reported as measured was measuring itself. Nothing
executable moved (comment text only; suite unchanged at 227), and the four
artifacts above are now verified to agree by inspection rather than by recall.

**Other things worth knowing:**

- **Starlette's own route regexes forgive a trailing newline too.** `GET
  /settings/keys%0A` matches the *dedicated* apikeys route rather than reaching
  the generic store at all, which is why the reserved-key assertions are on POST.
  Those dedicated handlers read and write fixed filenames and never interpolate
  the path, so no key shape reaches a filename through them. Recorded in the test
  with an assertion so a later reader sees it was looked at, rather than
  mistaking it for this guard still leaking. Out of scope and benign.
- **Exotic characters are `\uXXXX` escapes everywhere**, in the JSON fixture and
  both test halves, and every non-vacuity test pins the code points directly, so
  a flattened escape fails rather than silently narrowing the probe set. The
  fixture carries three separate Unicode Nd blocks (Arabic-Indic, fullwidth,
  Devanagari) plus a mixed ASCII/non-ASCII id, because any one alone would leave
  a `\d` regression passing on most of the probe set.
- **The shipped CSS bundle is byte-identical.** This repo's Tailwind
  auto-detection scans test files, so a new word in a `.test.ts` can grow the
  stylesheet. Measured rather than assumed: `dist/assets/index-*.css` is 49,664
  bytes at the same content hash `f2314eb…` with the new test and fixture present
  and with them moved aside, with a determinism control and a reproducibility
  control (four builds, all identical).
- `import re` was dropped from both routers (now unused); ruff confirms.

### Verification

- `backend`: **227 passed** (17 new), ruff clean
- `frontend`: `npm run build` (`tsc -b && vite build`) clean, `npm run lint`
  clean, **2,504 vitest tests passed** (6 new)

### Out of scope, flagged not fixed

- **`CHECKLIST_ID_RE` guards two routes, not the module — and the comment
  originally said otherwise.** As first written it said the routers gate "before
  a checklist id reaches this module," which reads as module-wide coverage that
  does not exist: `fetch_checklist_species` is called from
  `/checklists/{checklist_id}` (`routers/checklists.py`), which does not gate, so
  an unvalidated id reaches the same outbound eBird URL construction. Caught by
  the Auditor; the comment now names the two gating routes and the ungated
  caller. Reachability was then measured end to end at the route: the host cannot
  be steered (`@`, `://`, `//` all stay on `api.ebird.org`), the request cannot be
  split (CR/LF rejected as non-printable ASCII), and the reachable injection is
  the **query string only** — `/checklists/S1%3Ffoo=bar` arrives as `S1?foo=bar`
  and yields `…/checklist/view/S1?foo=bar`.

  **Traversal is NOT reachable, and my first write-up of this said it was.** I had
  measured `httpx.URL()` in isolation, where `../../etc/passwd` genuinely does
  collapse to `/etc/passwd`. That needs a literal slash in the value, and
  Starlette's default `str` path converter (`[^/]+`) makes the captured value
  exactly one segment — so every traversal form 404s before the handler is
  reached. Confirmed on live uvicorn over raw sockets (so nothing normalized the
  path client-side), including the `%252F`, backslash, overlong UTF-8 `%C0%AF` and
  fullwidth solidus U+FF0F smuggling attempts, none of which produced a separator.
  This is the isolation-versus-route trap from earlier in this build, inverted:
  the first one under-stated what reaches the code, this one over-stated what
  reaches the network. Over-claiming risk is the safer direction but it is still
  false, and it would have sized the deferred work a grade too high. The comment
  now names the converter as the tripwire, since switching that route to
  `{checklist_id:path}` (regex `.*`) removes exactly that protection.

  Deliberately **not** fixed here: adding a guard to
  `/checklists/{checklist_id}`, and length-bounding `CHECKLIST_ID_RE`, are both
  pre-existing conditions outside this build's approved scope and belong to their
  own change with The Evaluator as the scope gate. This build's obligation was
  that the comment stop claiming something untrue.
- The six-way duplication of `/^S\d+$/` on the JS side (above).
- `CLAUDE.md`'s anchor-parity bullet and `ROADMAP.md`'s first "On the Horizon"
  bullet both describe these two findings as open, which goes false on ship.
  Left for The Chronicler.
