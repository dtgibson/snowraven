export const meta = {
  name: 'accessibility-implement-remaining',
  description: 'Finish the accessibility fixes: 7 remaining component groups (tokens + map-explorer already done), integration, checks, docs',
  phases: [
    { title: 'Fix', detail: '7 parallel fixers with disjoint file ownership' },
    { title: 'Integrate', detail: 'full test suites + typecheck, fix fallout (max 3 rounds)' },
    { title: 'Check', detail: 'per-finding completion verification + remediation' },
    { title: 'Docs', detail: 'ACCESSIBILITY.md made true, changelog, version bump' },
  ],
}

const DIR = '/home/parallels/snowraven/pipeline/accessibility-pass/'
const REPO = '/home/parallels/snowraven'

const FIXREPORT = {
  type: 'object',
  required: ['results', 'summary'],
  properties: {
    results: { type: 'array', items: { type: 'object', required: ['id', 'status', 'note'], properties: { id: { type: 'string' }, status: { enum: ['fixed', 'partial', 'skipped', 'blocked'] }, note: { type: 'string' } } } },
    summary: { type: 'string' },
    testsRun: { type: 'string' },
  },
}
const INTEGRATION = {
  type: 'object',
  required: ['pass', 'log'],
  properties: { pass: { type: 'boolean' }, log: { type: 'string' }, failures: { type: 'string' } },
}
const CHECK = {
  type: 'object',
  required: ['results'],
  properties: { results: { type: 'array', items: { type: 'object', required: ['id', 'fixed', 'note'], properties: { id: { type: 'string' }, fixed: { type: 'boolean' }, note: { type: 'string' } } } } },
}
const DOCS = {
  type: 'object',
  required: ['summary', 'changed'],
  properties: { summary: { type: 'string' }, changed: { type: 'array', items: { type: 'string' } }, flags: { type: 'array', items: { type: 'string' } } },
}

const BASELINE =
  'BASELINE — already done and on disk, tested green (774/774 frontend, tsc clean). Do NOT redo or touch these:\n' +
  '- The --sr-* token retune in frontend/src/globals.css is COMPLETE. The full contract (every new/changed token, both themes, computed ratios, intended use) is at ' + DIR + 'work/tokens-manifest.md — READ IT and use those token names for any color fix.\n' +
  '- The map-explorer group (frontend/src/components/MapExplorer.tsx) is COMPLETE — do not edit MapExplorer.tsx.\n' +
  '- Filter aria-labels on the County select + From/To date inputs in SpeciesDetail.tsx, LifeList.tsx, BreedingCodeList.tsx are already added — skip those specific findings; do the OTHER findings in those files.\n' +
  'Always read the CURRENT code before editing; if a finding is already implemented, report it fixed and make NO change.\n\n'

const CONVENTIONS =
  BASELINE +
  'BINDING CONVENTIONS — read ' + REPO + '/CLAUDE.md FIRST and follow it exactly. Highlights:\n' +
  '- All colors via var(--sr-*) tokens (both :root and [data-theme=dark]); never hardcode hex/rgb in components.\n' +
  '- Persist settings via the storage seam (lib/storage.ts), never localStorage. Platform branching via isTauri().\n' +
  '- Map popups stay escaped JSX (no dangerouslySetInnerHTML). eBird ids gated by shape regexes (SUBMISSION_ID_RE etc.) before becoming hrefs.\n' +
  '- Overlays above maps need z-index >= 1200. Do not break the SightingMarkers keyed-<Source> pattern, the HotspotMarkers/AtlasLayer unconditional sprite registration contract, or updateMapCursor ownership.\n' +
  '- lib/weatherFormatter.ts is byte-parity-locked with backend/formatters/weather.py and the golden oracle weatherFormatter.golden.py — any output change hits all three in the same change or is skipped (status=blocked).\n' +
  '- Test conventions: component tests use a per-file `// @vitest-environment jsdom` docblock; any jsdom file mounting recharts charts ends with the 120 ms afterAll wait-out; never remove the test-setup.ts rAF shims; stubbed-queue tests need the observable stub-queue precondition (renderAndLoad in BirdingStats.test.tsx).\n' +
  '- Match surrounding code style; smallest correct change; no drive-by refactors.\n' +
  'HARD RULES: Do NOT git commit or push. Do NOT touch files outside YOUR owned set. Do NOT edit globals.css, MapExplorer.tsx, CHANGELOG.md, ACCESSIBILITY.md, README.md, docs/HELP.md, website/, or version fields (docs agent owns those) unless explicitly listed as yours.\n'

