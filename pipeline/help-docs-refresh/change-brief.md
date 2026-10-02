# Change Brief: Help Docs Refresh

## What is changing
Bring `docs/HELP.md` up to date with what has shipped through 1.0.45. It is both the in-app Help
and the online documentation the website footer links to on GitHub. The work:
- add iPhone and iPad where general statements name only desktop and web/Pi;
- fix wrong labels and behavior, and document controls Help never covered;
- rewrite release-note phrasing as present behavior, and fix British spellings;
- put the tab sections in the app's default tab order.
Drift in `ACCESSIBILITY.md` and `PRIVACY_POLICY.md` goes into a held patch and is never written.
The exact worklist is `pipeline/help-docs-refresh/audit.md` (sections A to H).

## Why now
The user's request: "Website and readme are now good; let's ensure snowraven's detailed
documentation is fully up to date in app and online." Fifteen releases since 1.0.30 added to
the file a passage at a time. The audit found:
- lists that predate Targets, the widgets and Alerts;
- labels that drifted ("Fetch hotspots", "Merge subspecies", "Install update");
- a Settings walkthrough missing a section, and tab sections out of the app's order.

## User-facing impact
The in-app Help and the GitHub-hosted Help change. No app behavior, UI text or layout changes.
The website, the README and the App Store listing are not touched. `ACCESSIBILITY.md`,
`PRIVACY_POLICY.md` and `website/privacy.html` change only if the user approves the held patch
(audit section H).

## Design pass
Not needed. No visual change: Help renders through the existing `HelpDocs.tsx` unchanged. The
only code edits are the TOC array's order (plus two optional sub-entries), a count-free
comment, and guard-test rows.

## Decisions touched
- DECISIONS 2026-09-21 (website-readme-copy-pass): the register this run follows. It also let
  HELP sentences ride the next release only if they correct no falsehood.
- DECISIONS 2026-06-02 (v0.5.6), "In-app Help is bundled": in-app fixes reach users only with a
  release, so this run needs the release call below.
- DECISIONS v0.5.75 (`helpToc.test.ts` parity): extended here with a tab-order row.
- 1.0.32 settings-section-order: Help's Settings walkthrough is brought into that order.
- CLAUDE.md, 2026-09-21/27/28: privacy and accessibility text changes only on the user's yes.
- No decision is reversed. Nothing on record set Help's section order.

## Version and release
Recommendation: no version bump in this run.
- The online Help updates as soon as this run lands on `main`.
- The in-app Help rides the next release: the pending Spool bundle (`weft-spool/20261002-160902`),
  which needs its own bump anyway. The Engineer drafts its owed CHANGELOG line in
  `pipeline/help-docs-refresh/changelog-line.md`.
- A separate 1.0.46 would trigger the full all-platform release and an App Store decision about
  record `73b6e8ac`, which is still in review.
Confirm at the deploy gate: this run corrects several low-harm falsehoods (labels, the update
flow, platform lists) and retires no warning.

## What done looks like
- Every item in audit sections A to E is fixed, or marked won't-fix with a reason.
- Paragraphs F1 and F2 are untouched.
- Tab sections and the TOC follow `DEFAULT_TAB_ORDER`, guarded by a new `helpToc.test.ts` row.
- The audit's two label greps come back clean.
- No em dash and no British spelling remains in HELP.
- The full frontend suite and `npm run build` pass, every `*PublishedClaims*` suite included.
- `held-patch.md` holds exact before and after text for H-P1 to H-P3 and H-A1 to H-A5, ready
  for the user.
