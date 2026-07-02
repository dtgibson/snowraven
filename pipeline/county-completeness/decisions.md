# Decisions — County Completeness

## Stage 4 — The Designer

### D-401 — "Shade counties" toggle rename (deliberate deviation from shipped label)
**Approved by the user at the design stage (2026-07-01).**
The Map Explorer county sub-toggle shipped as **"Shade by species seen"**. With
Completeness joining Species and Checklists, the toggle now governs three
metrics — two of which are not "species seen" — so the label becomes
**"Shade counties"**. Label-only change: the switch's behavior, `role="switch"`
semantics, and `aria-label` contract are otherwise unchanged (the `aria-label`
should be updated to match the new visible label per WCAG 2.5.3 Label in
Name). The toggle's caption becomes metric-aware: the shipped backup-only
sentence for Species/Checklists; a completeness-specific sentence ("your
backup measured against everything reported on eBird") when Completeness is
selected. Logged as a deviation because it edits shipped UI text outside the
feature's additive surface.

### D-402 — Completeness popup keeps the species/checklists count row
**Approved by the user at the design stage (2026-07-01).**
In Completeness mode the popup **retains** the existing `CountStat` row
(species / checklists) for continuity with the other metrics, rather than
dropping it to let the progress bar carry the numbers alone. The FR-20
confusion risk (raw Species-metric count vs. countable X) is resolved by
labeling, exactly as mocked: the completeness line reads "X of Y species · Z%"
with the caption **"Countable species — spuhs, slashes & hybrids don't
count."** directly beneath it, and neither CountStat number takes the
accent-active state while Completeness is the metric.
