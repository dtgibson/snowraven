# Held copy: Splits and lumps (README, website, App Store "What's New")

## APPROVED by the user, 2026-09-30 (supersedes the proposals below)

Shown as a tailnet review page (README rendered, the website served with the
change applied, the What's New line in full). The user rejected the appended
third sentence as too long, then a version that foregrounded splits and lumps
("do not emphasize splits and lumps just because it is new ... work it in
organically"), and said "option 1 please" to this one.

**README.md `### Species Detail` paragraph AND `website/index.html` Species
Detail row `<p>` (identical text; replace the whole paragraph, keep the
website's line wrapping style):**

> Your whole history with one bird: sightings, field notes, breeding codes, a
> map of every observation and any splits or lumps along the way. A weather card
> shows the skies and temperatures you found it in, from SnowRaven and RainCrow
> weather blocks.

(248 characters against 240 before; splits and lumps is one item in the list,
not its own sentence; "you have found this bird in, drawn from the same"
shortened to "you found it in, from".)

**App Store "What's New" line for the 1.0.41 record: approved as proposed in
section 2 below**, unchanged.

**PRIVACY_POLICY.md:** no change.

---

**Original status:** HELD. Nothing below has been written. `README.md`, `website/` (apart
from the version-stamp step on the pill and footer), `appstore/` and
`PRIVACY_POLICY.md` are unchanged by this build. Per CLAUDE.md, this lands only
after you read it and say yes, shown as the rendered README, the served website
page and the App Store text in full.

`PRIVACY_POLICY.md` needs no change: the feature adds no request, no endpoint, no
host and no stored document (schema.md section 8).

## 1. README and website: one proposed sentence for Species Detail

It is appended as the section's third sentence. The section is at two sentences
today, so this takes it to three, the ceiling the register allows for one tab.

> For a species eBird has split or lumped, it shows what the bird was, what it
> became, and which of your reports eBird reassigned.

### Where it goes

The same paragraph on both surfaces: the Species Detail section's body.

- `README.md`, `### Species Detail`, the paragraph under the heading.
- `website/index.html`, the Species Detail feature row
  (`<!-- 4. Species Detail: reverse -->`), the `<p>` under `<h3>Species Detail</h3>`.

### Before and after

**Before (both surfaces today):**

> Your whole history with one bird: sightings, field notes, breeding codes and a
> map of every observation. A weather card shows the skies and temperatures you
> have found this bird in, drawn from the same SnowRaven and RainCrow weather
> blocks.

**After:**

> Your whole history with one bird: sightings, field notes, breeding codes and a
> map of every observation. A weather card shows the skies and temperatures you
> have found this bird in, drawn from the same SnowRaven and RainCrow weather
> blocks. For a species eBird has split or lumped, it shows what the bird was,
> what it became, and which of your reports eBird reassigned.

### Why this wording

- Says what a birder gets, in the register: no control names, no operating
  detail, no offline or "no key" claim, no years (coverage is stated in the app,
  and a year in published prose goes stale at the annual refresh).
- "which of your reports eBird reassigned" is the part eBird's own export never
  shows, and it credits eBird with the change rather than implying SnowRaven
  corrected anything.
- No em dash; American spelling.

## 2. App Store "What's New" line (for the 1.0.41 record)

> Species Detail now shows, for any species eBird has split or lumped, what it
> was, what it became, and how many of your reports eBird reassigned in each
> update.

It follows the existing What's New register (one sentence per change, the tab
named first). If 1.0.41 is rolled into a later version, this line travels with
it.
