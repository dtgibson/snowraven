## Playwright gate

> **COMMIT THIS WITH `git add -A`.** The three harness deletions are staged in
> the index; their replacements (`website/tools/verify/`, `package.json`,
> `package-lock.json`) are untracked. `git commit -a` or `git add -u` would
> commit the deletions and add nothing, leaving a tree where CI fails at
> `npm ci` in `website/tools` with no manifest to read. Found by QA before the
> commit, recorded here because the hazard outlives this conversation.

### What this does

Promotes three of the repo's fourteen committed real-engine Playwright
harnesses from hand-run `pipeline/` artifacts into an actual gate: a tracked
home at `website/tools/verify/`, one runner behind
`npm run verify --prefix website/tools`, and one step in `pipeline.yml`'s
frontend job immediately after `npm run build`. The gate **fails when `CI` is
set and Playwright is unavailable**, and skips loudly when it is not, which is
`.claude/rules/testing.md`'s rule that a harness which skips silently is worse
than no harness at all.

Dev-only. No shipped file is touched, no version bump, no changelog entry, no
website version pill change. The frontend bundle is byte-identical, measured
rather than asserted (see below).

### The `.gitignore` change, named rather than done silently

`website/tools/.gitignore` listed `package.json` and `package-lock.json`
alongside `node_modules/`, `demo-data/` and `shots/`, and neither manifest was
tracked. **Playwright was therefore declared nowhere in this repository.** A
fresh clone got five `.mjs` files and a README; all fourteen harnesses failed at
`createRequire` on any machine but the one they were written on, and so did this
directory's own screenshot pipeline, latently.

This change un-ignores and commits both manifests. **Read it as a correction of
a mis-grouping, not a reversal of a decision:** the three entries left in the
file are build artifacts that are regenerated locally and would be wrong to
commit; the two removed are manifests, which are the opposite kind of thing. The
`.gitignore` now says so in a comment, so they are not re-added by someone
tidying. If you disagree that this is a mis-grouping, the alternative reading is
that committing them reverses a deliberate choice to keep this directory
local-only, in which case this line is the one to argue about, not the rest of
the diff.

Proven, not assumed: `npm ci` from the two tracked manifests into an empty
directory succeeds and resolves `playwright@1.62.1`.

### What is in scope, and what is deferred

| harness | disposition |
|---|---|
| `verify-backlog-alert.mjs` | promoted |
| `verify-palette.mjs` | promoted (two absolute home-directory paths removed) |
| `verify-webkit-tab-premise.mjs` | promoted (given an exit code) |
| the ten `nav-rework` printers | **deferred** — no exit codes, hardcoded to `http://127.0.0.1:45817/`, a dev server nothing in the repo starts |
| `verify-design.mjs` | **deferred** — drives a per-build `design.html` mockup with no meaning once the build ships |

The three promoted files were **moved** out of `pipeline/`, not copied. Two
tracked copies of a harness is how they drift, and leaving the palette copy
behind would have left its dead absolute path in the tree.

**A move breaks inbound references, and one was live in shipped source.**
`frontend/src/components/honestLoadFailures.test.tsx` carried a present-tense
instruction to reproduce Finding E by running
`pipeline/weather-backlog-honest-load-failure/verify-backlog-alert.mjs` -- a path
this build deleted. Caught by QA; swept at paragraph scope per
`.claude/rules/docs-and-website.md`, which is path-gated on `website/**` but
names `frontend/src/` explicitly for exactly this shape (v1.0.17: a claim that
reached prose from the source is swept starting at the source). The paragraph
now gives the new path, says the harness runs in CI rather than by hand, and
names the `--expect-broken` form; the command it prints was run verbatim from
the repo root to confirm it is executable as written. A full sweep found no
other live reference: the only remaining ones are in historical
`pipeline/*/pr-description.md` build records, which are correct as they stand
because they describe where the file was when that build shipped.

That edit lands in a **Tailwind-scanned** tree, where a rare utility word in a
comment emits a CSS rule and moves the bundle hash (`.claude/rules/testing.md`,
v0.5.85). Re-measured rather than reasoned about; see below.

**Single-sourcing the deliberate-exceptions allowlist is deliberately NOT done.**
`DECISIONS.md` v1.0.16 named it as a promotion requirement; on inspection it is
not a gate change at all. None of the three promoted harnesses reads the
exclusions roster, so single-sourcing it is a prose repair to `ACCESSIBILITY.md`
and `lib/useFocusTrap.ts` against the roster `tabOrderCoverage.test.ts` already
owns — and it collides with the queued `FOCUSABLE_SELECTOR` build that owns
`useFocusTrap.ts`. Deferred with that reason written down, in `DECISIONS.md` and
on the ROADMAP. The third hand-maintained copy the entry warned about was never
written, which is what the warning was for.

