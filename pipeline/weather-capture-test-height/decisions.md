# Decisions: weather-capture-test-height

Fix lane, Stage 2 (The Engineer). One test row in
`website/tools/weather-capture.test.mjs`. No app, asset, `website/index.html`,
README, App Store, privacy or changelog edit.

## 1. The size is derived from both sides, never typed in

The row was named "the published Weather asset and its scoped markup agree on
1080x2021" and held the size as four literals: `metadata.width === 1080`,
`metadata.height === 2021`, and a markup match on `width="1080" height="2021"`.
The approved 1.0.33 reframe (`bbb2c6b`, website-screenshot-sizing) recaptured
the shot at 16:9 and updated `website/index.html` and `capture.mjs` with it. The
literals stayed behind, so the row went red on an asset and a declaration that
agreed with each other.

The row now reads the asset's real size with sharp and compares it to the
`width` and `height` the figure's `<img>` declares in `website/index.html`. That
is CLAUDE.md's guard rule (5) from the v1.0.33 bundle: compare two declarations
of one number to each other, never restate the literal. The width is derived
too. It was not stale, but it was the same kind of literal, and an approved
recapture at another width would have stranded it the same way.

What the row still pins, because it is structure rather than a number:

- the Weather figure exists (`data-shot="weather"`), so a renamed or deleted
  figure fails rather than passing over nothing;
- its `<img>` points at `assets/shots/weather.webp`, the file the row reads and
  the file `process-img.mjs` writes, so the two sides are about the same image;
- the declared width and height are positive integers, and sharp read a real
  size, so a missing attribute or an unreadable file fails with its own message
  rather than through a `NaN` comparison.

The test name no longer encodes a size: "the published Weather asset and its
scoped markup declare the same size".

## 2. The alt is checked for presence, not wording

The old fourth assertion matched "formatted weather summary and a tide block".
The reframed shot no longer pictures the tide, and the user approved the new alt
at the 1.0.33 sign-off for exactly that reason (DECISIONS.md, v1.0.33, "the
Weather figure's `alt`, which had to change because the reframed shot no longer
pictures the tide block").

Considered: keeping a phrase from the current alt ("The Weather tab's output").
Rejected. The alt is approved published copy, governed by the copy-approval rule
at the top of CLAUDE.md, not by a test. A phrase pinned here is one more copy of
that prose, and it goes stale unseen the next time the user approves new words,
which is what "a tide block" did. Because CI does not run this file (section 5),
a stale phrase would sit red unnoticed again.

Chosen: the row asks only that the figure's `<img>` carries a non-empty alt.
No approved wording can turn that red, and a deleted or emptied alt still does.

**Correction to the hand-off.** The Stage 2 instruction said
`frontend/src/lib/websiteFigureDimensions.test.ts` already pins "the alt and
size agreement". It pins size agreement (and the 16:9 aspect) for every figure,
and nothing about alt. No suite in the repo pins the Weather alt's wording, and
the test comment says so ("Neither suite pins the alt's wording").

## 3. A defect in the first draft of the alt check, found by mutation

The first draft matched `/\balt="[^"]*\S[^"]*"/` in place. The "alt emptied"
mutation stayed GREEN: `\S` also matches the closing quote, so `alt=""` followed
by `loading="lazy"` satisfies the pattern by running into the next attribute.
The row now captures the value (`/\balt="([^"]*)"/`) and tests the captured
string after `trim()`. A comment at the assertion says why, so the in-place form
is not restored as a tidy-up.

## 4. Why the row overlaps the frontend suite, and why that is kept

`websiteFigureDimensions.test.ts` holds every figure's declared size to its file
in CI, parsing WebP headers in pure JS. This row reads the same claim for the
Weather figure through sharp, the library that writes the asset. Two
independent parsers over one claim: a defect in either one's header reading
shows up as a disagreement. It also stays beside the capture code it belongs to.
The test comment states the overlap and calls this row the sharp-side
independent read.

## 5. Why this sat red for 12 days, and what is out of scope

`.github/workflows/pipeline.yml` installs `website/tools` (`npm ci`) and the
Chromium and WebKit browsers, then runs only `npm run verify` (the real-engine
harnesses under `verify/`). It never runs `npm test`
(`node --test weather-capture.test.mjs capture-marks.test.mjs`). So the row went
red at `bbb2c6b` on 2026-09-21 and nothing in CI could notice. It became KNOWN
only when `pipeline/baseline-failures.json` started covering `website/tools` on
2026-09-29.

**Out of scope: wiring `npm test` into `pipeline.yml`.** `capture-marks.test.mjs`
drives Playwright Chromium in one row ("in a real engine: both src paths are
substituted with no request, ...") and has never run on Ubuntu. How it behaves
there has not been measured. The job already installs Chromium, so the step
itself is cheap, but turning on an unmeasured suite in the gate is a separate
change with its own measurement. Flagged for the Chronicler as a follow-up, not
done here.

## 6. Release posture

Dev-only. The shipped app is byte-identical, so there is no version bump, no
CHANGELOG.md line and no tag (CLAUDE.md, Versioning, the dev-only rule).

The file sits under `website/**`, so a push to `main` redeploys GitHub Pages,
and everything under `website/tools/` is published by that deploy
(`.claude/rules/testing.md`, v1.0.46). The site's visible content
(`index.html`, `styles.css`, the assets) does not change. The new comments carry
no credential, local path or internal host.

## 7. Verification

- `cd website/tools && npm test`: exit 0, 13 tests, 13 pass, 0 fail (before the
  fix: exit 1, 12 pass, 1 fail, `606 !== 2021` at line 200).
- `cd frontend && npx vitest run src/lib/websiteFigureDimensions.test.ts`:
  exit 0, 6 of 6.
- Red-first mutation table, run on a scratch mirror of `website/` (the test
  file, `weather-capture.mjs`, `capture.mjs`, `capture-lib.mjs`, `index.html`,
  `weather.webp`, `map.webp`, with `node_modules` symlinked). Each case rebuilt
  the mirror from the real files, checked that its pattern matched exactly once
  and changed the file, then ran the row alone. The real `website/index.html`
  and `website/assets/shots/weather.webp` were hashed before and after and did
  not move. 13 of 13 as expected:

  | Case | Expected | Got |
  |---|---|---|
  | control: unmutated mirror | green | green |
  | markup height 606 to 607 | red | red |
  | markup width 1080 to 1079 | red | red |
  | markup height back to the stale 2021 | red | red |
  | asset resized to 1080x608, markup unchanged | red | red |
  | asset and markup moved together to 1000x561 (an approved recapture) | green | green |
  | figure not found (`data-shot` renamed) | red | red |
  | `height` attribute removed | red | red |
  | figure points at `map.webp` instead | red | red |
  | alt emptied | red | red (green on the first draft, section 3) |
  | alt whitespace only | red | red |
  | alt attribute removed | red | red |
  | alt reworded to a different sentence | green | green |

  The two green-expected rows are the point of the fix: an asset and markup that
  move together, and a reworded alt, both stay green.
