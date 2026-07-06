# Change Brief — Sex Terminology (Statistics Media card)

## What is changing
Replace the user-facing word "Gender" with "Sex" everywhere it labels the
male/female/unknown breakdown of bird media. This is display copy only. The
only affected component is the Statistics → Media card
(`MediaStatsSections.tsx`): the "Photos Tagged With Age or **Gender**" section
label, the sex donut's `title="Gender"`, the "…and **gender** for {n}…" note,
and a matching code comment. Its test's assertion string updates in lockstep.
Docs/site that echo the label update too: `README.md`, `docs/HELP.md`,
`website/index.html`, and the `PRODUCT_CONTEXT.md` record (which describes the
section by its current display name). The data model already uses "sex" —
variables are `sexMix` / `sexedInd` / `parseAgeSex`, the type is `Sex`, and the
parser reads the eBird/ML "Age/**Sex**" field — so ONLY the visible strings say
"gender". Nothing in parsing, aggregation, tokens, or filters changes.

## Why now
eBird/Macaulay export names the field "Sex," so "sex" is the correct,
source-aligned term. The v0.5.22 rename to "Gender" (see DECISIONS.md) was a
display-only choice the user is now reversing to match the data. User flagged
the Statistics / photo-media stats specifically.

## User-facing impact
The Media card section heading reads "Photos Tagged With Age or Sex," the
donut is titled "Sex," and its note reads "…and sex for N…". No layout, color,
data, or behavior change. Colors already come from `--sr-sex-*` tokens.

## Decisions touched
- **DECISIONS.md v0.5.22** ("renamed Age & sex → 'Photos Tagged With Age or
  Gender'"): this run reverses the *display* word "Gender" → "Sex". The
  historical entry itself is NOT edited (dated record); The Chronicler logs the
  reversal at closeout. No new design space opens — the internal names were
  always "sex," so there is nothing to migrate.

## What done looks like
- App-wide grep for user-facing "gender" (case-insensitive) over `frontend/src`
  + `README.md` + `docs/HELP.md` + `website/index.html` + `PRODUCT_CONTEXT.md`
  returns zero hits; only dated history (CHANGELOG/DECISIONS/old bug-brief)
  retains the word.
- `MediaStatsSections.test.tsx` asserts the new "…Age or Sex" string and passes;
  `npm run build` + vitest green.
- Version bumped to 0.5.65 in `frontend/package.json` + `src-tauri/tauri.conf.json`;
  CHANGELOG entry added; website version pill/footer at 0.5.65.
