# Bug Brief — species-detail-checklist-frequency-basis

## Verdict

The defect is confirmed. `computeSightingsStats(speciesObs)` returns
`total: speciesObs.length` (`frontend/src/lib/speciesStats.ts`), but Species Detail divides that
row count by `totalFilteredChecklists`, a distinct set of non-empty submission IDs
(`frontend/src/components/SpeciesDetail.tsx`). A checklist carrying both a parent species row and
a subspecies/form row is therefore counted twice in the numerator and once in the denominator.
The neighboring **Checklists** figure prints the same raw-row total.

The recorded reference-export measurement remains useful but is not a product-wide prevalence
claim: Mallard +7, Yellow-rumped Warbler +3, Dark-eyed Junco +1, and Northern Flicker +1, or 12
excess rows in 21,369. Two artifacts call that 4 of 282 species while the later schema census says
283 selectable species; that one-species discrepancy is unreconciled and this brief does not turn
either denominator into a new fact.

## Executable reproduction

A minimal Vite SSR probe loaded the production `computeSightingsStats` and
`normalizeSpeciesName` modules. Its fixture put `Yellow-rumped Warbler` and `Yellow-rumped Warbler
(Myrtle)` on the same submission, `S1`, then selected the normalized parent exactly as merged mode
does. The observed result was:

```text
merged rows:                 2
current Checklists/Frequency: 2 / 200%
distinct Checklists/Frequency: 1 / 100%
ordinary S1 + S2 rows:        current 2 / distinct 2
zero-denominator Frequency:   null
```

The existing `speciesStats.test.ts` suite passes 9/9. Its only sightings-total fixture has one row
per submission, so its `total === 3` assertion proves ordinary parity but cannot reject this bug.

## Affected displays and branches

There are no other consumers of `sightingsStats.total` beyond these paths:

1. The Sightings card's **Checklists** value prints it directly.
2. Frequency text divides it by `totalFilteredChecklists`, then renders `<1%` or a rounded integer
   percentage. This text can exceed 100% today.
3. The Frequency fill uses the same percentage. `Math.min(frequencyPct, 100)` masks overflow in the
   bar only; it does not repair the value or the text.

Frequency's existing zero-denominator branch is correct: when there are no non-empty submission
IDs in scope, `frequencyPct` is `null` and the entire Frequency cell is absent. Keep that behavior.
The Sightings section's row-presence guard and the Individuals, personal-best, first/last, media,
and breeding derivations do not use the checklist total and must not change.

One independent same-root defect is in scope: when county or date filters are active, the strip
says `Showing ${speciesObs.length} of ${baseCount} checklists`; both figures are raw rows. Leaving
that sentence untouched would make the repaired card disagree with another checklist-labeled
figure on the same Species Detail view. Its filtered and base figures must both become distinct
submission counts. This does not authorize changing any other row-based display.

## Exact counting basis

The corrected species numerator is the number of distinct, non-empty `submissionId` values in the
already-derived `speciesObs` slice. Deriving from that slice, rather than rebuilding its predicate,
is the filter contract:

- A selected species is required.
- With **Show subspecies** off (`mergeSubspecies === true`, the default), include every row whose
  `normalizeSpeciesName(commonName)` equals the selected parent. Parent, subspecies, and form rows
  on one submission collapse to one checklist.
- With **Show subspecies** on (`mergeSubspecies === false`), require an exact `commonName` match;
  repeated rows with the same submission ID still collapse to one checklist.
- Apply the active county filter and inclusive date bounds (`date >= from`, `date <= to`) exactly as
  `speciesObs` already does.
- Skip falsy submission IDs, matching `totalFilteredChecklists`. Do not introduce
  `SUBMISSION_ID_RE` validation on only one side.

The denominator remains all distinct non-empty submission IDs in the full export after the same
county/date filters. It does not depend on the selected species or subspecies mode. **Show all
forms** and **Show escapees** govern selector visibility and may clear a selection that becomes
hidden; they are not extra predicates on an already-selected species or on the denominator.

For the filter strip, the left side counts distinct IDs from `speciesObs`; the right side counts
distinct IDs from the selected species' pre-county/date slice under the same subspecies-mode rule.

## Minimal repair

Add one small pure helper in `speciesStats.ts` that counts distinct non-empty submission IDs from an
observation slice. Use it inside `computeSightingsStats`, returning an explicitly named
`checklistCount` rather than the ambiguous row-shaped `total`, and use that field for the
Checklists card and Frequency. Reuse the helper for both filter-strip figures. Keep the existing
streaming, distinct denominator or route it through the same primitive only if that does not add a
full-export intermediate allocation. Do not deduplicate or otherwise mutate `speciesObs` itself:
the other statistics intentionally consume rows.

## Regression coverage

- Extend `speciesStats.test.ts` with repeated submission IDs, including empty IDs, and retain the
  current one-row-per-checklist fixture as ordinary parity coverage.
- Add a focused Species Detail component test with a parent plus multiple subspecies/form rows on
  one submission. In merged mode, assert **Checklists = 1**, Frequency is **100%**, and its fill is
  no wider than 100%; exercise **Show subspecies** to prove exact-name mode also deduplicates.
- In that component coverage, drive county and inclusive date bounds so numerator and denominator
  are proved to share the active filters, and assert the filter strip's filtered/base checklist
  figures are distinct-ID counts.
- Cover a selected species whose rows have no submission ID: Checklists is 0 and Frequency is
  absent. Cover an ordinary one-row-per-submission case with unchanged count and percentage.
- Make `frequency <= 100%` an asserted invariant, not merely a consequence inferred from the
  visually clamped bar.

## Boundaries and ship posture

Do not change calendar, map, graph, location, co-occurrence, list, or taxonomy/breakdown counts;
their row/checklist semantics are separate work. Do not alter individual sums, reported form
breakdowns, selector policy, or validate submission-ID syntax more strictly as part of this fix.

This is release-worthy because it corrects a shipped statistic and eliminates a possible value
over 100%, but Spool owns the release boundary: no per-feature version bump, release preparation,
or standalone stamp. It receives the shared patch stamp when the spool is flushed.

Done means every checklist-labeled figure covered above uses distinct non-empty submission IDs,
Frequency is absent at a zero denominator and otherwise never exceeds 100%, ordinary exports are
unchanged, and the focused tests plus the full frontend checks pass.