const FIXER_TASK =
  'YOUR TASK: Read your work file (path below) — a JSON array of verified accessibility findings (id, title, file, line, wcag, description, evidence, suggestedFix, verdict.fixNote [prefer when present], primaryHere). Implement the fix for every finding instance in YOUR owned files: for primaryHere=true that is the whole finding (except parts the description places in files you do not own); for primaryHere=false fix ONLY the instances in your files. Use the tokens-manifest token names for any color fix. ' +
  'Where a suggested fix is wrong against the real code, implement the minimal correct fix and say so. If a fix is genuinely unsafe now, return status=blocked with a precise reason. Update tests your changes break (follow the conventions); lock regression-prone fixes (aria attrs, roles, handlers) by extending an existing owned test file. ' +
  'Before reporting, run your owned tests (cd ' + REPO + '/frontend && npx vitest run <your test files>) and fix what you broke. Report per-F-ID status honestly.\n'

phase('Fix')

const GROUPS = [
  { key: 'app-shell', files: 'frontend/src/App.tsx, frontend/src/components/TabNav.tsx, frontend/index.html, frontend/src/lib/scroll.ts, src-tauri/tauri.conf.json (window title only, NOT the version field), src-tauri/capabilities/default.json', extra: 'Shell: landmarks (<nav>/<header> — the tablist currently eats the nav role, wrap it), heading outline entry points, skip link (.sr-skip-link style already in globals.css — add `<a href="#sr-main" className="sr-skip-link">Skip to main content</a>` as first child + give <main> id="sr-main" tabIndex={-1}), per-view document.title (web) + Tauri getCurrentWindow().setTitle behind isTauri() with the core:window:allow-set-title capability in default.json, map-fullscreen overlay Escape/focus containment, collapsed-nav dropdown tabpanel id fixes, update-check announcements + auto-dismiss timing, App.tsx live-region corrections.' },
  { key: 'maps-shared', files: 'frontend/src/components/SnowMap.tsx, frontend/src/components/AtlasLayer.tsx, frontend/src/components/SightingsMap.tsx, frontend/src/components/map/* (HotspotMarkers, SightingMarkers, TargetMarkers, MapSidebarUI, MapControls), frontend/src/lib/mapExplorerFormat.ts, frontend/src/lib/mapPins.ts', extra: 'DOM markers become real focusable buttons (F014 verifier note explains the react-map-gl wiring incl. neutralizing the maplibre wrapper role/label via the Marker ref), SegControl role=group + aria-pressed (mirror SortSeg in Checklists.tsx), popup Escape/close + focus, atlas popup keyboard route, remove inline outline:none in the style factories, rotate/pitch gesture handling (disable multipoint-only rotate or restore compass), attribution target size, map chip text via --sr-map-target-*-text (tierColors() in mapExplorerFormat.ts), basemap pin tokens --sr-map-pin-* (SightingMarkers/mapPins/HotspotMarkers sprites), --sr-border-input on form controls.' },
  { key: 'species', files: 'frontend/src/components/SpeciesDetail.tsx (NOT the county/date aria-labels — done), frontend/src/components/SpeciesLinks.tsx, frontend/src/components/speciesDetail/* (SightingsGraph, ui, MapBoundsFitter), frontend/src/components/SpeciesPanel.tsx', extra: 'Combobox Escape focus return (refocus the input, do not strand on body), the click-only chevron span, favicon link names/targets, per-coordinate checklist links surfaced keyboard-reachably (F014 verifier note: Top Locations rows reusing the NamedBirdRow aria-label pattern), tier pill color -> --sr-tier-N-fg (F003).' },
  { key: 'stats', files: 'frontend/src/components/BirdingStats.tsx, frontend/src/components/MediaStatsSections.tsx, frontend/src/components/statsPrimitives.tsx', extra: 'aria-hidden wrapper around a focusable recharts SVG (make the SVG unfocusable / restructure), jump links move focus, named ↗ links, milestone palette -> --sr-milestone-N-* and rank pins -> --sr-rank-pin-* (manifest), tier text -> --sr-tier-N-fg where text-on-tint, fixed-px text -> rem/em so Text Size reaches it, chart tooltip hoverability (recharts Tooltip wrapperStyle pointerEvents auto — keep Escape dismissal), hue-only line differentiation (dash/markers). Chart-file test rules apply (keep the afterAll wait-outs).' },
  { key: 'settings-help', files: 'frontend/src/components/Settings.tsx, frontend/src/components/DropZone.tsx, frontend/src/components/WelcomeScreen.tsx, frontend/src/components/HelpDocs.tsx', extra: 'Settings keyboard reorder via visible Move up/Move down buttons per row (then DELETE the sr-only "not supported" disclaimer), remove aria-label off the non-interactive drag-handle div, radio-group arrow keys + roving tabindex, --sr-text-disabled-as-content -> --sr-text-muted, Help overlay focus restore on close + TOC collapse (add className="sr-help-row" on the body row and "sr-help-toc" on the TOC nav — the !important rules are already in globals.css), WelcomeScreen focus containment, DropZone outline:none removal + error state -> --sr-error.' },
  { key: 'lifelist-breeding', files: 'frontend/src/components/LifeList.tsx (NOT the county/date aria-labels — done), frontend/src/components/LifeListTable.tsx, frontend/src/components/BreedingCodeList.tsx (NOT the county/date aria-labels — done), frontend/src/components/BreedingCodeTable.tsx', extra: 'Sortable <th> -> real buttons with aria-sort, species column as row header (match BreedingCodeTable), breeding-tier text -> --sr-tier-N-fg (pills on tint) / --sr-tier-N-text (on solid badge), no-media icon visibility, filter-count live region correctness, zero-result empty-state message, breeding-code title-only hover meanings get a visible/AT-reachable alternative.' },
  { key: 'checklists-comparers', files: 'frontend/src/components/Checklists.tsx, frontend/src/components/ChecklistComparer.tsx, frontend/src/components/ChecklistBadges.tsx, frontend/src/components/ListComparer.tsx, frontend/src/components/ResultsView.tsx, frontend/src/components/MediaCommentsSection.tsx, frontend/src/components/WeatherTidePanel.tsx, frontend/src/components/WeatherTideSection.tsx, frontend/src/lib/weatherFormatter.ts (+ backend/formatters/weather.py + frontend/src/lib/weatherFormatter.golden.py ONLY as the byte-parity trio), frontend/src/components/CommentText.tsx', extra: 'Badge contrast -> --sr-tier-N-text (manifest), --sr-text-disabled-as-content -> --sr-text-muted, badge state exposure (ChecklistBadges spans -> meaningful semantics), comparison-mode tablist misuse -> role=group + aria-pressed, one-shot buttons focus handling on unmount, over-chatty comment-count live region, placeholder-only labels, error text -> --sr-error, consistent eBird-link identification (align with WeatherTidePanel wording), media-count badge semantics, comparer reflow (className="sr-compare-panels" on ResultsView grid; .sr-two-col for the ChecklistComparer 1fr-1fr). F082 (southern-hemisphere moon emoji): byte-parity trio rule applies — all three copies or status=blocked.' },
]

