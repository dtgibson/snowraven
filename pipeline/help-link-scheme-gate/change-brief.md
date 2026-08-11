# Change Brief — help-link-scheme-gate

## What is changing

`HelpDocs.tsx:74` interpolates a parsed markdown link target straight into `href`,
so the renderer would emit a live, styled `javascript:` / `data:` anchor if it were
ever pointed at content other than the bundled `docs/HELP.md`. Gate the target on
the repo's already-shipped predicate `/^https?:\/\//i` (`CommentText.tsx:23`) — not
the looser `^https?:` from the idea, which would admit `https:evil` — and on a miss
render the link TEXT as plain escaped text, dropping the anchor. That matches the
established fallback everywhere else ("plain text when it doesn't match, never a
styled 404 link": `ChecklistLink`, `HotspotLink`, and `CommentText`'s non-link
span). An empty-text link then vanishes entirely, which is correct; the raw
markdown source must NOT be echoed as the fallback. The anchor also moves onto the
shared `OutboundLink`, which it currently hand-rolls (`target="_blank"` +
`rel="noreferrer"` + an `.sr-only` cue, all re-implemented in place).

## Why now

Found by the v0.5.83 security audit and saved as an idea; informational, not live.
Cheap defensive hardening while the trust model is still simple, and the anchor is
already out of step with the `OutboundLink` convention.

## User-facing impact

None. `docs/HELP.md` holds exactly 7 markdown links and all 7 are `https://`
(inventoried, not taken on trust), so every one renders identically after the gate.
The fallback path is unreachable from today's bundled content. Accessible names are
unchanged either way: `OutboundLink` with plain-string children emits the cue as an
`aria-label` instead of an `.sr-only` node, producing the same announced name.

## Design pass

Not needed — no visual change. Every shipped link still renders as a link, with the
same accent color, underline and new-tab cue; the only new rendering is a fallback
that today's content cannot reach.

## Decisions touched

- **"Help documentation bundled at build time via Vite ?raw import" (2026-05-25,
  DECISIONS.md:2142)** — TOUCHED, not reversed. Its rationale is the reason this is
  informational: "The only valid input for the help panel is a developer-controlled
  static file -- not user data and not a remote URL." The `?raw` build-time import
  stands unchanged; the gate simply stops the renderer's safety from *depending* on
  that decision holding forever.
- **"Accessibility follow-ups: ... an OutboundLink wrapper" (2026-06-13, v0.5.32,
  DECISIONS.md:1159)** — FULFILLED, not reversed. `OutboundLink` is "the standard
  wrapper for every NON-checklist external link"; the Help anchor predates it.
  `CommentText`'s deliberate non-use of `OutboundLink` stays as-is — out of scope.

## What done looks like

- All 7 `https` links still render as anchors with the new-tab cue; a `javascript:`,
  `data:`, relative or empty target renders as plain link text with no anchor.
- The guard is mutation-checked in both directions per house convention: red against
  the pre-change renderer, and green on the `https` cases that must keep linking.
- Two traps to expect. (1) `HelpDocs.test.tsx`'s F078 case asserts the `.sr-only`
  *mechanism*, so it goes red under `OutboundLink`'s `aria-label` branch — re-point
  it at the accessible name (the guarantee) rather than loosening it. (2) The
  predicate needs a `lib/` home: `renderInline` is module-private, and a
  non-component export from `HelpDocs.tsx` trips `react-refresh/only-export-components`.
