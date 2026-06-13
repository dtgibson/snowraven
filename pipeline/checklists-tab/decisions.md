# Decisions — checklists-tab

## 2026-06-10 — Stage 4 (The Designer): cycling tri-state filter pills

**Decision:** Section 3's category filters use ONE pill per category that cycles
off → has → doesn't-have → off (label updates per state: "Media" → "Has media"
→ "No media"), instead of the Multimedia tab's paired "Has X"/"No X" pills.

**Why:** Nine filterable categories under the paired-pill idiom would mean ~18
pills plus All — unreadable. The cycling pill keeps one row per group and the
label always states its own condition. Visual states reuse the exact paired-pill
styling (accent positive, the existing negative tint), so it reads as the same
family. Approved with the design direction (user: "Looks great").

**Scope:** This tab only; no retrofit of Multimedia/Breeding Codes pills.

## 2026-06-10 — Stage 4: filters grouped in three labeled rows

Contains / Media type · Effort / Where & when — so the large control set reads
as labeled groups rather than a single pill wall. County/date keep the house
filter-strip + Clear behavior.

## 2026-06-10 — Stage 5 (The Engineer): span-based block stripping (user bug report)

**Decision:** `stripWeatherTideBlocks()` removes the SPAN from a block's
emoji header through the end of its attribution link — never whole lines.

**Why:** eBird's CSV export collapses a pasted block's line breaks into
spaces, so user prose shares one long line with the block and can continue
AFTER the attribution (the June 3 "scrub jays getting fed" comment). The
original line-based stripper ate any line containing the attribution. The
user specified the rule: "hide the block beginning with the weather
emoticons and ending with the attribution link, not other text before or
after."

**Fallback:** a comment whose block lost its attribution (a real export
case: the block ends at its last labeled value, e.g. `Sunset: …`, with the
user's trip report following) strips from the emoji header to the end of
the last labeled value, bounded at the next line break or 2+-space gap.

**Round 2 (same day, user-reported):** (a) the block header emoji match is
now ANY pictograph run, not just SnowRaven's condition set — RainCrow emits
moon-phase emoji (🌒/🌔) on night checklists; still safe because the anchor
is the last emoji run before the first labeled line. (b) A block with NO
emoji header absorbs its bare condition segment (a short "sky/clouds"
fragment) — one collapsed-line segment (2+-space/newline delimited) back
from the first label, only when ≤80 chars and not ending in sentence
punctuation, so a finished user sentence directly before the block
survives.

**Verified against the full real backup:** 308 block-bearing checklist
comments — 281 strip to empty, 27 keep exactly the user's text, 0 residue
leaks (the one heuristic flag was the user's own short prose containing the
word "sunset"). 0 block-bearing species comments. (Real ids/quotes redacted
from this artifact per the Stage 7 security review.)

## 2026-06-10 — Stage 7 (The Auditor): three fixes from the security review

1. **Strip made linear.** `stripWeatherTideBlocks` precomputes marker and
   emoji-run positions once and binary-searches them per attribution, and
   the attribution regex's `<a>` arms are length-bounded — hostile
   attribution-spam dropped from 4.1s @400KB (quadratic, main thread) to
   ~5ms @414KB.
2. **Shared-regex state bug.** The no-attribution fallback used `matchAll`
   on a module-level /g regex whose stale `lastIndex` carried over between
   calls (per ES spec, matchAll clones lastIndex), silently skipping
   markers so the toggle could leak block content order-dependently. All
   scans now reset state; regression test pins it.
3. **Double entity-decode.** The Checklists tab passes already-decoded text
   to the shared CommentText, which decoded again — display could differ
   from what the user wrote and from what search matches. CommentText now
   takes a `decoded` prop (linkify-only path); the comparer's raw/encoded
   path is unchanged.
