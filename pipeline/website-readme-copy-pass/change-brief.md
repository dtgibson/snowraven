# Change Brief — website-readme-copy-pass

**Revised at Stage 1 (pass 3). Supersedes the trim-based brief entirely.** The approved parts
carry forward and are not re-opened; what changed is the method and the design-pass decision.

## What is changing

New copy written **from scratch** for the two prospective-user surfaces, `website/index.html`
and the repo-root `README.md`. Two passes of progressively harder trimming (46% off the README,
36% off the site; `proposed-copy-review.md`, `guard-edits.md`) are set aside; `superseded-pass2/`
is reference only and the five test files are reverted to HEAD. Both surfaces re-organize around
what the app does, one section per thing: the ten tabs `TAB_LABELS` names (Weather, Species
Detail, Statistics, Calendar, Map Explorer, Multimedia, Breeding Codes, Named Birds, Checklists,
List Comparer), plus Settings and the app-wide Search. Offline is unmentioned on both. Privacy
keeps its basic posture with the policy linked. `docs/HELP.md` keeps the depth and is untouched
but for the one drafted sentence below; `website/privacy.html` is a delegation target, not a
rewrite target. The measured guard constraint is in `slop-inventory.md` beside this brief.

## Why now

The user's direction after two trims, plus a measured regression against a posture this repo set
deliberately. DECISIONS.md v1.0.10 (`fc068f8`) recorded a user-directed shortening to 891 README
words and a durable rule: lead with what the thing does for the reader, leave exhaustive detail
to HELP.md. Verified: `git show v1.0.10:README.md` is exactly 891 words; `README.md` at `d3c71d1`
is 2,043. The cause is structural, not carelessness: `.claude/rules/docs-and-website.md` requires
every feature change to update `README.md` and `website/` in the same change, so each build
appends to the same paragraphs and nothing ever re-reads the document whole for register. Weather
arrived as three separate top-level bullets that way, one of them (`- **Weather on the bird's own
page**`) not the name of anything on screen. Trimming an appended document preserves its shape,
which is why this pass writes rather than cuts, and why the Chronicler records the mechanism.

## User-facing impact

Nothing in the app changes: no behaviour, no label, no screen. The two surfaces a prospective
reader meets are rewritten and re-sequenced. Offline being unmentioned loses no fact: HELP keeps
`## Using SnowRaven offline`, and `icloudKeysPublishedClaims` still asserts a HELP offline claim.
The standing risk is unchanged: anything a reader learns only from these surfaces must be
confirmed present in `docs/HELP.md` or the privacy policy **per cut**, never assumed. Two
measured candidates for "moves rather than dies": the "no picker" fact, already drafted for HELP
at `proposed/HELP-species-detail-weather.md`; and README's `- **Navigation that fits the
window**`, where HELP has no navigation section and covers the three nav densities only
incidentally inside `## Search` (lines 26 and 46). Provider attribution does not move. Privacy
and user control stay stated plainly on both surfaces; every kept claim is re-checked true.

## Design pass

**Needed.** Chosen by the user at a gate, and it is exactly the reversal condition this brief's
first version named: retiring the whole `Offline support` article re-sequences the `reverse`
alternation and the `.feature-row + .feature-row` border rhythm, and frees a figure. Surfaces:
the features section of `website/index.html` (today 12 `feature-row` articles, 8 screenshots and
4 `feature-mock` figures, with the alternation already broken twice — Calendar and Map Explorer
both `reverse`, List Comparer and Search both not); the freed no-signal mock; and a Settings
section, which the page has never carried. What should feel better: a reader meets one section
per thing the app does, in an order that reads as a tour rather than as an append log, with
alternation and dividers sequencing cleanly for the first time. The Designer settles which
sections exist, what pairs with which figure, and what becomes of the freed mock — not the copy.

## Decisions touched

- **v1.0.10, "published copy gains a stated posture"** — re-applied, not reversed; the 891-word
  figure is historical. Record why a trim did not hold: the per-feature append.
- **v1.0.20, "a published mock is a behavioural claim"** — touched, not avoided. Retiring the
  offline mock retires a published behavioural claim: a decision, not a trim; any mock kept or
  re-purposed is re-derived through the real code, never eyeballed.
- **v1.0.16, "publish the PROPERTY, never the COUNT"** — the features `<h2>` says "Ten tools"
  over 12 articles; the new one must not re-introduce a count.
- **v1.0.15, behaviour not the app's own on-screen copy** (plus its drop-the-wind-up note) — the
  register this pass writes in.
- Nothing reversed, no brand voice set from scratch (`docs-and-website.md` §Voice, v1.0.10).

## What done looks like

- **User approval precedes any byte written to `website/` or `README.md`**, structure first.
- **The register applies without me:** each section says what that part does and who it helps. No
  settings mechanism, no control-by-control detail, no claim whose negation is absurd, nothing
  that only lands for a reader who has used the app, no restatement of HELP's depth. Privacy:
  private by default, in the user's own control, policy linked.
- Full suite green on a guard-edit set **re-derived by measurement from zero**; the offline cut's
  own measured cost and the two-tier repair rule are in `slop-inventory.md` §Pass 3.
- Every cut confirmed in HELP or the policy or named as a decision; every kept claim true against
  the code; zero em dashes; no standalone `Predict`, no `Get forecast`, no published count;
  paragraph-scope sweep including source; version sites by grep; links unchanged as a multiset.