### Splitting scenario from apparatus

One shared `serveDist.mjs` replaces two near-duplicate static servers, and it
carries the union of what each had: the path-traversal `normalize` only the
palette harness had, and the `Object.hasOwn` MIME guard the backlog harness's
own header asked a promoting build to fold in (`.claude/rules/security.md`
v0.5.81 — a bare `TYPES[ext]` returns a truthy inherited member for at least
twelve keys, and `?? fallback` cannot see one).

The scenarios themselves are unchanged. The line the module draws is worth
stating because it also decides what an environment variable may override:

- **Apparatus is overridable.** `verify-palette.mjs`'s server is a plain static
  server, so `SR_VERIFY_BASE` points it at any running instance instead, the way
  four of the `nav-rework` harnesses already honour `NAV_BASE`.
- **A scenario is not.** `verify-backlog-alert.mjs`'s stub backend — a stored
  eBird backup whose bytes will not come back — *is* what it measures, so it
  takes a dist and no base override. Pointing it elsewhere would silently
  measure a different state.

### The tab-premise harness keeps its null result

It had no exit code. It now has one, and it separates *the apparatus broke* (1)
from *the premise measured null* (0). Every verdict — CONFIRMED, NULL, MIXED —
exits 0 and prints in full, because all three are observations about WebKit
rather than statements about our code, and CI must not go red on a vendor
default.

Its apparatus check is Chromium as the known-clean control (`.claude/rules/
testing.md`: sanity-check the probe against a configuration already known to be
clean). Full keyboard access is on there by default, so it must reach all seven
fixture controls, and both engines must reach the trailing `<input>` — a text
input is in the tab order in every mode of every engine, so failing to reach it
means the walk stalled. Measured at promotion: Chromium 7/7, WebKit skipping the
plain button and link and reaching the `tabindex="0"` ones. **The premise is
confirmed on this machine rather than carried.**

### `ROADMAP.md`:68

Struck and rewritten. Its recommendation targeted "a `verify:regions`-style
script in `website/tools/package.json`" — a file that was not in the repo and
could not be executed as written. Two further corrections it needed: the
`TYPES[extname(file)]` lookup it attributed to the tab-premise harness was in
the **backlog** harness (the tab-premise one drives an inline fixture and has no
server at all), and the item now records what remains rather than what to do.

`DECISIONS.md` v1.0.16's three touched passages are amended in place: two
discharged, one deferred with its reason.

### How to test

See `pipeline/playwright-gate/how-to-see.md`.

### Notes for reviewer

**The gate was proven to gate, not merely to pass.** Every claim below is a
measured run, not an argument:

| what was broken | result |
|---|---|
| `playwright` moved out of `node_modules`, `CI` unset | exit **0**, unmissable skip banner |
| same, `CI=1` | exit **1**, names the missing package and the fix |
| `PLAYWRIGHT_BROWSERS_PATH` at an empty dir, `CI` unset / `CI=1` | exit **0** / exit **1**, naming both missing browsers |
| runner pointed at a directory with no `index.html` | exit **1** before launching anything |
| close button's `tabIndex={0}` removed from `CommandPalette.tsx`, rebuilt | palette harness exit **1**, 21/24 — and **WebKit only** reports focus escaping the overlay entirely |
| backlog harness against a real pre-fix build (worktree at `3e9c162^`) | exit **1**, **exactly 4** checks fail, and the pre-fix build shows the setup-shaped title the fix removed |
| same build, `--expect-broken` | exit **0**, "HARNESS DISCRIMINATES: 4 check(s) failed" |
| tab-premise Tab walk cut to one press | exit **1**, apparatus failure |
| tab-premise fixture roster naming a control the page lacks | exit **1**, apparatus failure |
| tab-premise fixture where WebKit reaches everything (**must stay green**) | exit **0**, NULL RESULT |
| `--expect-broken` against the **fixed** dist (QA's addition) | exit **1**, "HARNESS IS VACUOUS" -- the inverted mode is not a free pass either |
| runner against the pre-fix dist | exit **1**, "2 of 3 harnesses RED" |
| a `verify-*.mjs` stub dropped in the directory and left off the order list | **discovered and run**, denominator went to 4, its failure made the gate exit **1** |
| a name on the order list renamed off disk | exit **1**, "the run order names a harness that is not here" |
| a harness that hangs (budget cut to 4 s) | exit **1**, `FAIL ... (timed out after 4s)`, **0** orphaned processes |
| a harness that hangs *and* ignores `SIGTERM` | `SIGKILL` at +5 s, exit **1**, **0** orphaned processes |
| `SIGINT` to the runner mid-run | exit **130**, no surviving child, no stray browsers |
| a **directory** named `verify-dir.mjs/` with an `index.js` inside | excluded: denominator stayed 3, payload never executed |
| a **symlink** `verify-link.mjs` pointing outside the tree | excluded: denominator stayed 3, payload never executed |
| the identical payload as a **real file** (the control) | discovered, executed, denominator 4 -- so the two exclusions above are real, not a blind probe |
| `SIGHUP` to the runner mid-run (a closed terminal window) | exit **130**, harness and **5** Playwright-cache processes gone, **0** orphans |

The palette mutation is worth a second look: dropping one `tabIndex={0}` makes
the focus trap leak **in WebKit and not in Chromium**, which is the v1.0.16
platform fact live, and is exactly what jsdom cannot see.

**Byte-identity, measured.** Two HEAD builds first, to establish the noise floor:
identical across all 137 files. The `CommandPalette.tsx` mutation was restored
with `git checkout --` (the intended content, never the snapshot used to perform
the restore) and rebuilt: identical again. Final build with the whole change in
place: **all 137 files SHA-256 identical to the pre-change baseline.**

The QA fix put one comment edit inside `frontend/src/`, so the Tailwind
comment-scanning trap became live and the measurement was re-derived from
scratch rather than inherited from QA's. Two builds, both against the same
baseline: like-for-like (`rm -rf dist`, the procedure the baseline used), then a
second control with `node_modules/.vite` cleared as well. **137/137 identical
both times, including `dist/assets/index-Dq-tYV-H.css` at the same content hash
and the same 87,853 bytes** -- which is the specific thing a rare utility word in
a comment would have moved. Nothing else under `frontend/` is touched at all.

### Security review: three findings closed

**PASSED WITH NOTES**, nothing blocking. Three taken, five accepted as-is.

**1 (Low) — the runner's roster was hand-written while its header claimed it
scanned the directory.** This build's own thesis failing one level up: a fourth
harness dropped into `verify/` would have been silently unrun while the summary
printed `3/3 green` over a denominator that had quietly shrunk. **Membership now
comes from the directory** (`verify-*.mjs`), and an unlisted harness *runs*
rather than failing, because a file named like a harness in the gate's own
directory is a harness — running it is what the reader expects, and skipping it
is the thing this whole build exists to prevent. The list in `run.mjs` now sets
only the ORDER of the names it holds, and a name on it that is not on disk fails
the run, which catches a rename leaving it stale. The `verify-` prefix is what
keeps `serveDist.mjs`, `playwright.mjs` and `run.mjs` out of the set; confirmed
by measurement that none of the three is executed. The header is now true.

**2 (Low) — nothing bounded a hung harness.** It was the one outcome a gate must
never have: neither green nor red, for up to GitHub's six-hour default. Each
harness now has a 180 s budget and the frontend job has `timeout-minutes: 25`.
180 s is **~29x the slowest harness measured locally** (6.2 s, so it cannot fire
on contention), and three of them at that bound is ~9 minutes, comfortably
inside the job's 25 — the two bounds are sized against each other rather than
picked separately. A timeout is a **failure**, named as such in the summary,
for the same reason a missing dependency is one under `CI`.

The children are spawned **detached**, so a timeout kills the harness *and the
browsers it spawned*: without that, every timeout would leave WebKit and
Chromium processes taxing the machine, which is a documented recurring cost in
this repo. That in turn obliges the runner to tear its child down on `SIGINT`,
which it does. Measured: zero orphans in all three kill paths.
`SR_VERIFY_TIMEOUT_MS` overrides the budget, and a non-positive or unparseable
value falls back to the default rather than disabling the bound (verified across
`''`, `0`, `-5`, `abc`).

**3 (Informational, taken) — `pipeline.yml` declared no `permissions:`.** Now
`permissions: { contents: read }` at workflow level. Nothing was widened: the
Auditor measured the org default as `read` via the API, so this grants nothing
new — it pins the floor *locally*, where a reader of the workflow can see it,
instead of leaving it to an org setting outside the repo that could be flipped
with no diff here. Checkout reads; npm and pip install from public registries
with no token; the gate only runs code. No step needs more.

### Re-audit: two more, both introduced by the remediation above

Both Low, both one token, both closed. They are worth reading together, because
each is the *cost of the previous fix* rather than a fresh mistake -- which is
the pattern this build kept meeting.

**9 -- the discovery predicate filtered on the NAME, not on what the entry is.**
Deriving the roster from the directory closed the drift and opened this:
`readdirSync` returns directories and symlinks too, so a directory named
`verify-dir.mjs/` (Node then runs the `index.js` inside it by CJS resolution) or
a symlink pointing anywhere at all would be **executed, counted, and reported
`PASS`** -- a non-harness in the denominator, printing `N/N green` over it. The
same false assurance as an unlisted harness, one layer further down. Now
`withFileTypes: true` + `isFile()`, which closes both rows with one predicate
because a symlink `Dirent` reports false.

**10 -- `detached: true` sold terminal signal delivery.** Detaching bought the
ability to kill a hung harness's browsers with it; the price is that the child
no longer dies with the parent's foreground process group, so *every* signal
that can end the runner has to be handled or the detach leaks through whichever
one is missing. `SIGHUP` -- a closed terminal window -- was that one, measured
orphaning the harness and both browsers. Now on the handler list. A dev-machine
leak only; CI runners are ephemeral.

**Proof, with the controls that make the absences mean something.** For 9, the
pre-fix predicate was run side by side with the new one over the same directory:
it admits **5** entries (the three harnesses plus the directory and the symlink),
the new one admits exactly **3** -- so the fix is load-bearing rather than the
case being unreachable. Both non-harnesses were then present during a real gate
run: denominator stayed 3, neither reached the summary, and the payload's marker
line never appeared. The control is the identical payload as a real file, which
*was* discovered and *did* execute (denominator 4, marker printed once), so the
detection mechanism can fire and the two absences are exclusions rather than a
blind probe. One payload, valid as both CommonJS and ESM, so all three cases are
detected by the same mechanism however Node loads them.

For 10, orphans are counted by the **`ms-playwright` cache path**, never by a
name grep: macOS runs ten permanent `WebKit.framework` XPC services that a naive
match reports as standing orphans. Baseline 0 cache processes; mid-run **5**
visible plus the harness child (so the probe can see what it claims to count);
after `SIGHUP`, runner exit **130**, **0** cache processes, **0** harness
children, and the ten system services still running and correctly excluded.

**Accepted, not fixed** (all Informational, per the review): the `--with-deps`
apt layer not being lockfile-pinned — and note the finding's premise does not
apply to the comment as written, which claims pinning for the npm half only and
says nothing about apt; `distRelativePath`'s unasserted caller precondition;
the summary not distinguishing tab-premise CONFIRMED from NULL; and fork-PR
lockfiles executing in CI.

**One correction to the review, since accepted and the remediation withdrawn.**
Finding 4 recommended `npm exec` over `npx` on the grounds that "neither can
reach the registry". They are the same command: `npx` is npm's own
`npx-cli.js`, and `npx --help` prints `npm exec`'s usage verbatim. The swap would
have bought nothing. The genuinely tighter form is
`./node_modules/.bin/playwright`, which the review also lists — but the path is
unreachable as written (the preceding `npm ci` is what creates that binary, and
steps fail fast), so the step stands as it is. The `--with-deps` criticism was
likewise withdrawn: the workflow comment claims pinning for the npm half only
and says nothing about apt.

**CI cost, and the one thing I could not verify locally.** The frontend job
gains `npm ci` in `website/tools` plus a Chromium and WebKit download with
`--with-deps`, then three harnesses in two engines each. Locally the gate runs
in about a minute; on the runner expect a few minutes more for the browser
install, uncached. **I cannot exercise the GitHub-hosted runner from here**, so
the ubuntu-latest legs — the apt system libraries WebKit needs, and `npm ci` for
`sharp`'s linux binaries — are argued from the lockfile (which does carry the
linux entries) rather than measured. If the first push is red there, that is
where to look, and it is an environment problem rather than a harness one.

One inert thing was caught and removed before it shipped: the first draft of the
CI step set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` on the `npm ci`.
`playwright@1.62.1` has no install script at all (no `scripts` in its
package.json, no `hasInstallScript` in the lockfile), so that variable reads
nothing. The comment in the workflow now states what was verified instead.

**Left alone deliberately.** `pipeline/breeding-legend-overflow/legend-ink-probe.mjs`
still carries an absolute path under the author's home directory; it is not one
of the fourteen and is out of scope. `website/tools/package.json`'s `description`
is still the README's opening paragraph pasted in, and its `main`, `keywords` and
`author` are still `npm init` defaults — untouched so the diff against the
previously-untracked file is exactly the one added script line.
