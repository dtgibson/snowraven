# Decisions — website-readme-copy-pass

This build ships published prose only: `website/index.html` and `README.md`
rewritten from scratch as one or two sentences per tab, two sentences added to
`docs/HELP.md`, one dead CSS block deleted, and six `*PublishedClaims.test.ts`
guard suites narrowed by measurement. No app code, no route, no dependency, no
CI change, no version bump.

Every decision below was taken by the user at a gate. The measurements were made
in this session against the working tree that was pushed.

---

## 1. Ship by pushing `main`, with no version bump and no release (2026-09-21)

**Decision:** push the commit to `main` and let the website redeploy. Do **not**
bump `frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, or the
website's version pill and footer; do not cut a tag and do not run `release.sh`.

**Why this does not violate CLAUDE.md's "always bump" rule.** That rule governs
user-facing features and fixes that change the shipped bundle. This change
produces a byte-identical app: the Tester measured the built CSS byte-identical
with and without the six test edits (same content hash `index-BsBeiN9K.css`, same
md5, twice), and the Auditor confirmed no non-test module under `frontend/src`
references `*PublishedClaims*`. `website/` is not a vite input. So the two
surfaces that changed are the public website and the GitHub front page, neither
of which is carried by the app bundle, and the precedent is the dev-only
carve-out already recorded in `DECISIONS.md` (the `undici` dev-dependency patch
and the Node-25 release-tooling fix, both "no version bump").

**What the three workflows do with this push, verified by reading them rather
than assumed:** `pages.yml` fires on a push to `main` touching `website/**` and
redeploys the site; `pipeline.yml` fires on every push to `main` and runs the
tests; `windows-build.yml` fires on `v*` **tags only**, and this change creates
no tag. Website redeploys, tests run, no release starts.

**The version pill stays at v1.0.32 deliberately, and that is the correct
state.** CLAUDE.md's four-file parity guard asserts the website version against
`frontend/package.json`; both read 1.0.32, so touching the pill here would have
*broken* parity rather than maintained it. The pill moves at the next version
bump, in that bump's own commit.

### 1a. The two HELP sentences ride 1.0.33, and that is the decision, not an oversight

`docs/HELP.md` is compiled into the in-app Help, so the two sentences added here
do **not** reach any user until the next version ships. They are:

- Species Detail → the Weather bullet: *"It has no picker of its own: you are
  already looking at a bird, so the card describes the one the page has
  selected."*
- Settings → Tab Layout: *"Which shape you get is decided from the space actually
  available to the app, never from what kind of device it is running on."*

Both exist because this pass retired a published claim from the website or README
and the brief requires every cut to **move rather than die**. Between this push
and 1.0.33 the facts live only in the repository, which is a gap of days and is
accepted: neither sentence warns about anything, corrects a falsehood, or
describes a risk. They add precision to behaviour that already works the way they
describe. A cut that had removed a *warning* would not have been allowed to wait
this way.

**Consequence to carry to the next release:** 1.0.33's changelog entry covers
these two HELP additions even though they were written in a commit that predates
the bump, because that release is the first build in which any user can read
them.

---

## 2. F1 (Low) fixed with the user's approved wording (2026-09-21)

**The finding.** Both rewritten surfaces carried "your eBird backup, Macaulay
Library export and API keys **stay on your device** unless you turn on iCloud
syncing", having retired the transmission clause each surface paired it with at
HEAD (`website/index.html:132-133`, `README.md:36`). Keys *are* sent to eBird and
OpenWeather to authenticate the user's own lookups, so the unqualified verb
overclaimed.

**Decision:** change "stay on your device" to **"are stored only on your
device"** in that one sentence on both surfaces. Nothing else in the sentence
changes.

**Why this wording rather than restoring the retired clause.** It adopts
`PRIVACY_POLICY.md:13`'s own formulation, which is deliberately narrower than the
retired copy: keys are *stored* only on the device and are never uploaded to the
developer or to any service the developer runs. Naming **storage** makes the
claim exactly true without re-opening the register the whole pass exists to set —
restoring the transmission clause would have put a data-flow explanation back
into a privacy band whose approved shape is two sentences and a link. The
transmission fact is not lost: it remains published in `PRIVACY_POLICY.md`
§Connections (`:29-37`), in `website/privacy.html`, and in the live App Store
listing (`appstore/LISTING.md:75`), all of which the band links to or mirrors.

**Applied at exactly two sites**, `website/index.html:127` and `README.md:55`,
each a one-line diff verified against a pre-edit copy. The same phrase elsewhere
in the repo was deliberately left alone, because it is making a different claim
in each case: `PRIVACY_POLICY.md:41` and `website/privacy.html:151` (a user's
*coordinates* stay on the device), `appstore/LISTING.md:75` (files and settings),
and the two literals in `icloudKeysPublishedClaims.test.ts` (`:91`, `:214`),
which are a byte-exact assertion **about the App Store listing** and a negative
leg against a stale version of it.

**The guards accept the new phrase, verified rather than trusted.** The Auditor
predicted this; it was measured. `STAYS_LOCAL`
(`icloudKeysPublishedClaims.test.ts:66`) is an alternation already carrying
`only on your device`, so the new sentence satisfies it through a different
branch than the old one did. With the edit applied, the six suites run
**6 files, 162 tests, all passing** — the same count the Tester recorded — and
`npm run typecheck`, `npm run lint` and `npm run build` each exit 0.

---

## 3. F3 accepted: the `npm audit --omit=dev` note stays retired (2026-09-21)

**The finding (Informational).** HEAD's README told a self-hoster that the npm
vulnerability summary printed by `./update.sh` "comes from build-only tooling
that never ships; a production-scoped `npm audit --omit=dev` reports zero." The
rewrite retired it, and the fact now survives only in
`.claude/rules/testing.md:130` (maintainer-facing) and historical changelog
entries. The Auditor left it **open pending an explicit accept or a one-sentence
HELP addition**; the Tester had flagged it as the one cut still wanting an
explicit yes.

**Decision: accepted as a cut. The user approved the README without it, and that
approval is the decision.** This is recorded as a decision and not as a gap,
which is the point of writing it down: a retired line with no sentence beside it
is indistinguishable from a line nobody noticed, and this repo already enforces
that distinction one layer up (a rolled-up App Store version and a silently
skipped one leave identical evidence, so the written sentence is what separates
them).

**What is being accepted, stated honestly.** This removes security *context*, not
a security *warning*. The residual risk is a false alarm in one direction only: a
self-hoster may read a benign dev-dependency audit line as an app vulnerability.
Nobody is left believing something unsafe is safe.

**Reversal condition:** if a self-hoster asks about that summary, the repair is
one sentence in `docs/HELP.md` under Updating — the delegation target, not the
README, so the register set by this pass holds.

---

## 4. F5 fixed: the per-run ignore patterns now match at any depth (2026-09-21)

**The finding (Informational).** `pipeline/.gitignore`'s five per-run patterns are
written `*/handoff.md`, `*/how-to-see.md`, and so on. A pattern containing a slash
is anchored to the file's own directory and `*` does not cross a separator, so
they ignore `pipeline/<run>/qa-report.md` and **not**
`pipeline/<run>/<subdir>/qa-report.md`. The nested
`superseded-pass3/how-to-see.md` was therefore committable to a public repository.
Content was inspected and is clean — the only network strings are the placeholder
`https://<machine>.<tailnet>.ts.net:8793` and loopback — so there was no exposure
in this change set.

