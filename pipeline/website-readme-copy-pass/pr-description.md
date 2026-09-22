## website-readme-copy-pass

### What this does

Rewrites the two prospective-user surfaces, `website/index.html` and `README.md`, from
scratch, in one register: each of the ten tabs gets a section, named from `TAB_LABELS` and
sequenced in `DEFAULT_TAB_ORDER`, of one or two short sentences saying what that part of
the app is and what a birder gets from it, then stops. No controls, thresholds, in-app
labels, inventories, reassurance about what the app does not do, or "so you can" closers. Search, Offline, Settings, Navigation and Desktop window leave both
surfaces (HELP carries them); privacy is stated once per surface as a posture with the
policy linked; provider attribution does not move. The website's Species Detail Weather
card paragraph moves from the Statistics article to the Species Detail article, the
alternation becomes a clean parity, the dead `.named*` stylesheet block goes, and two
sentences join `docs/HELP.md` so that the two facts a reader could only learn from the
retired copy (the card has no picker; the navigation shape follows the space available,
not a device check) are still published somewhere. The six `*PublishedClaims` guards are
narrowed to hold the new copy at claim level on the decision surfaces while keeping every
byte-exact row on HELP.

### How to test

The copy, the stylesheet deletion, the two HELP sentences and the six guard edits are
applied to the working tree (uncommitted). Measured on the live tree after applying:

1. `cd frontend && npx vitest run src/lib/palettePublishedClaims.test.ts src/lib/namedBirdTimelinePublishedClaims.test.ts src/lib/projectsPublishedClaims.test.ts src/lib/icloudKeysPublishedClaims.test.ts src/lib/weatherStatsPublishedClaims.test.ts src/lib/weatherTidePlanPublishedClaims.test.ts`
   expects 6 files passed: 161 rows, plus one more on a machine that still holds the
   gitignored `pipeline/icloud-api-key-sync/how-to-see.md` (its em-dash row is skipped
   where the file is absent, so CI sees 161).
2. Full frontend suite (`npx vitest run` in `frontend/`): 352 files passed, 2 skipped; 7,263
   tests passed, 3 skipped. `npm run typecheck` and `npm run lint`: clean.
3. Serve `website/` and read the features section top to bottom: ten articles, Weather first
   and Named Birds last, media right on odd rows and left on even rows, nine hairlines, every
   screenshot where it was. No Search or Offline article.
4. `grep -c 'v1.0.32' website/index.html` is 2 and `grep -c 'aria-label="Version 1.0.32"' website/index.html` is 1.
5. `grep -c $'\xe2\x80\x94' README.md website/index.html docs/HELP.md` (the em dash, U+2014, as bytes) is 0 for all three; `grep -nE '\bPredict\b|Get forecast' README.md website/index.html` finds nothing.
6. `diff <(grep -o 'href="[^"]*"\|src="[^"]*"' <(git show HEAD:website/index.html) | sort) <(grep -o 'href="[^"]*"\|src="[^"]*"' website/index.html | sort)` is empty: every link and asset reference is unchanged as a multiset.
7. `git diff --word-diff -U0 -- docs/HELP.md` shows exactly the two added sentences and nothing else.
8. Before push: `npm run build` and `eslint .` again, per `.claude/rules/testing.md`.

### Notes for reviewer

- **One commit carries four things and they only pass together:** the two copy files, the
  stylesheet deletion, the two HELP sentences, and the six guard edits. Applying the guards
  without the copy leaves 36 rows red; applying the copy without the guards leaves 52 rows
  red and one suite failing to load. All four are now in the working tree together.
- **One post-approval fix, by user direction:** "weather" is lowercase and unbolded where it
  is prose rather than the tab's name ("A weather section reads back ...", "A weather card
  shows ..."), on both surfaces. The `<h3>Weather</h3>` heading, "Weather/tide Planner",
  the attribution line and the OpenWeather bullet are unchanged. The only guard touched for
  it is `weatherStatsPublishedClaims`'s website anchor, now `A weather section reads back`.
- **Source sweep for quotes of retired sentences** (`frontend/src/`, `.claude/rules/`):
  nothing found that presents a retired website or README sentence as still published.
  Two near-hits examined and left: `storage.ts`'s "Offline support" section comments name
  the feature, not the retired article; `TabNav.tsx`'s header records that a struck claim
  once "reached `docs/HELP.md` and `README.md` before it was caught", which is history.