log('Wave: ' + GROUPS.length + ' fixers on disjoint file sets (tokens + map-explorer already done)')
const fixReports = await parallel(GROUPS.map(g => () =>
  agent(
    CONVENTIONS + '\nYou are the ' + g.key.toUpperCase() + ' fixer for the accessibility-pass in ' + REPO + '. Your owned files (edit ONLY these): ' + g.files + '.\n\n' +
    FIXER_TASK + '\nGroup notes: ' + g.extra + '\nWork file: ' + DIR + 'work/' + g.key + '.json',
    { label: 'fix:' + g.key, phase: 'Fix', schema: FIXREPORT }
  )
))
const failedGroups = GROUPS.filter((g, i) => !fixReports[i]).map(g => g.key)
if (failedGroups.length) log('Fixer agents that died (findings stay open): ' + failedGroups.join(', '))
const allResults = []
fixReports.forEach((r, i) => { if (r) r.results.forEach(x => allResults.push({ ...x, group: GROUPS[i].key })) })
const tally = {}
allResults.forEach(x => tally[x.status] = (tally[x.status] || 0) + 1)
log('Fix wave done: ' + JSON.stringify(tally))

phase('Integrate')
const INTEGRATION_PROMPT =
  'You are the integration gate for the accessibility-pass in ' + REPO + '. Run in order: (1) cd frontend && npx tsc --noEmit, (2) cd frontend && npx vitest run (full suite), (3) cd backend && python -m pytest tests/ -q. ' +
  'pass=true only if ALL succeed. On failure include relevant verbatim excerpts in failures (trimmed). Do not fix anything; do not commit.'

