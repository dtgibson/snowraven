# PRD — Checklist Confirmation Header
**Feature:** checklist-confirmation
**Session:** 001
**Date:** 2026-05-08
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

After a successful weather lookup, a one-line confirmation is displayed showing the resolved checklist ID, location name, and observation time. This matches the format raincrow.app uses and lets the user verify the lookup resolved to the correct checklist before copying the output.

---

## User Stories

**US-01** — As a birder, I want to see which checklist ID was resolved after clicking Get weather, so I can confirm the lookup used the right checklist.

**US-02** — As a birder, I want to see the location name and observation time alongside the checklist ID, so I can verify the result at a glance without opening eBird separately.

---

## Functional Requirements

**FR-01** — The backend `/weather/{checklist_id}` endpoint shall include three additional fields in its success response: `checklist_id` (string, the ID passed in), `loc_name` (string, the location name from the eBird checklist view API's `locName` field), and `obs_dt` (string, the observation datetime formatted as `YYYY-MM-DD HH:MM`).

**FR-02** — The frontend shall display a confirmation line in the results area after a successful lookup, formatted as: `{checklist_id} / {loc_name} / {obs_dt}`

**FR-03** — The confirmation line shall appear between the horizontal rule and the "Weather output" label — above the copy button and the pre block.

**FR-04** — The confirmation line shall only appear when the app state is `success`. It shall not appear during loading, on error, or in the idle state.

**FR-05** — If `obs_dt` from eBird is a date-only string (no time component), the confirmation shall display only the date portion: `{checklist_id} / {loc_name} / {YYYY-MM-DD}`.

---

## Non-Functional Requirements

**NFR-01 — Visual consistency:** The confirmation line shall use SnowRaven's existing type scale and color tokens. It should be visually subordinate to the weather output — smaller and muted, not competing for attention.

**NFR-02 — No extra API calls:** `loc_name` is already present in the eBird checklist view response (`data["locName"]`). No additional API call is required.

---

## Out of Scope

- Linking the checklist ID to ebird.org
- Displaying the confirmation inside the copyable weather text block
- Observer name, species count, or any other checklist metadata
- Changing the datetime format to anything other than `YYYY-MM-DD HH:MM`

---

## Open Questions

**Q1 — datetime truncation:** The eBird `obsDt` field can be `"2026-05-07 17:26"` or `"2026-05-07"` (date-only). FR-05 handles this — default assumption is to display whatever is available, trimmed to `HH:MM` if a time component exists.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Confirmation renders on success | After a valid lookup, the line `{id} / {location} / {datetime}` appears between the `<hr>` and the "Weather output" label |
| QA-02 | Correct checklist ID shown | The ID in the confirmation matches the ID that was submitted |
| QA-03 | Correct location name shown | The location name matches the `locName` returned by the eBird API for that checklist |
| QA-04 | Correct datetime shown | The datetime matches `obsDt` from the eBird API, formatted as `YYYY-MM-DD HH:MM` |
| QA-05 | Not shown in other states | The confirmation line is absent in idle, loading, and error states |
| QA-06 | Backend response includes new fields | The JSON response from `/weather/{id}` includes `checklist_id`, `loc_name`, and `obs_dt` |
