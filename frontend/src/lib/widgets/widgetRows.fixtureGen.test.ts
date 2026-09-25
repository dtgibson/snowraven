/// <reference types="node" />
// GENERATES widgetRows.fixture.json (ios-lifer-widgets, schema.md section 7).
// Env-gated: runs only under SR_GEN_WIDGET_FIXTURE=1, and otherwise reports
// itself skipped. Every expected value is produced by the SHIPPED TypeScript
// twin over the hand-authored inputs in widgetRows.fixtureInputs.ts (testing.md
// v1.0.29). The Swift `Logic/` sources reproducing every family from the same
// inputs IS the parity claim; widgetRows.parity.test.ts re-derives every family
// on each CI run so the tracked file cannot drift from the twin unnoticed.
//
//   cd frontend && SR_GEN_WIDGET_FIXTURE=1 npx vitest run src/lib/widgets/widgetRows.fixtureGen.test.ts
import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { buildWidgetFixture } from './widgetRows.fixtureBuild'

describe.skipIf(process.env.SR_GEN_WIDGET_FIXTURE !== '1')('widget parity fixture generator', () => {
  it('writes widgetRows.fixture.json from the shipped twin', () => {
    const fixture = buildWidgetFixture()
    const text = JSON.stringify(fixture, null, 1) + '\n'
    writeFileSync(new URL('./widgetRows.fixture.json', import.meta.url), text)
    expect(text.length).toBeGreaterThan(1000)
  })
})