- **Bundle check after the last guard edit:** app CSS still byte-identical with and
  without the six test files.
- **QA attempt 1, three sentence corrections on both surfaces, no guard moved:** the
  Weather lookup sentence no longer implies past conditions for an arbitrary place and
  time (Plan is forward-only, `/weather/at` is forecast-only): "look up the conditions where
  you are now, or the forecast for any place and time ahead", with the Planner laying out
  "the coming sunrises and sunsets"; the Statistics weather sentence scopes itself to "the
  conditions on the outings you wrote a block for", the section's own population rather
  than "the conditions you bird in"; Calendar's body now matches its screenshot's alt text,
  "shaded by how many species you saw" (species is the default metric). README's
  Attribution sentence is lowercase "weather lookup" for consistency, content unchanged.
- **Guard edits follow the two-tier rule.** HELP keeps every byte-exact assertion. Where a
  decision surface still makes a claim, it is asserted at claim level and the two surfaces
  are compared against each other. Where a surface no longer makes a claim (offline, the
  Planner's "stops where the forecast stops", the Days in view control, the arrow-keys
  readouts, the county-parity sentence, the card's two-wholes mechanics), the row reads
  HELP only and a comment at the row records that as the decision surfaces leaving the
  roster, not as a loosening. No existence leg was removed; no length floor was lowered.
- **Four narrowings worth a second look**, each turning a named mechanism or a promise
  into the posture the user asked for: `icloudKeysPublishedClaims` no longer requires
  README and the website to name the `Sync API keys` switch, requiring instead one
  sentence carrying API keys, iCloud, the opt-in ("unless you turn on") and "your own
  iCloud account and nowhere else"; `projectsPublishedClaims` no longer requires the two
  surfaces to make the county-parity claim, only that any such sentence be conditioned if
  it returns; `namedBirdTimelinePublishedClaims` no longer requires the two surfaces to
  describe the span figure, the Measure-to switch, the arrow keys or the strip's purpose;
  and the two "never predicts or ranks" / "ranks and recommends nothing" promises are
  HELP-only, with the decision surfaces keeping only the negative leg (no "best
  conditions", no "you should").
- **Negative legs are new.** `palettePublishedClaims` fails if a Search or Offline section
  heading, or the word offline, returns to either surface. This is the guard against the
  append-log re-forming through `.claude/rules/docs-and-website.md`'s "update README and
  the website in the same change" rule.
- **Two new HELP rows are red against HEAD's HELP by design** (`weatherStats`: no picker;
  `palette`: the navigation sentence) and go green with the two sentences applied.
- **Mutation matrix:** 52 mutations, 51 caught. The one survivor is the version pill text
  changed alone, which the pre-existing whole-file `toContain` version row cannot see
  (known, on the ROADMAP, untouched here).
- **Bundle check:** the app CSS is byte-identical with and without the six test edits
  (Tailwind scans `frontend/` test files for class candidates).
- **The design-refinement's Content Notes assumed the byte-pinned Planner block would stay
  verbatim on the website, in a second paragraph of row 1.** It does not: the user's
  register (no offline, no "stops where the forecast stops", no control layout, no keyboard
  behaviour, no promises) and the two-tier guard rule supersede that note. With nothing
  pinned there is no reason to split row 1, so every feature row is one paragraph; the
  Planner is still located by its first occurrence in the file, and a new guard row asserts
  the name occurs once and after the Weather heading. Rows 2 and 4 are one paragraph each
  for the same reason, which is also what keeps the 200-character floors on the Statistics
  and Species Detail passages honest rather than lowered.
- **Version bump:** unresolved and belongs to the deploy stage. The website is not in the
  app bundle; `README.md` and `docs/HELP.md` are (HELP via the `?raw` import), so whether
  the two HELP sentences and the README rewrite warrant a patch bump under CLAUDE.md's
  "dev-only change" exemption is the deploy stage's call. Nothing here bumps a version or
  touches `CHANGELOG.md`.
- Files: `website/index.html`, `website/styles.css`, `README.md`, `docs/HELP.md`,
  `frontend/src/lib/{palette,namedBirdTimeline,projects,icloudKeys,weatherStats,weatherTidePlan}PublishedClaims.test.ts`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
