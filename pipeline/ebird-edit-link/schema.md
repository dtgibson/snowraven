# Schema — eBird Edit Link
**Feature:** ebird-edit-link
**Classification:** Frontend Only — Incremental
**Date:** 2026-05-08
**Stage:** 3 — The Architect
**Source:** prd.md (approved)

---

## Classification Rationale

No new routes, no new backend logic, no new state shape. The checklist ID needed to construct the link is already present in `AppState` as `checklistId` (set on the `success` status variant). This is a single JSX addition to `App.tsx`.

---

## Existing State — No Changes Required

```typescript
// Already in App.tsx — no modification needed
type AppState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; formatted: string; checklistId: string; locName: string; obsDt: string }
  | { status: 'error'; message: string }
```

`state.checklistId` is the `S\d+` ID returned by `/weather/{id}` and stored on every successful lookup. The edit link is simply `https://ebird.org/edit/effort?subID=${state.checklistId}`.

---

## Change Surface

**One file modified:** `frontend/src/App.tsx`

**Insertion point:** Inside the `{hasResult && (...)}` block, on the confirmation row — the `<div>` that currently renders `{state.checklistId} / {state.locName} / {state.obsDt}`. The edit link sits to the right of that text on the same row (flexbox row with `justifyContent: 'space-between'`).

**No new components.** The link is a plain `<a>` tag — no abstraction needed.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/App.tsx` | Add edit link `<a>` to the success results area |

**No backend files touched.**
