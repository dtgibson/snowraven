---
paths:
  - "frontend/src/lib/commentBlocks*.ts"
  - "frontend/src/lib/weatherBlockParse*.ts"
  - "frontend/src/lib/weatherStats*.ts"
  - "frontend/src/lib/weatherFormatter*"
  - "frontend/src/lib/tideFormatter*"
  - "frontend/src/lib/tide.ts"
  - "frontend/src/lib/tideInstant*.ts"
  - "frontend/src/lib/tidePlan.ts"
  - "frontend/src/lib/checklistsTab*.ts"
  - "frontend/src/lib/forecastSlice*.ts"
  - "frontend/src/lib/tauri/tideService.ts"
  - "frontend/src/lib/tauri/weatherService.ts"
  - "backend/formatters/**"
  - "backend/routers/weather.py"
  - "backend/routers/tide.py"
  - "backend/services/tide.py"
---

<!--
`lib/tidePlan.ts` and `lib/tideInstant*.ts` were added by the build after
v1.0.32, and the first of the two is a gap the v1.0.32 sweep left: that build
added `lib/tide.ts` because it computes the reading the formatter renders, while
`lib/tidePlan.ts` -- the twin of `backend/services/plan_tide.py`, whose document
is persisted to `replay.json` and re-rendered offline -- still matched no path,
so a change to it loaded neither this file's byte-golden parity rules nor its
marker vocabulary. `lib/tideInstant.ts` joins as the shared placement predicate
both halves of the tide subsystem now read a NOAA `t` through. The Python twins
(`backend/services/plan_tide.py`, `backend/services/tz_clock.py`,
`backend/services/tide_instant.py`) are covered by the `backend/services/**`
glob in `.claude/rules/security.md` but NOT by this file, whose backend entries
are named individually; that asymmetry is pre-existing and is left as it is
rather than widened in a bug-fix build.

The four entries added in v1.0.32 (`lib/tide.ts`, the two `lib/tauri` services,
`backend/services/tide.py`) follow the line this list already drew and had
applied on one side only. It gated `tideFormatter*` -- the module that RENDERS
the pasted block -- while `tide.ts`, which computes the reading the formatter
renders, and the two desktop services, which are the only producers of that
block on the majority platform, matched no path at all. So a change to what
lands in a user's public eBird checklist could be made with none of the marker
vocabulary or byte-golden parity rules loaded. The backend twin
(`backend/services/tide.py`) joins for the same reason `backend/routers/tide.py`
already had.
-->

# SnowRaven weather/tide comment-block conventions

Moved verbatim from CLAUDE.md (2026-08-26 context restructure). This file auto-loads when a session works on files matching the `paths` above; for related work that starts elsewhere, read it in full before changing anything it governs. Its rules carry the same force as CLAUDE.md.

- **`stripWeatherTideBlocks()` (`lib/commentBlocks.ts`) is the single source of truth for hiding pasted weather/tide blocks** (the Checklists tab's toggle). A block is a SPAN — emoji header → end of attribution link — never whole lines: eBird's CSV export collapses pasted newlines into spaces, so user prose shares the block's line and can continue after the attribution. While blocks are hidden, display AND search both use the stripped text ("search matches what you see"), and an empty-after-strip comment counts as having no comment; the has-weather/has-tide FILTER flags read the raw comment regardless. The marker vocabulary must stay synced with `weatherFormatter.ts`/`tideFormatter.ts` — the tests build fixtures by calling the real formatters so a format drift breaks them. When changing any of this, re-verify against a real export: the three shipped strip bugs (same-line prose, moon-emoji night blocks, attribution-less blocks) were all invisible to formatter-fixture tests and only surfaced on real data.
- **THERE IS NOW A READER, AND A READER IS A STRICTLY HARDER CONSUMER OF THAT VOCABULARY THAN A DETECTOR (v1.0.22).** `lib/weatherBlockParse.ts` reads a block back out of a comment — condition, day/night, temperature, wind, cloud cover, wind direction, humidity, dew point, sunrise, sunset — so a formatter drift that a detector would shrug off (a renamed label, a reordered header, a changed range separator, a dropped variation selector) silently turns a field NULL instead of failing loudly. It therefore **imports** the vocabulary rather than restating it: `CONDITION_EMOJI`, `BEAUFORT_WORDS` and `CARDINALS` are exported from `weatherFormatter.ts` for exactly this, and `weatherFormatter.test.ts` ties each of them to the real function by CALLING it across its whole output range, because declaring an array beside a function is not the same as tying them together. The moon set is eight literals in the parser (`MOON_NORTH`/`MOON_SOUTH` are two ORDERINGS of one set and what a reader needs is the set) and is asserted equal to their union, so a future ninth glyph reaches it. Change a formatter and you owe the parser's tests a look, not just the detectors'.
- **`stripWeatherTideBlocks` AND THE PARSER SHARE ONE SPAN FINDER, AND THERE MAY NEVER BE A SECOND (v1.0.22).** `findBlockSpans` in `commentBlocks.ts` returns every block's `{ start, end, kind }` as offsets into the DECODED comment; the strip builds its output from it and the parser reads its spans. Two consequences ride with it. The strip's output is pinned BYTE FOR BYTE by `commentBlocksStripGolden.test.ts` (257 cases: every synthetic shape plus 220 redacted real-export shapes), whose goldens were captured in their own commit BEFORE the extraction — a golden regenerated in the same commit as a refactor proves nothing, and the commit history is what makes that visible. And a COMBINED block is TWO spans, not one: `buildCombined` ends the tide body with the bare NOAA credit, which `ATTRIB_END_RE` matches, so the walk emits a `'tide'` span covering both bodies and a `'combined'` span covering only the trailing attribution. That is why `parseWeatherBlock` picks the first span that YIELDS A FIELD rather than the first whose `kind` says weather; a kind-based pick reads the attribution and nothing else, on every combined block ever written.
- **Generated night-block headers are condition emoji + moon-phase emoji, UNSPACED (`☁️🌗`, v0.5.28).** The stripper anchors a block on its LAST emoji run before the first labeled line, so any future header change that splits the emoji into separate runs (e.g. adding a space) will leak the leading emoji on strip — keep the header emoji one contiguous run. The moon emoji needs NO strip-marker vocabulary entry (`EMOJI_RUN_RE`'s `\p{Extended_Pictographic}` already covers it); don't add one.
- **The moon-phase algorithm is a hand-ported `lunarphase-js@2.0.3`** — pure-UTC Julian Day, a deliberate deviation from the library's runtime-tz-dependent form so both runtimes are deterministic and identical — **duplicated byte-for-byte in `frontend/src/lib/weatherFormatter.ts` and `backend/formatters/weather.py`.** Change it in BOTH ports plus the golden oracle (`frontend/src/lib/weatherFormatter.golden.py`) in the same change; the byte-golden tests lock the parity. It is NOT an npm/pip dependency — do not add the library.