**Decision:** add `**/`-prefixed twins of all five patterns, keeping the existing
lines and the user's own entries untouched. Also add `*/superseded-*/` and
`*/proposed/`, so the set-aside drafts and the staged copies stay out of the
tracked tree: **the live files are the record now**, and those directories are
reference only. They remain on disk.

**Verified in both directions with `git check-ignore -v`, because an ignore rule
that is too broad fails silently in the more expensive direction.** Ignored:
`qa-report.md`, `security-report.md`, `how-to-see.md`, `deployment-record.md`,
both `superseded-pass*/` trees, and `proposed/`. Still committable: all eight
durable docs (`change-brief.md`, `slop-inventory.md`, `design-refinement.md`,
`design.html`, `decisions.md`, `pr-description.md`, `proposed-copy-review.md`,
`guard-edits.md`).

**Why the fix is worth making on a run that had no exposure:** the gap publishes
silently, and the next run to nest a per-run file containing a real hostname
would not find out. The general shape is the one CLAUDE.md already records for
rule `paths` frontmatter — a pattern that stops matching the file it governs is
indistinguishable from a pattern that was never there.

---

## 5. Two standing rules for these surfaces (2026-09-21)

Both are user direction, established across three passes of this build. Recorded
here for promotion into `DECISIONS.md` and, if the Chronicler judges it, into
`.claude/rules/docs-and-website.md`, whose `paths` already gate on
`website/**` and `README.md`.

