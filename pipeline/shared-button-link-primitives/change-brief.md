# Change Brief — Shared Button/Link Primitives

## What is changing
**Nothing. Recommendation (d): do not build the primitives in this bundle; return the idea to the inbox with the measurements below.** Three findings at HEAD, none of which were available when the idea was written. (1) **The primitives would absorb nothing.** 181 of 235 sites carry a bespoke inline `style` (median 320 source chars, 68 over 400, max 1320) and 137 carry `style` with **no `className` at all**, so there is no shared visual contract to own — a primitive over today's code is a passthrough whose only content is the `tabIndex` default. (2) **That default is already enforced**, by `tabOrderCoverage.test.ts`, which fails a new unmarked control loudly today. (3) **Decisively: migrating a site REMOVES it from that guard's population**, which is intrinsic tags only. Every migrated site is a site the guard stops watching, and the guard's own non-vacuity floors (`>150` buttons, `>10` anchors) leave headroom of **71 buttons and 3 anchors** before it goes red on emptiness — so even option (b)'s "bounded subset" is bounded by the guard, not by coherence. Options (a) and (b) trade a working structural guarantee for an ergonomic one; (c) would have to fail a *correct* `tabIndex={0}` control while 235 shipped sites use exactly that, or carry a 235-row baseline roster — the blanket-pardon shape v1.0.16 closed with cardinality.

## Why now
Pulled from the saved-idea inbox as build 4 of a 5-build Spool spin. The trigger is worth recording even though the answer is no: the idea's recorded size is **stale in both directions**, and its override premise is **wrong**. Measured at HEAD by the guard's own AST population: **235 sites (221 `<button>` + 14 `<a href>`) across 55 of 80 shipped `.tsx`** — against the idea's *218 buttons across 79 files*. The four non-`{0}` sites are **not "three roving groups"**: they are three different kinds — two roving groups (TabNav's vertical tablist over 11 destinations; Settings' `RadioGroup` over three groups), one non-roving redundant chevron, and one native-`disabled` base-map button that is not a tab-order decision at all. A single boolean override prop cannot model three kinds, so the trap the idea names is worse than it recorded, not better.

## User-facing impact
None. No code changes.

## Design pass
Not needed — no visual change.

## Decisions touched
- **v1.0.16 (DECISIONS.md:57), "PER-CALL-SITE OVER SHARED PRIMITIVES, BECAUSE THE CODEBASE HAD ALREADY VOTED."** Upheld, not reversed — and now on measured rather than estimated grounds.
- **v1.0.17 (DECISIONS.md:27), the nav rework.** Retired the third roving group (the collapsed dropdown's `role="option"` listbox); this is why the idea's "three roving groups" and "five rostered exceptions" are stale. The roster is four rows.
- **v1.0.15 (DECISIONS.md:91), the WebKit default-tab-mode premise.** Untouched; it is the reason the attribute is mandatory at all.
- **`ROADMAP.md:35`** (the primitives entry) carries the same stale *218 / 79 / three roving groups*; **`.claude/rules/ui.md`** carries the stale *218*. Both want correcting when the idea returns.
- **`ACCESSIBILITY.md`** (Keyboard Navigation, and the closing statement at :89) publishes the exceptions as two groups plus the chevron. Consistent with the roster today; a primitive would change what that published prose has to say.
- **`pipeline/design-system.md` does NOT anticipate primitives.** Across 442 lines it names *registers* (SectionCard/SectionHead, the quiet bordered button, ToggleSwitch, ModalDialog, the map corner row) and its Accessibility commitments line codifies the per-call-site rule verbatim: "Every `<button>` gets explicit `tabIndex={0}`". No `<Button>`/`<Link>` primitive appears anywhere in it. That absence is the real finding — it confirms the idea's own closing line, because the design system has no visual contract for a primitive to carry yet.

## What done looks like
This brief is on disk, no code changed, and the idea returns to the inbox carrying the corrected figures (235/55, four exceptions of three kinds) so the next reader does not re-derive them. **What a future build should do, in order:** the design-system pass first — define the button/link *registers* that today's 181 inline-styled sites collapse into, and migrate those styles into classes. Only then does a primitive own something besides a `tabIndex` default, at which point the override question answers itself per register instead of per boolean. That build must also rewrite `tabOrderCoverage.test.ts` to follow the primitive (its population, its non-vacuity floors, and the counted roster's binding to each site) **in the same change** — never after, or the guarantee lapses mid-migration.
