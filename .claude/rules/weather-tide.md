---
paths:
  - "frontend/src/lib/commentBlocks*.ts"
  - "frontend/src/lib/weatherFormatter*"
  - "frontend/src/lib/tideFormatter*"
  - "frontend/src/lib/checklistsTab*.ts"
  - "frontend/src/lib/forecastSlice*.ts"
  - "backend/formatters/**"
  - "backend/routers/weather.py"
  - "backend/routers/tide.py"
---

# SnowRaven weather/tide comment-block conventions

Moved verbatim from CLAUDE.md (2026-08-26 context restructure). This file auto-loads when a session works on files matching the `paths` above; for related work that starts elsewhere, read it in full before changing anything it governs. Its rules carry the same force as CLAUDE.md.

- **`stripWeatherTideBlocks()` (`lib/commentBlocks.ts`) is the single source of truth for hiding pasted weather/tide blocks** (the Checklists tab's toggle). A block is a SPAN — emoji header → end of attribution link — never whole lines: eBird's CSV export collapses pasted newlines into spaces, so user prose shares the block's line and can continue after the attribution. While blocks are hidden, display AND search both use the stripped text ("search matches what you see"), and an empty-after-strip comment counts as having no comment; the has-weather/has-tide FILTER flags read the raw comment regardless. The marker vocabulary must stay synced with `weatherFormatter.ts`/`tideFormatter.ts` — the tests build fixtures by calling the real formatters so a format drift breaks them. When changing any of this, re-verify against a real export: the three shipped strip bugs (same-line prose, moon-emoji night blocks, attribution-less blocks) were all invisible to formatter-fixture tests and only surfaced on real data.
- **Generated night-block headers are condition emoji + moon-phase emoji, UNSPACED (`☁️🌗`, v0.5.28).** The stripper anchors a block on its LAST emoji run before the first labeled line, so any future header change that splits the emoji into separate runs (e.g. adding a space) will leak the leading emoji on strip — keep the header emoji one contiguous run. The moon emoji needs NO strip-marker vocabulary entry (`EMOJI_RUN_RE`'s `\p{Extended_Pictographic}` already covers it); don't add one.
- **The moon-phase algorithm is a hand-ported `lunarphase-js@2.0.3`** — pure-UTC Julian Day, a deliberate deviation from the library's runtime-tz-dependent form so both runtimes are deterministic and identical — **duplicated byte-for-byte in `frontend/src/lib/weatherFormatter.ts` and `backend/formatters/weather.py`.** Change it in BOTH ports plus the golden oracle (`frontend/src/lib/weatherFormatter.golden.py`) in the same change; the byte-golden tests lock the parity. It is NOT an npm/pip dependency — do not add the library.
