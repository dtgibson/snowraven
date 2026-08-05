# Named Birds audio tiles and documentation sweep (0.5.75)

### What this does

Two independent halves in one release.

**Half 1 — a named bird's audio can now be played.** On the Named Birds tab, an
individual's audio embed sat in a 116px tile (130px on a phone) while the Macaulay
player is taller than that. `.sr-media-frame` sets `overflow: hidden`, so the
transport row was cut off below the frame edge: the recording was visible and
unplayable. Audio now matches photo and video at 230px desktop / 280px phone, the
heights Species Detail live-verified for the same player at a comparable tile width.
Audio also picks up the full offline/failed-load fallback (icon, message, link)
instead of the compact icon-and-link one, which existed only because 116px had no
room for a sentence.

**Half 2 — twelve documentation and website findings**, audited against shipped
0.5.74: the Help sidebar's missing sections, ~50 stray `--` marks in the Help text,
a privacy-policy clause that over-disclosed, an accessibility statement that had
fallen behind four shipped features, and several gaps in the README and the public
site.

**Half 3 — Named Birds media matching (added at re-entry, after the live preview).**
The tab showed "No media matched to this bird." for every individual.
`computeNamedBirdMedia` read `[name:…]` tags from `caption` + `mediaNotes` only and
excluded `observationDetails` — but `computeNamedBirds` *discovers* an individual by
parsing that same `observationDetails` field, so the tag that creates a named bird
could never attribute its media. On the reporting user's export, all 15 assets were
tagged only there, with `caption` and `mediaNotes` empty on every one. Matching is
now a per-row **precedence**, and Half 1's audio height is only observable because of
it (zero matched assets meant zero audio tiles to look at).

### How to test

**Half 1 (needs an ML export with a `[name:…]`-tagged audio asset):**

1. `cd frontend && npm run dev`, open <http://localhost:5173>, go to **Named Birds**.
2. Expand a bird that has audio. The audio tile is now the same height as the photo
   and video tiles beside it, and the player's play button and scrubber are fully
   visible and clickable.
3. Narrow the window under 640px. The grid goes to one column and the audio tile is
   280px, still with the transport visible.
4. Disconnect the network and re-expand a row. The audio tile now shows "Media
   unavailable offline" with the "View on Macaulay Library" pill, matching photo and
   video, and the date, checklist link, and Macaulay link below the frame are
   unchanged. Reconnect: the player remounts and loads.
5. Settings → **Disable embedded media** on. Every tile is replaced by the single
   "Embedded media is disabled in Settings." note; no iframe is constructed.

**Half 2:**

6. Open **Help** (book icon in the header). The sidebar now lists 16 sections;
   **Calendar**, **Using SnowRaven offline**, and **Updating SnowRaven** are present
   and their jump links scroll to the right place.
7. Read any Help section. No stray `--` remains mid-sentence.
8. `grep -n -- '--' docs/HELP.md` returns only `Point Reyes NS--Bear Valley` (an
   eBird hotspot name; see below).

### Notes for reviewer

**The brief's `--` count was low.** It said 28 literal `--` in `docs/HELP.md`; there
were **50**. 48 were prose and got per-context punctuation (a period between
independent clauses, a comma for a light aside, a colon before a list or a
definition, parentheses for a true parenthetical), with the surrounding spaces
collapsed to match. One was `0--100%`, a numeric range, which became an **en dash**
(`0–100%`) — en dashes are explicitly out of scope for the no-em-dash convention.
One is deliberately **left alone**: `Point Reyes NS--Bear Valley` on line 271 is an
eBird hotspot name in a worked example. eBird's own naming convention uses `--` as
its separator, so it is data passthrough, which the convention excludes. No em
dashes were introduced; `docs/HELP.md` contains zero.

**Two call sites, and why `compact` is now required.** `NamedBirdMedia` reaches
`MediaFallback` by two independent paths — the offline placeholder it renders
directly, and the give-up/failed overlay `MediaFrame` renders internally — and
`MediaFrame` used to default `compact` to `format === 'Audio'` on its own. Fixing
only the first would have given the same audio tile a message when offline and no
message when the embed failed. Both now pass `compact={false}`.