let integration = await agent(INTEGRATION_PROMPT, { label: 'integrate:run-1', schema: INTEGRATION })
let round = 1
while (integration && !integration.pass && round <= 3) {
  log('Integration round ' + round + ' failed — dispatching fixer')
  const fixer = await agent(
    CONVENTIONS + '\nYou are the integration fixer (round ' + round + '). The suites/build failed after the accessibility fix wave. Failures:\n\n' + (integration.failures || integration.log) + '\n\n' +
    'Diagnose and fix minimally. The accessibility fixes are intentional — prefer updating stale tests to match new correct behavior (aria attrs, roles, labels) over reverting; revert only if a fix is actually wrong. You may touch any file needed EXCEPT CHANGELOG.md, ACCESSIBILITY.md, README.md, docs/HELP.md, website/, version fields. Re-run what you fixed. Report per-issue (ids INT-1, INT-2…).',
    { label: 'integrate:fix-' + round, schema: FIXREPORT }
  )
  if (fixer) fixer.results.forEach(x => allResults.push({ ...x, group: 'integration' }))
  integration = await agent(INTEGRATION_PROMPT, { label: 'integrate:run-' + (round + 1), schema: INTEGRATION })
  round++
}
log('Integration: ' + (integration && integration.pass ? 'GREEN — ' + integration.log : 'STILL FAILING after ' + (round - 1) + ' rounds (surface to human)'))

phase('Check')
log('Per-finding completion verification')
const checks = await parallel(GROUPS.map(g => () =>
  agent(
    'You are a completion checker for the accessibility-pass in ' + REPO + '. Read ' + DIR + 'work/' + g.key + '.json. For every finding with primaryHere=true, verify in the CURRENT code that the fix is actually implemented (read the cited file; grep for the expected attribute/handler/token; do not trust reports). Owned files: ' + g.files + '. For cross-file findings judge only the portion in those files. Skip the county/date aria-label findings in SpeciesDetail/LifeList/BreedingCodeList — already done. One result per primary F-ID: fixed true/false + one-line note. Do not modify anything.',
    { label: 'check:' + g.key, phase: 'Check', schema: CHECK }
  )
))
const unfixed = []
checks.forEach((c, i) => { if (c) c.results.forEach(r => { if (!r.fixed) unfixed.push({ ...r, group: GROUPS[i].key }) }) })
log(unfixed.length + ' findings reported unfixed' + (unfixed.length ? ': ' + unfixed.map(u => u.id).join(', ') : ''))

