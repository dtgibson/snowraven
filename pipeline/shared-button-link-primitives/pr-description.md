## Shared Button/Link Primitives

### What this does

Adds thin, ref-transparent `Button` and `Link` primitives that keep native element semantics while making SnowRaven's WebKit-safe `tabIndex={0}` behavior the default. All 234 app-owned buttons and 14 href links across 59 shipped TSX files now render through those seams, while the four intentional non-default tab-order cases remain explicit and guarded.

The source-level coverage test now resolves canonical primitive imports, rejects raw-control bypasses, pins both defaults, and permits only the exact four-row exception roster. Accessibility, UI-rule, design-system, focus-trap, and rendered-control documentation now describe primitive ownership consistently.

### How to test

1. From `frontend/`, run `npx vitest run src/components/ui/ButtonLink.test.tsx src/lib/tabOrderCoverage.test.ts src/components/OutboundLink.test.tsx src/components/ChecklistLink.test.tsx src/components/mapCornerTabStops.test.tsx src/components/CommandPalette.test.tsx src/components/NamedBirdsTable.test.tsx src/components/SpeciesWeatherCard.test.tsx src/components/WeatherStatsSection.test.tsx src/components/ui/ToggleSwitch.test.tsx`.
2. Run `npm run typecheck`.
3. Run `npm run lint`.
4. Run `npm run build`.
5. Start the app with `npm run dev`, open http://localhost:5173, and use Tab to sample navigation buttons, map controls, settings controls, and outbound links. Their focus order, visuals, accessible names, and behavior should match the existing app.

### Notes for reviewer

- This is a structural ownership migration. It intentionally makes no CSS, visual, copy, backend, data, or interaction changes.
- Native props, refs, classes, inline styles, children, events, disabled states, and the absence or presence of a button `type` are forwarded unchanged.
- The exact retained overrides are the Settings radio group's `checked ? 0 : -1`, SnowMap's native-disabled `rasterOffline ? -1 : 0`, SpeciesCombobox's redundant chevron `-1`, and TabNav's roving tab `active ? 0 : -1`.
- The migration preserves 21 ref-bearing sites, 115 buttons with implicit native type behavior, and 3 spread-bearing controls.
- Focused verification passed 204 tests across 10 files. Typecheck, lint, and production build also passed.
- Design lint reports the same 44 advisory notes as the pre-change baseline. They concern existing motion and literal-color surfaces; addressing them would be visual cleanup outside this change brief.
- The full cumulative frontend suite is intentionally deferred to The Spool's bundle flush.

## Convention Flags

- App-owned buttons and href links use the canonical native `Button` and `Link` primitives; raw intrinsic controls stay inside those primitive implementations.
- Ordinary call sites inherit `tabIndex={0}`. Only the exact rostered non-default semantics pass an explicit native `tabIndex` override.
