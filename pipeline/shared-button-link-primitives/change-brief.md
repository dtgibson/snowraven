# Change Brief — Shared Button/Link Primitives

## What is changing
Add thin, ref-transparent `Button` and `Link` UI primitives that render the same native elements, default `tabIndex` to `0`, and forward native props, classes, and inline styles unchanged. Migrate all app-owned intrinsic controls measured at HEAD: 234 `<button>` and 14 `<a href>` sites across 59 of 88 shipped TSX files, directly or through existing semantic wrappers such as `OutboundLink` and `ChecklistLink`. Make `lib/tabOrderCoverage.test.ts` primitive-aware before the migration: raw intrinsic controls belong only inside the primitives, and every explicit non-default override stays bound to the existing four-row counted roster. Update `ACCESSIBILITY.md`, `.claude/rules/ui.md`, `pipeline/design-system.md`, and the focus-trap/guard headers wherever they still publish per-call-site ownership.

## Why now
This saved Spool item was explicitly directed to run after two earlier scoping declines. The current AST guard catches an omitted tab stop after a control is written; a required primitive seam makes new app-owned controls inherit the WebKit-safe default while retaining the guard as the regression net. The idea's old 218-button/79-file/three-roving-group figures are stale; HEAD has 248 intrinsic control sites and four exceptions of three kinds.

## User-facing impact
None intended: rendered element types, DOM order, focus order, accessible names, handlers, disabled states, refs, classes, and styles must remain unchanged. The 182 inline-styled sites (137 with no class) are forwarded as-is. Out of scope: CSS-register or inline-style cleanup, visual redesign, copy changes, new behaviors, backend/data work, and changes to specialized link semantics.

## Design pass
Not needed — this is a structural accessibility-default migration with no visual or interaction change.

## Decisions touched
- **v1.0.16, per-call-site over shared primitives:** reverse only the ownership choice; retain its WebKit premise and explicit non-default exceptions.
- **v1.0.19, first primitive decline:** its intrinsic-only guard objection was already superseded; preserve the four counted exception sites.
- **v1.0.20, second decline:** reverse the CSS-register prerequisite by explicit direction; visual registers remain separate, while `OutboundLink`/`ChecklistLink` remain semantic wrappers over the base link primitive.

## What done looks like
All app-owned buttons and href links inherit `tabIndex={0}` through the primitives, while the two roving groups, redundant combobox chevron, and natively-disabled base-map control preserve their exact expressions. The source guard fails raw-control bypasses, unrostered overrides, roster cardinality drift, and a broken primitive default; primitive tests pin ref/prop forwarding and native-semantics preservation. Existing component, rendered tab-stop, full frontend, typecheck, lint, and build gates pass with no visual CSS change.
