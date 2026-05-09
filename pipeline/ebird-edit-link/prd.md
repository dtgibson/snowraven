# PRD — eBird Edit Link
**Feature:** ebird-edit-link
**Session:** 001
**Date:** 2026-05-08
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

After a successful weather lookup, a link appears near the checklist confirmation line that takes the user directly to the eBird edit page for that checklist. The link is constructed from the checklist ID already in the app's state — no new network requests are needed. Clicking it opens eBird's edit page in a new tab so the user can paste the copied weather into the comment field.

---

## User Stories

**US-01** — As a birder who has just retrieved weather for a checklist, I want a direct link to edit that checklist on eBird, so I don't have to navigate there manually.

**US-02** — As a user, I want the link to open in a new tab, so I don't lose my SnowRaven session.

---

## Functional Requirements

**FR-01** — After a successful weather lookup, a link shall appear in the results area with the label "Edit checklist on eBird".

**FR-02** — The link's `href` shall be `https://ebird.org/edit/effort?subID={checklist_id}`, where `{checklist_id}` is the resolved checklist ID (e.g. `S12345678`) from the lookup result.

**FR-03** — The link shall open in a new tab (`target="_blank"`, `rel="noreferrer"`).

**FR-04** — The link shall be positioned between the checklist confirmation line (`S… / location / date`) and the "Weather output" label, on the same row as the confirmation line or immediately below it — not inside the copyable weather text block.

**FR-05** — The link shall not appear in the idle, loading, or error states — only in the success state.

**FR-06** — No backend changes are required. The checklist ID is already returned in the `/weather/{id}` response and stored in `AppState`.

---

## Non-Functional Requirements

**NFR-01 — Visual consistency:** The link shall use SnowRaven's existing muted green accent (`#2D8653`) to signal it is an outbound action, and match the existing footer link style (no underline by default, underline on hover).

**NFR-02 — Security:** The link target is always `ebird.org` — the checklist ID is validated server-side as `/^S\d+$/` before the success state is reached, so there is no XSS or open-redirect risk.

**NFR-03 — Accessibility:** The link shall include `aria-label="Edit this checklist on eBird (opens in new tab)"` to inform screen reader users it opens externally.

---

## Out of Scope

- Deep-linking to the comment field
- Auto-paste behavior
- Changes to the formatted weather text

---

## Success Metrics / QA Checklist

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Link appears after successful lookup | Results area shows "Edit checklist on eBird" link |
| QA-02 | Link does not appear on error or idle | No link visible before lookup or after an error |
| QA-03 | Link href is correct | Inspecting the element shows the correct `subID` parameter matching the input |
| QA-04 | Link opens new tab | Clicking opens eBird edit page in a new tab without navigating away |
| QA-05 | Link updates on new lookup | Pasting a different checklist ID and looking up again produces a link with the new ID |
| QA-06 | No backend changes | git diff shows only frontend file changes |
