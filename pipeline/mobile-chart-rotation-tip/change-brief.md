# Change Brief — Mobile Chart Rotation Tip

## What is changing
The two chart-bearing tabs — Statistics and Species Detail — gain a small,
dismissible tip shown only on mobile, in the areas where charts can render
pinched or compressed. It suggests two options, neutrally: rotate the device
to landscape for a wider view, or view charts in the desktop app. It is a tip
the user acts on however they like; the app does not steer or nag. It shows
once per page, and dismissing it hides it permanently for that page.

## Why now
User request following the 1.0.0 mobile release: recharts-backed charts
(Statistics' stat sections, Species Detail's sightings graph) compress on
narrow portrait phones. A one-time hint lets people discover the wider
options without changing the charts themselves.

## User-facing impact
A new one-time tip on phone-width viewports on Statistics and Species Detail.
Desktop and tablet widths never show it. After dismissal (persisted, per
page), nothing anywhere changes. Charts, data, and layout are untouched.

## Design pass
Needed. The tip is a visible element placed on two existing surfaces —
placement relative to the chart areas, copy, and the dismiss affordance all
need design, and the user asked to review the design before it is built.

## Decisions touched
None reversed. Applies standing precedents: the WelcomeScreen `welcomeSeen`
pattern (dismissal persisted via the storage seam, never localStorage on
desktop); the 640px phone boundary; `var(--sr-*)` tokens in both themes;
WCAG 2.1 AA at 320px and 200% text scale; no em dashes in user-facing copy;
docs rule (HELP.md, README, website updated in the same change).

## Scope amendment (user-directed, mid-Engineer)
The user pulled the escapee-count defect surfaced during live preview INTO this
release so tip and fix ship together in v1.0.1. Two repairs: (1) the Statistics
taxonomy batch now also sends each form name's normalized parent, so a species
recorded only as a "(Domestic type)" form resolves a species code and enters
the escapee cover (it previously classified 'unknown' and silently counted,
reading "zero escapees"); (2) a consulted checklist whose ledger entry stands
for a RECORDLESS cover species is re-consulted once (pure helper
`carriersNeedingRefetch` + an explicit `refetch` intent at the cache
chokepoint), so every store poisoned by the broken pass heals itself on the
next Statistics visit.

## What done looks like
On a phone-width view, the first visit to Statistics and to Species Detail
each shows the tip once; Dismiss removes it immediately and it never returns,
across relaunches, on both transports. Wider viewports never render it. The
dismiss control has an accessible name, AA contrast, and a 24px target.
Suite, typecheck, and build stay green; version bump + changelog + docs ride
the same change.