if (unfixed.length) {
  const byGroup = {}
  unfixed.forEach(u => { (byGroup[u.group] = byGroup[u.group] || []).push(u) })
  const rem = await parallel(Object.entries(byGroup).map(([gk, items]) => () => {
    const g = GROUPS.find(x => x.key === gk)
    return agent(
      CONVENTIONS + '\nYou are the remediation fixer for group ' + gk + ' in ' + REPO + '. Owned files: ' + (g ? g.files : '') + '. A completion check found these NOT fully fixed:\n' +
      items.map(u => '- ' + u.id + ': ' + u.note).join('\n') + '\n\nFull detail: ' + DIR + 'work/' + gk + '.json. Finish the fixes (or return blocked with a precise reason). Run targeted tests. Report per F-ID.',
      { label: 'remediate:' + gk, phase: 'Check', schema: FIXREPORT }
    )
  }))
  rem.filter(Boolean).forEach(r => r.results.forEach(x => allResults.push({ ...x, group: 'remediation' })))
  integration = await agent(INTEGRATION_PROMPT, { label: 'integrate:post-remediation', schema: INTEGRATION })
  log('Post-remediation integration: ' + (integration && integration.pass ? 'GREEN' : 'FAILING — surface to human'))
}

phase('Docs')
const blocked = allResults.filter(x => x.status === 'blocked' || x.status === 'skipped')
const docsReport = await agent(
  CONVENTIONS + '\nYou are the DOCS agent for the accessibility-pass in ' + REPO + '. You own: ACCESSIBILITY.md, CHANGELOG.md, README.md, docs/HELP.md, the version fields of frontend/package.json and src-tauri/tauri.conf.json, and (only if README/HELP materially change) website/.\n\n' +
  'The fix wave landed (inspect with git diff --stat and git diff; do NOT commit). Tasks:\n' +
  '1. REWRITE ' + REPO + '/ACCESSIBILITY.md so every claim is TRUE of the code as it now stands. The audit found five false claims (filter-panel focus restore, filter-pill pressed states, Nearest Targets view-scoping, keyboard-reach exceptions, contrast) — verify each fix in the diff before claiming it. Keep the existing warm, factual voice. Known-exceptions section: honestly list any user-visible skipped/blocked items: ' + (blocked.length ? blocked.map(b => b.id + ' (' + b.note + ')').join('; ') : '(none)') + '. The pass-lists in ' + DIR + 'passes.json help describe what holds.\n' +
  '2. Bump version to 0.5.31 in BOTH frontend/package.json AND src-tauri/tauri.conf.json (patch).\n' +
  '3. CHANGELOG.md: create the 0.5.31 section — fold the existing [Unreleased] content in (it rides this release) and add the accessibility entry summarized BY THEME (named controls, contrast retune, keyboard/focus, announcements, maps, resize, structure), not 100+ bullets.\n' +
  '4. README.md and docs/HELP.md: update only what the fixes made stale (e.g. Settings tab reorder now has keyboard Move buttons).\n' +
  '5. website/: touch ONLY if README/HELP changed materially; else say so in flags.\n' +
  'Report files changed and any flags.',
  { label: 'docs', schema: DOCS }
)
log('Docs: ' + (docsReport ? docsReport.summary : 'DOCS AGENT FAILED'))

const finalTally = {}
allResults.forEach(x => finalTally[x.status] = (finalTally[x.status] || 0) + 1)
return {
  tally: finalTally,
  perGroup: fixReports.map((r, i) => ({ group: GROUPS[i].key, summary: r ? r.summary : 'AGENT FAILED' })),
  blockedOrSkipped: blocked,
  unfixedAfterCheck: unfixed.map(u => u.id),
  integrationGreen: !!(integration && integration.pass),
  integrationLog: integration ? integration.log : 'no final run',
  integrationFailures: integration && !integration.pass ? integration.failures : null,
  failedGroups,
  docs: docsReport,
  results: allResults,
}