The design refinement left removing that dead default to The Engineer. I removed it
and made `compact` **required**. It is behaviour-identical (both callers, and Species
Detail, already pass it explicitly), and it converts "the next caller silently
inherits a compact audio fallback at whatever height they picked" from a latent trap
into a compile error — a stronger lock than a test, and it composes with the tests
below. This touches `MediaEmbed.tsx`'s signature but none of its logic: the
non-destructive overlay contract, the give-up timer, the `onLoad`/`onError` latches,
the iframe's mount lifetime, and the `embedAllowed` gate are untouched.

**Height classes deliberately not collapsed.** `--photo`, `--video`, `--audio`, and
`--recent` are now all numerically equal, and are still four separate rules. The
v0.5.71 decision is that resilience *logic* is shared while display *height* stays a
per-caller choice; collapsing them would make any future per-format tune a
two-surface change. A test asserts the classes remain distinct.

**Tests are verified to fail on the bug.** Both new guards were checked against the
pre-fix code rather than assumed:
- Reverting the two CSS heights to 116/130 fails 3 assertions in
  `mediaFrameHeights.test.ts`.
- Restoring `MediaFrame`'s `compact` default and dropping the second call site's
  prop fails **only** the GIVE-UP test in `NamedBirdMedia.test.tsx` while the OFFLINE
  test still passes — i.e. it reproduces exactly the half-fix the design warned
  about.

**One finding was inaccurate, one is bigger than scoped.** The `--` count (28 vs 50)
is the inaccurate one. Separately, the README's **Multimedia** entry is also missing
its Unbounded toggle; the brief scoped that finding to Breeding Codes, so I fixed
Breeding Codes only and am flagging Multimedia rather than widening the sweep.

**`tsc` caught what vitest did not.** `within(el.closest('.sr-media-item')!)` type-checks
inline (the parameter's contextual type infers `HTMLElement`) but not when assigned
to a const first, where the generic defaults to `Element`. vitest was green;
`npm run build` failed. Fixed with an explicit `closest<HTMLElement>`.

**Screenshots are untouched.** `website/assets/shots/` is frozen at v0.5.23 and is
out of scope per the brief — regenerating needs the synthetic-demo-data and Playwright
toolchain in `website/tools/` against a running app.

**Half 3 is precedence, never a union.** Per media row: parse `caption` + `mediaNotes`
newline-joined; if that yields any name, those are the row's names and
`observationDetails` is not consulted for that row; only when it yields none does the
row fall back to `observationDetails`. The two sets are never merged, so a per-asset
caption *corrects* a broader observation tag rather than adding to it. Unchanged: the
`namedBirdKey(name, row.commonName)` bucketing, the per-bird catalogId dedupe, the
newest-first sort, and the function's purity. `observationDetails` was already parsed
into `MLExportRow` and already in `mlExportCache`, so this adds no network, no new
column, and no new parse.

The union variant was tested, not assumed: replacing the precedence with a merged set
fails exactly the three tests that assert override behaviour (caption wins over a
conflicting observation tag; mediaNotes alone outranks it; a captioned asset opts out
of its two-name observation) while the other 19 still pass.

**`mediaComments.ts` is untouched** (`git diff HEAD` is empty for it) and the two
modules are now deliberately divergent. That module *lists comments*, where the copied
observation text would repeat identically across every asset from one observation;
this one answers "which assets show this individual", for which a
species-and-checklist-scoped tag is a legitimate signal. `namedBirdMedia.ts`'s header
says so explicitly, so a later change does not quietly re-unify them.

### Verification

- `npm run build` (`tsc -b && vite build`) — passes.
- `npx vitest run` — **129 files, 1599 tests, all passing** (8 net new: 7 precedence
  cases plus the reversed observation-only case; the `namedBirdKey` parity guard is
  green and byte-identical).
- `npm run lint` — clean.
- `weft-design-lint check src/` — 22 findings, **all `note`, zero `warn`**, and none
  in any file this change touches. They are pre-existing: the `reduced-motion` notes
  are per-file and cannot see this app's global `prefers-reduced-motion` block in
  `globals.css`; the `untinted-black` notes in `AtlasLayer`/`CountyLayer` are the
  basemap-anchored boundary-line literals that `CLAUDE.md` documents as a deliberate
  exception; the `slow-motion` notes are map camera moves, not UI motion.