### 5a. Every change to `website/` or `README.md` is shown to the user and approved before it is written

Structure first, then copy. **Corrections are included** — a one-word fix to an
already-approved sentence is still a change to a published surface and is shown
before it lands. The F1 repair in §2 was handled this way: the Auditor proposed
the remediation, the user approved the exact replacement phrase, and only then
was a byte written.

The mechanism this defends against is recorded in the brief and is structural
rather than a matter of care: `.claude/rules/docs-and-website.md` requires every
feature change to update `README.md` and `website/` in the same change, so each
build appends to the same paragraphs and nothing ever re-reads the document whole
for register. That is how the README went from a user-directed 891 words at
v1.0.10 (`git show v1.0.10:README.md`, verified exactly 891) to 2,043 at
`d3c71d1`, and how weather arrived as three separate top-level bullets, one of
them named after nothing on screen. **Trimming an appended document preserves its
shape**, which is why two trim passes were set aside and this one was written
from scratch.

### 5b. The copy register for both surfaces

One or two sentences per tab section. Each says **what that part does and who it
is for**, and nothing else:

- **No operating detail.** No settings mechanism, no control-by-control walk, no
  button, switch or keyboard key. That depth is `docs/HELP.md`'s job, and these
  surfaces delegate to it rather than restating it.
- **No reassurance.** No claim whose negation would be absurd; nothing that only
  lands for a reader who has already used the app.
- **No "you already have".** Do not write copy that presumes what the reader is
  carrying.
- **No offline mention.** Offline is unmentioned on both surfaces. It loses no
  fact: HELP keeps `## Using SnowRaven offline`, and
  `icloudKeysPublishedClaims` still asserts a HELP offline claim. The guards
  carry a **negative leg** against a returning Search or Offline section, and the
  Tester proved it fires by mutation.
- **Privacy as a posture**, not a data-flow explanation: private by default, in
  the user's own control, policy linked.
- Two standing constraints from earlier decisions hold: publish the **property,
  never the count** (v1.0.16 — the features heading is "What each tab does", not
  "Ten tools"), and no em dash (U+2014) in user-facing copy.

---

## 6. Approval was obtained over the tailnet, on the real files (2026-09-21)

The r6 preview method is how the user approved this copy, and it is the method to
reuse for these surfaces. `website/` was served on loopback
(`python3 -m http.server 8791 --bind 127.0.0.1`) and exposed to the user's own
devices with `tailscale serve --https=8791`, under a fresh port — never 443,
which is already in use on that machine — and never a `file://` or `localhost`
link. The README was reviewed as rendered Markdown. Each pass was served under
its own versioned path so the user could compare passes rather than trust a
description of the difference.

**What the method buys, and it is the same thing the live-preview rule buys for
the app:** the user read the actual page, in both themes and at phone width,
rather than approving a diff. The site and the rendered README are what a
prospective user meets, and neither is measurable from a fixture.
