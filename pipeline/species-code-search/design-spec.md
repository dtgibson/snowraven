# Design Spec: Species Code Search

**Feature:** species-code-search
**Stage:** 4, The Designer (approved by the user, 2026-10-10: "looks good")
**Mockup:** `pipeline/species-code-search/design.html` (the approved direction; served for review at the tailnet preview on port 8990)
**Design system:** `pipeline/design-system.md`, unchanged. No evolution requested, no deviation made.

## Visual Direction

Nothing visual changes. Search and the species pickers keep their shipped look, rows, sizes, tokens, truncation and motion, in both themes, at every width and text scale. The design is entirely the **result order**: a bird whose code you typed is listed first, and everything else follows exactly as it does today. Quiet utility, the app's register: the feature should feel like the list simply knew what you meant, with no badge, label or hint announcing how.

## Screens / Views

The design applies to the five surfaces that use the shared matcher, named as the app names them (`TAB_LABELS`). The mockup shows the first three live; the other two are the same shared picker and behave identically.

### Search (Cmd-K / Ctrl-K)

- **Order:** Destinations first, filtered by their labels exactly as today and never capped. Then Species: **rows whose code you typed first, then every other name or scientific-name match**, each group in Search's existing alphabetical order (`compareSpeciesName`, unchanged).
- **Cap:** `SPECIES_CAP` (50) applies **after** ranking. Code matches are never pushed off the list by name matches; they are cut only if code matches alone exceed the cap. The existing cap line ("Showing the first 50 matches. Keep typing to narrow them.") appears exactly when the ranked list was cut.
- **Enter with nothing highlighted:** the first row, as today. That is a destination when any destination matches (a query like `list` or `weat`), otherwise the first species row, which is the first code match when there is one.
- **Approved examples on the mockup's list:** `yrwa` gives Yellow-rumped Warbler, then (Audubon's), then (Myrtle); `amro` gives American Robin; `cago` gives Cackling Goose, then Canada Goose; `nosh` gives Northern Shoveler, then Northern Shrike; `trsw` gives Tree Swallow, then Trumpeter Swan; `gbhe` gives Great Blue Heron only; `snow` gives Snowy Owl, then Snow Bunting, Snow Goose, Snowy Egret, Snowy Plover; `wren` gives Wrentit, then every other match alphabetically (the wrens, and Lawrence's Goldfinch); `dove` gives Dovekie, then the doves.
- **Codes that match nothing now** (eBird takes them from a bird's other names): `goos` (Goosander), `cost` (Common Starling), `rodo` (Rock Dove) behave as ordinary name queries, exactly as today.

### Species Detail: Select species

- Options arrive in taxonomic order with forms folded into their species ("Show subspecies" off, the default). The picker has no "All species" row.
- **Order:** code matches first, then name matches, each group in the order the options were handed in (taxonomic). `goos` stays today's taxonomic list of geese.
- **Enter with nothing highlighted:** the first species row, which is the first code match when there is one.
- **Forms folded in:** a folded species row carries only its own entry's codes. `yrwa` finds Yellow-rumped Warbler; `mywa` (the Myrtle form's code) and `auwa` (the Audubon's form's code) find nothing here, because no listed row carries them. With "Show subspecies" on, the forms are listed and each matches its own codes. This is the PRD's OQ-08 default and is approved as shown.

### Calendar: species filter

- Options arrive A to Z with forms folded into their species, names only (no scientific names in this list), with the italic "All species" row always first and never filtered out.
- **Order:** "All species", then code matches, then name matches, each group in the handed-in order.
- **Enter with nothing highlighted:** the first species row after "All species", which is the first code match when there is one. Enter never resets to "All species" on a typed query (unchanged behaviour).
- Folded forms behave as on Species Detail: `mywa` and `auwa` find no species row.

### Map Explorer: Species filter (My Sightings), and Statistics: Filter by species (Weather section)

- The same shared picker, so the same rule: "All species" first where the call site passes one, then code matches, then name matches, in the order the call site hands in. A form is found by its own code only where the form is listed.
- The four picker call sites get no code-specific wiring (FR-20). A future picker built on the shared component inherits all of this.

### Surfaces deliberately unchanged

The Map Explorer's Media Targets target-species box, the Checklists comment search, the Targets County picker and the Named Birds tick list do not use the shared matcher and behave exactly as today (FR-21).

## Component Usage

- `components/CommandPalette.tsx` and `components/SpeciesCombobox.tsx`: **no visual change.** Same row markup (`.sr-palette-row` with name and muted scientific name; the picker row's check slot, name and 40%-capped scientific name), same active-row treatment (`--sr-accent-bg-hover` fill plus 2px inset accent outline), same empty states ("Nothing matches that search." in Search, "No species match this search." in a picker), same group headings, cap line and key legend.
- No new component, row, badge, icon, label, tooltip, live region or announcement. No "matched by code" marker of any kind (FR-22).
- The only change a viewer can see is which rows are listed and in what order.

## Design Tokens Applied

None added, none changed. Rows keep `--sr-text`, `--sr-text-muted`, `--sr-surface`, `--sr-surface-subtle` (hover), `--sr-accent-bg-hover` and `--sr-accent` (active), `--sr-accent-bg` (the selected picker row), `--sr-border-subtle` (cap-line rule), in both themes, exactly as shipped.

## Interaction Notes

### The ranking rule (approved: codes first)

1. Normalize the query once per keystroke, exactly as today (trim, lowercase).
2. A row **matches by code** when the normalized query equals one of the row's codes in full, ignoring case. No prefix or partial code match (`yr` and `yrw` do not match YRWA). A query with interior whitespace never matches a code.
3. A row **matches by name** exactly as today (common or scientific name contains the query). This half of the predicate does not change.
4. Rows that match by code come first; rows that match by name only follow. A row that matches both ways is listed once, in the code group. Within each group the surface keeps its own order (Search: `compareSpeciesName`; a picker: the order it was handed).
5. For any query that is not a code of a listed row, every surface shows the same rows in the same order as today, with the same cap line, highlight behaviour and Enter target (FR-18).

### The code rule (approved: "just use American spellings and variants")

A row's codes are, from eBird's taxonomy entry for that row's own name:

- **all of its `bandingCodes`** (the North American banding codes), plus
- **only those `comNameCodes` that are formed from the name SnowRaven shows** (the bird's own eBird common name) under the standard four-letter rule. Codes eBird lists from a bird's other names (British names, older names, alternative names) are left out.

The rule that forms a code from a name, as approved (reference: `rule()` / `am_codes()` in this session's `scratchpad/american_only.py`; the Engineer re-implements it in the generator and pins it with tests):

- Remove any parenthetical, then apostrophes (straight and curly).
- Split into words on whitespace, hyphens and slashes; keep letters only (A to Z and accented Latin letters).
- One word: its first four letters. Two words: two letters of each. Three words: the first letter of the first two words, then two letters of the third. Four or more words: the first letter of each of the first four.
- Uppercase the result. A `comNameCodes` entry is kept only when it equals this code or one of its two kinds of variant below.
- **Variants of the shown name are kept (orchestrator defaults after the user's "spellings and variants", decisions.md 3 and 4):** a code formed under another accepted hyphen convention (the hyphenated group noun as one word, Common Wood-Pigeon COWO; or two letters of the first word and the initials of a hyphenated second, COWP, Spotted Whistling-Duck SPWD), and a code formed from the name with its accents removed (Rüppell's Bustard keeps RUBU beside RÜBU). The precise, testable rule, with its pinned cases, is schema.md 5.2; a form's qualifier never forms a code, and a slash or hybrid forms its code from its whole displayed name (decisions.md 5, 6).

**Forms keep their own codes the same way.** Because the parenthetical is removed before the code is formed, a form keeps its own banding code and the code formed from its species' name: Yellow-rumped Warbler (Myrtle) carries MYWA and YRWA; (Audubon's) carries AUWA and YRWA; the species carries YRWA only. So `yrwa` lists the species and its forms, `mywa` finds the Myrtle form, `auwa` finds the Audubon's form.

**Where the rule applies:** at generation time, in `scripts/build-ebird-taxonomy.mjs`, so the committed asset holds only the codes that match. The app's matcher does no filtering of its own and stays as the schema describes (exact equality of the whole code, one lookup per keystroke).

**Measured over eBird's taxonomy (version 2027, the snapshot's revision), 2026-10-10, with the final rule (variants included; re-derived by the Architect, schema.md 2.7):**
- Every one of the 11,167 species still carries at least one code (the PRD's FR-04(b) guard still holds).
- Entries carrying a code: 15,471 of 17,891 (was 17,193 under the union). Distinct codes: 8,951 (was 10,277). Every code is 2 to 4 characters; the short ones are still OU, EMU, KEA, TUI and MAO. The most-shared code is RECR, on 30 entries (was ISTH, on 54). Without the two variants the same taxonomy gives 15,441 entries and 8,237 codes, the figures this spec first carried; the Architect's implementation reproduces them exactly.
- Codes with a non-A-to-Z letter: 13 remain (`BÖBE`, `BÖFL`, `FÜBO`, `FÜLO`, `LÜBU`, `RÜBU`, `RÜCH`, `RÜGR`, `RÜPA`, `RÜRC`, `RÜST`, `RÜWA`, `RÜWE`). FR-04(c)'s closed alphabet (A to Z, Ö, Ü, NFC) still admits exactly these.

### Picker and Search behaviour that does not change

- Highlight and arrows: clamped, never wrapped; a query change resets the highlight, as today.
- Picker focus selects the input's text, as today. Escape closes only an open listbox.
- **Code data arriving while open** (FR-25): rows update for the current query without retyping. If the rows change and a species row is highlighted, the highlight is cleared so it never moves to a different bird on its own; a highlighted destination or "All species" row keeps its highlight; if the rows do not change, nothing changes.

### Never wait, and failure

- Opening Search or a picker never waits for the code data. Destinations and name matches render at once; before the code data arrives, every surface shows exactly today's list (shown on the mockup with "Code data: Not loaded yet").
- Loading starts no later than the first Search open or the first picker opening in a session, at most once, shared by every surface.
- If the code data fails to load, every surface matches names exactly as today, with no message, alert, announcement or error state, and no retry in that session.

### Accessibility

Unchanged by construction. No new control, row, label, live region or announcement. Option ids stay keyed on index, so `aria-activedescendant` always resolves. Rows truncate at 320 px and 200% in-app text exactly as they do today (both spans truncate; the scientific name is capped at 40% of the row); this feature neither improves nor worsens that. WCAG 2.1 AA holds because nothing visual moves. Search and picker rows keep plain-text names under the standing form-control exclusion (no `<BirdName>` inside `role="option"`).

## Motion Spec

This feature adds no motion. The result list re-ranks in the same frame as the keystroke, with no reorder animation, by design: a list that animated its reorder would read as a visible "matched by code" signal and would delay the row Enter is about to open. Existing motion is unchanged and listed only for completeness:

- Search panel open: `cubic-bezier(0.2, 0, 0, 1)`, 140ms, transform-origin top center, scaleY 0.98 to 1 with fade; reduced motion: none; CSS (shipped).
- Search scrim: ease-out, 160ms fade; reduced motion: none; CSS (shipped).
- Picker listbox open: `cubic-bezier(0.2, 0, 0, 1)`, 140ms, transform-origin top center (from the input), scaleY 0.96 to 1 with fade; close is instant; reduced motion: instant; CSS (shipped).
- Row hover: ease-out, 120ms background; active row: no transition, so an arrow key moves the highlight in the same frame; reduced motion: instant; CSS (shipped).

## Content Notes

**No new in-app strings.** Every visible string on these surfaces is unchanged.

**`docs/HELP.md`** (written without a stop, per CLAUDE.md; FR-28 to FR-30), revised for the approved code rule:

- Say **"code"** in user-facing text, never "alpha code", "banding code list", "speciesCode" or "taxon code". "Alpha code" is the internal module name only.
- Describe what a user may type in terms of the approved rule, as a property: a bird's four-letter **banding code**, or the **code formed from its name** as SnowRaven shows it. Do **not** say that every code eBird publishes works, and do not describe eBird's common-name codes as a whole: codes from other names (Goosander, Common Starling, Rock Dove, Green-backed Heron) deliberately match nothing.
- Say that a code shared by several of your birds lists all of them, and that birds matching a typed code come first, the rest following alphabetically by common name (Search) or in the list's usual order (pickers). Replace the unqualified "listed alphabetically by common name" sentence.
- Say that a form's own code finds the form where forms are listed (Search, and Species Detail with Show subspecies on); do not promise it on the Calendar.
- **Examples:** use ones that survive the rule and re-derive through the shipped asset (FR-30): `yrwa` (Yellow-rumped Warbler), `amro` (American Robin), `cago` (Canada Goose and Cackling Goose), `nosh` (Northern Shoveler and Northern Shrike). **Do not** use `goos`, `cost`, `rodo` or `mywa` (as the species) as examples, or `gbhe` as an example of a shared code.
- State the cap as a property, never its number. No em dashes (U+2014). American spelling. Surfaces named from `TAB_LABELS` (Species Detail, Calendar, Map Explorer, Statistics), never from component names.

## Carried into the build: approved PRD and schema items this design changes

The code rule above narrows FR-01 (the asset holds `bandingCodes` plus only the `comNameCodes` formed from the shown name, not their union) and Key Decision 1 of the brief. These success-metric rows and schema statements change with it, and the Engineer and Tester work from the new values:

| Item | Was | Now (measured) |
|---|---|---|
| FR-01, schema 4.2 | union of `bandingCodes` and `comNameCodes` | `bandingCodes` plus only the `comNameCodes` equal to the code formed from the entry's own common name (rule above) |
| QA-04 `cago` | Cackling Goose, Cackling/Canada Goose, Canada Goose | Cackling Goose, Canada Goose (the slash keeps only CCGO, its banding code) |
| QA-07 `gbhe` | Great Blue Heron, then Green Heron | Great Blue Heron only |
| QA-09 | `rodo` gives Rock Pigeon; `mywa` gives the species and every form | `rodo` matches nothing (name query, today's result); `mywa` gives the Myrtle form only |
| QA-10 `auwa` | (Audubon's) and (West Mexico) | (Audubon's) only; (West Mexico) keeps YRWA only |
| QA-11 `yrwa` | species and all three forms | unchanged: species and all three forms |
| QA-13, brief consequence 4(b) | the hybrid leads `yrwa` | `Cape May x Yellow-rumped Warbler (hybrid)` now carries no code, so it matches by name only and the consequence no longer arises |
| QA-16 `goos` | Common Merganser first | matches nothing by code; exactly today's rows (Canada Goose, Snow Goose) |
| QA-42 | YRWA and MYWA on Yellow-rumped Warbler; RUBU and RÜBU on Rüppell's Bustard | YRWA only on the species (MYWA on the Myrtle form); Rüppell's Bustard keeps RUBU and RÜBU (the accent-free twin is kept as a variant, decisions.md 4; RUKO and RÜKO, from another name, drop). CAGO on Canada Goose and Cackling Goose and Common Ostrich `[COOS]` hold. |
| Schema 2.2 / 4.3 counts and size | 17,193 entries with codes, 10,277 codes, ISTH on 54 | 15,471 entries, 8,951 codes, RECR on 30 (with the hyphen and accent variants; 15,441 and 8,237 without them); the asset is 588,825 bytes raw and 142,625 gzip, 70% of the 200 KiB budget |

**Resolved after this stage (orchestrator default, decisions.md 4): both spellings are kept**, so `rübu` and `rubu` both find Rüppell's Bustard, and the same holds for the other ten species (the list below names nine of them and omits Fülleborn's Longclaw) and two Fülleborn's Boubou forms. The paragraph as first written follows. **One consequence for the user to confirm (default: accept).** The rule keeps accented names' own letters, so 11 species (Rüppell's Bustard, Griffon, Parrot, Warbler, Starling, Chat and Weaver; Lühder's Bushshrike; Fülleborn's Boubou; Böhm's Flycatcher) keep only their accented code: `rübu` finds Rüppell's Bustard and `rubu` no longer does. These are Old World birds a North American list rarely holds. The alternative is to form the code from the name with accents removed, which would keep `RUBU` and drop `RÜBU`. This is a one-line change in the rule, and the PRD's OQ-01 guard is unaffected either way.
