# Implementation decisions — Settings section order

## 1. The move is a pure block move, proved rather than eyeballed

The reorder was applied by extracting the six JSX blocks at their exact line
boundaries and reassembling them, then verifying with a multiset comparison of
the old and new file contents that **zero** content lines were added or removed
on either side. The same check on `docs/HELP.md` came back with an empty diff in
both directions and an identical line count, so that file is a pure reorder with
no prose touched at all.

This matters because a reorder is exactly the kind of change where a hand-edit
drops or duplicates a line inside a 57-line block and nothing catches it: the
build stays green, the guards stay green, and one control quietly disappears.
The multiset check is what turns "I moved the blocks" into a measurement.

## 2. A new order guard was added, rather than widening either existing one

The brief requires `Settings.icloud.test.tsx` and `SettingsAcknowledgments.test.tsx`
to pass **unmodified**, and they do. But neither states the property this change
establishes:

- The iCloud guard asserts `Default Files < iCloud Sync < Default Location`.
  After this reorder, Help & Documentation, Appearance and Sharing all sit
  between iCloud Sync and Default Location, and the chain is still satisfied.
  The sentence `docs/HELP.md` publishes is "an iCloud Sync section sits
  **directly** below Default Files", which is strictly stronger and which the
  `<` chain does not pin.
- The Acknowledgments guard asserts it is the panel's last element child.

Nothing asserted that API Keys is first. So the reorder would have had no guard
of its own, in a repo whose standing convention is that a structural property
gets a guard test. `frontend/src/components/settingsSectionOrder.test.tsx` pins
the full header sequence on all three platform shapes (web/Pi, Windows desktop,
Mac/iOS), which makes the iCloud adjacency an assertion rather than an
implication.

A new file was chosen over rows appended to either existing guard so that
"passed unmodified" stays literally true of both, and so the file is named after
the property it protects, matching `settingsSharing.test.tsx` and
`SettingsAcknowledgments.test.tsx`.

**The guard was mutation-checked in the only direction that counts**: run against
the pre-reorder `Settings.tsx` restored from `HEAD`, all four of its tests fail
with the old sequence named in the assertion output. A guard for an ordering
property that has never been shown red against the previous order is not
evidence of anything.

### How the guard finds the headers

Section headers are the only spans in `Settings.tsx` carrying the inline
uppercase + `0.07em` letter-spacing signature — the shared `SectionHeader` plus
the three inline copies of it (Tab Layout, Default Location, Troubleshooting) —
so one selector finds all of them regardless of which component drew them. Four
call sites were enumerated to confirm the selector has no false positives.

The failure mode is stated in the file: if a future header stops matching, the
list goes **short** rather than wrong, and the explicit full-sequence assertions
turn red on the length. The alternative considered and rejected was the
`querySelectorAll('span:not(.sr-only)')` + `indexOf` approach the iCloud guard
uses, which sweeps in every non-header span in the panel and can only express
relative order, not adjacency.

## 3. Two code comments changed; nothing else non-move

**A new comment at the head of the panel** records the order, why the pair leads,
and the spacing argument (every block is a self-contained unit ending in a 24px
bottom margin; the panel has no first-child styling). jsdom has no layout engine,
so the spacing claim cannot be a test — it is an argument, and it belongs where
the next person reordering something will read it.

**The iCloud Sync comment's closing line was restated.** It read "No section
below it moves", which was a note about the build that *introduced* that section
— true then, and after this change a sentence that describes nothing. It now
names what the placement actually rests on: the published `docs/HELP.md`
sentence and the `Settings.icloud.test.tsx` chain. This follows the repo's
standing rule that a claim which reached published prose from the source is
swept starting at the source.

The new comment avoids the em dash. The no-em-dash rule is scoped to user-facing
copy and published prose, and JSX comments render nothing, so this is belt and
braces rather than a requirement — but `SettingsAcknowledgments.test.tsx` and
`settingsSharing.test.tsx` both scan rendered output for U+2014, and keeping the
character out of the file entirely costs nothing.

## 4. Nothing was restyled

The brief's instruction was explicit: if a seam shifts, that is a finding, not a
licence to restyle. Every block's own margins were checked before the move —
Help & Documentation, Appearance, Sharing and iCloud Sync each end in a card with
`marginBottom: 24`; API Keys and Default Files each end in a trailing `<p>` with
`marginBottom: 24`; Default Location, Tab Layout, Troubleshooting and
Acknowledgments each open with their own `marginTop: 24` wrapper or sit flush.
The two new adjacencies (Sharing → Default Location, and Default Files/iCloud
Sync → Help & Documentation) are both a 24px bottom margin meeting a
zero-top-margin header, which is what every seam already was. Nothing was
adjusted, and there is nothing outstanding here.

## 5. `README.md` and `website/index.html` deliberately untouched

`.claude/rules/docs-and-website.md` requires `docs/HELP.md`, `README.md` and
`website/` to move together for a feature or behavior change. This is neither: no
behavior changes, and neither README nor the website makes an ordering claim
about Settings. README's Settings line is a feature list that already leads with
keys, so it agrees with the new screen rather than contradicting it.

Swept for order-dependent prose ("above", "below", "first section", "last
section", "at the top", "further down") across `docs/HELP.md`, `README.md`,
`website/index.html`, `PRIVACY_POLICY.md` and `ACCESSIBILITY.md`. Eight sentences
matched, all inside the Settings section of `docs/HELP.md`, and every one is
still true after the move:

- API Keys → "a **Sync API keys** switch in the iCloud Sync section (below)" —
  iCloud Sync is still below API Keys.
- iCloud Sync → "an iCloud Sync section sits directly below Default Files" —
  true on the screen and now true in the document too.
- iCloud Sync → "exactly as described under Default Files above" — Default Files
  is still above it.
- Acknowledgments → "The last section of the Settings tab" — unchanged.

The in-app Help TOC needed no edit: `HelpDocs.tsx`'s `TOC` array carries no
Settings sub-entries, and `helpToc.test.ts` asserts `##` section order (unchanged)
and sub-entry *containment*, not `###` order.

## 6. No version bump, per the Spool bundle instruction

`frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md` and
`website/index.html` are untouched, so the four-file parity guard in
`icloudKeysPublishedClaims.test.ts` stays green at the current version (verified).
The changelog line this change deserves is in `pr-description.md` under
`### Changelog line`, for the bundle's release step to collect. This overrides
CLAUDE.md's "always bump" rule for this run only; the brief's release-parity note
is a flush-time concern.
