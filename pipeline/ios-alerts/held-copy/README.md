# ios-alerts held copy (PRD FR-45; CLAUDE.md "Published copy needs the user's approval first")

Nothing in this folder has been applied. Each file is an exact before-and-after for a published surface; the Orchestrator shows them to the user rendered and applies each only on an express yes, before the bundle ships.

| File | Surface | Default recommendation |
|---|---|---|
| `a-privacy-policy.md` (+ `PRIVACY_POLICY.proposed.md`, `privacy.proposed.html`) | `PRIVACY_POLICY.md` and its mirror `website/privacy.html` | Apply (required: the feature adds a scheduled request and on-device documents the policy must describe) |
| `b-product-brief.md` | `product-brief.md` network sentence | Apply sentence 2; sentence 1 needs no change |
| `c-whats-new.md` | App Store What's New | Apply at ship |
| `d-listing-privacy.md` | `appstore/LISTING.md` compliance record; ASC privacy answers | Record the bullet; the answers themselves do not change |
| `e-readme-website.md` | `README.md`, `website/index.html` | Add nothing (register); one optional sentence shown |
| `f-location-purpose-string.md` | `NSLocationWhenInUseUsageDescription` (three files) | Leave unchanged (not required) |
| `g-accessibility-statement.md` | `ACCESSIBILITY.md` | Apply (the list it replaces is no longer complete) |
| `h-review-notes.md` | `appstore/REVIEW_NOTES.md` (pasted into ASC) | Apply at ship |

Not held, because they need no stop (CLAUDE.md): `docs/HELP.md` (the Alerts subsection is written) and every in-app string.

Revised after the security review (2026-09-30), privacy draft only: a new section 7b names the Alerts section's "My location" choice and "Use my location" button among the location controls, and section 9 now says which position is saved (the one the app itself read, never a widget's) and how long the inbox and that position are kept. Both proposed files carry the same two changes; the file set above is unchanged.

Revised again after QA's re-verification and the security re-review (2026-09-30): paragraph 8 now says a My location check measures from the position rounded to within about half a mile (the code rounds it to two decimals, as the widget's cell already is), and paragraph 9 now lists the point each alert keeps (the fixed place, or that approximate point), drops the widget "does not copy" clause, and says the approximate points stay with their alerts after Fixed place or off, until the alerts are deleted or cleared.

Revised a third time after QA round 2 and the security re-review round 2 (2026-09-30), paragraphs 8 and 9 only, identical in both proposed files and `a-privacy-policy.md`: a widget's position counts only when the widget read it from the device (a Default Location fallback does not, and the code now enforces that); the rounding is described as "rounded to about a kilometer", the phrase the published widget paragraph already uses, in both places; paragraph 9 names the alert waiting for the end of quiet hours and what it keeps until it is delivered, adds each inbox alert's radius and place label, and states the kept point as an upper bound (a later check within seven days can replace it).

Revised for the design re-entry (2026-09-30), privacy draft paragraph 9 only, identical in both proposed files and `a-privacy-policy.md`: the inbox is now its own view, reached from the Alerts card, the header bell or Search, so the Clear sentence now places Clear in the Alerts inbox rather than in the Alerts section. No other held draft described the inbox as living inside Settings: What's New says alerts are turned on in Settings, which stays true.
