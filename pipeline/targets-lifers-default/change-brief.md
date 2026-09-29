# Change Brief — targets-lifers-default

## What is changing
The Targets tab opens showing lifers only. The seed (user, verbatim): "For targets tab: by default only show new lifers, and have the other filters off." The one code change is `DEFAULT_TOGGLES` in `frontend/src/lib/targets/targetsFilter.ts`, from `{ lifer: true, media: true, breeding: true, ... }` to `{ lifer: true, media: false, breeding: false, chips: new Set(), threshold: 'any' }`. Filtering, badges, counts, the sub-controls and the empty states keep their current logic. The user still turns Media or Breeding on with the pills that are already there.

**What "the other filters" means here (the smallest faithful reading):** the **Media** and **Breeding** type toggles. Every other filter on the tab already starts in its no-filter position and stays there: Photo/Audio/Video chips (none selected), the Breeding threshold (Any code, shown only once Breeding is on), **Last report** (Any time, a recorded decision) and **Distance** (Any distance). Sort and County are not filters and do not change.

## Why now
The user saved this as an idea after using the 1.0.39 Targets tab. With all three types on, the list opens on a mix of lifers, missing-media and breeding rows, and the thing they want first is the lifers.

## User-facing impact
- First open and every relaunch: Lifer is pressed, Media and Breeding are not. The list shows only lifer rows, and the summary reads "N targets · N lifers". The Media chips and the Breeding threshold segbar stay hidden until their pill is pressed. That is today's designed toggle-off state, not a new one.
- Adding an ML export mid-session no longer switches Media on by itself. It stays off until pressed. With no export, Media is `aria-disabled` with its reason, as today.
- No lifers under the default: the existing FR-24 line appears, "No lifer targets for you in {County}, across its N species." It is accurate, and the pills sit directly above it. It is somewhat likelier now, because the tab opens on the user's most-birded county. No new hint copy in this build (see flags).
- No saved state to migrate. The toggles are plain `useState` in `Targets.tsx`, never written through the storage seam, and they reset on relaunch (HELP says so). Only the county persists. CLAUDE.md's read-time migration rule does not apply.

## Design pass
Not needed. There is no visual change to any surface. Every state the new default shows (Media and Breeding unpressed, chips and threshold hidden, a one-part summary, the lifer-only empty line) already exists and was designed in `pipeline/targets-tab/design-spec.md` §2 and its empty states. Only the state the tab opens in changes.

## Decisions touched
- **Reversed:** targets-tab PRD **FR-19**, "three toggles, Lifer, Media, Breeding, all on by default" (also the strategic brief's "all on by default"). This lives in the pipeline record, not as its own DECISIONS.md entry. The Chronicler logs the reversal. Do not edit the shipped targets-tab pipeline files.
- **Touched, not reversed:** DECISIONS.md "Targets tab ..." (2026-09-27, v1.0.39): "each type with its own switch" still holds.
- **Kept, and consistent with this change:** the same entry's "The window defaults to Any time" (an optional filter starts off) and its session-only rule (the measuring point and, per HELP, the toggles are never saved). The session-only rule is why no migration is owed.

## Scope
**Changes:**
- `lib/targets/targetsFilter.ts`: the default, plus a doc line naming it and its source.
- `lib/targets/targetsFilter.test.ts`: the semantics rows (QA-21 "either toggle", FR-20 "media unavailable", QA-27) spread `DEFAULT_TOGGLES` and would go vacuous or red. Give them an explicit all-on fixture, and add a row pinning the new default and that the default view is lifer rows only.
- `components/targets/Targets.test.tsx`: these rows assume recorded species show by default and need Breeding pressed first: Species Detail on Song Sparrow; the all-off row, which now clicks Breeding ON; and the Places/distance rows on Song Sparrow and Lincoln's Sparrow. Add a first-open row: Lifer `aria-pressed` true, Media and Breeding false, no chips or threshold group rendered.
- `docs/HELP.md` `## Targets`: one sentence saying the tab opens on lifers only and Media or Breeding are turned on with their toggles. The closing "not saved" sentence stays true. No em dash.
- `lib/targetsPublishedClaims.test.ts`: a row holding that sentence to `DEFAULT_TOGGLES`.
- CHANGELOG: a "Changed" line at the bundle's stamp, following this spin's convention (build 1 did not bump).

**Does not change:** `Targets.tsx` logic, `TargetsControls.tsx`, `targetsCopy.ts`, `globals.css`, storage, and all four published surfaces (below).

## Published surfaces
None of them becomes inaccurate, so no held patch is needed. README's Targets section and in-app `TAB_DESCRIPTION` describe the three kinds the tab offers, not what starts on. The website has no Targets row yet. PRIVACY_POLICY.md and website/privacy.html say nothing about toggles. `appstore/LISTING.md` has no Targets bullet yet. The owed 1.0.39 Description bullet (ROADMAP) should describe the kinds, not an all-on default.

## What done looks like
- A fresh launch of Targets on a county with a pool shows only lifer rows, with Lifer pressed and Media and Breeding unpressed. Pressing Media or Breeding brings their rows, chips and threshold back exactly as today.
- `targetsFilter`, `Targets` and `targetsPublishedClaims` suites are green, with the new default pinned in a non-vacuous row. `npm run typecheck` passes.
- HELP states the default, and a guard holds it to the code.
