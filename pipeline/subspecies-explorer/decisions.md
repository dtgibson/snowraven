## Stage 3 cascade: QA-13 restated as an identity (2026-08-29)

The Architect verified FR-13's assumption against the real code and it does not
hold: the merged `speciesObs` memo in `SpeciesDetail.tsx` filters only by folded
name, with no `isNonCountableForm` exclusion, so non-countable variant rows are
inside the Sightings "Checklists" figure but are barred from the breakdown by
FR-02. Per FR-13's own surface-the-conflict rule, the breakdown contract now
carries a `nonCountableCount` ledger and QA-13 is restated as the testable
identity: breakdown total + non-countable ledger = Sightings figure, with the
displayed figures equal exactly when the ledger is zero. The merged view itself
is deliberately unchanged (FR-21). Classified as a targeted factual cascade
(Case 1) because FR-13 pre-authorized exactly this resolution path; surfaced to
the user at the Stage 4 rejoin.
