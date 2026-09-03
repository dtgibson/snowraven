# Change Brief — website-acknowledgements-tone

## What is changing
Three copy trims on the two published surfaces that are not in the app bundle, plus one
stale version string in the same file. On the website: the closing CTA paragraph loses its
last sentence, which narrates what the app's own Acknowledgments panel says and names its
two credits; the Offline section loses the "It is honest about the edges" lead-in, keeping
the facts after it. In the README: the Settings bullet keeps "an Acknowledgments section"
and drops the enumeration of who it credits. The pattern removed is a sentence whose
subject is our own on-screen copy rather than the app's behavior. Also in
`website/index.html`, the version pill and footer move from 1.0.13 to 1.0.14 to match
`frontend/package.json`. Files: `website/index.html` (48, 456, 591, 625), `README.md` (21).

## Why now
The user's own read of the site: the acknowledgements copy is over-written, and telling a
reader what a different screen already tells them is not useful. Naming the credits in
three places also means a future third acknowledgee needs three edits; after this trim the
Settings panel is the only place the names live, which is where the v1.0.10 decision put
the authority for them. The version-pill fix rides along because
`icloudKeysPublishedClaims.test.ts:184` is red on `main` right now over that exact string,
and this change is already editing that file.

## User-facing impact
None in the app. The published website and README get shorter. The credits themselves are
untouched and still render in Settings on every platform; nothing is being un-credited,
only un-repeated. The website version pill starts telling the truth.

## Design pass
Not needed. No visual change. The closing CTA paragraph goes from four sentences to three
and the Offline paragraph loses four words; both stay ordinary body paragraphs in their
existing sections, with no change to hierarchy, spacing, type, color, motion or layout. No
block, heading, card or button is removed.

## Decisions touched
`DECISIONS.md` v1.0.10 ("The Settings tab closes on its quietest register"), confirmed
rather than reversed. The in-app section, its two entries and their wording are the user's
call and stay untouched. `docs/HELP.md` is deliberately excluded: that decision states
HELP.md "remains the untouched full documentation" and that exhaustive detail belongs
there, so its Acknowledgments entry keeps the credit text, and the exclusion also keeps
this change out of the shipped bundle. The README trim applies that same entry's copy
posture (lead with what the thing does, leave detail to HELP.md).

## What done looks like
No sentence on the website's closing or Offline paragraphs describes what another screen
says, and the README bullet names the section without naming its credits.
`icloudKeysPublishedClaims.test.ts` goes green, the em-dash sweep and both published-claims
parity suites stay green, and no link target moves. No version bump, CHANGELOG entry or
release: the app bundle is byte-identical, matching the `f02b063` docs-only precedent.
