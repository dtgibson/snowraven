/// <reference types="node" />
// GENERATES alertRules.fixture.json (ios-alerts, schema.md 8.3). Env-gated:
// runs only under SR_GEN_ALERT_FIXTURE=1 and otherwise reports itself skipped.
// Every expected value is produced by the SHIPPED TypeScript twin over the
// hand-authored inputs in alertRules.fixtureInputs.ts (testing.md v1.0.29).
// The Swift `AlertsLogic/` reproducing every family from the same inputs IS
// the parity claim; alertRules.parity.test.ts re-derives the file on every CI
// run so it cannot drift from the twin unnoticed.
//
//   cd frontend && SR_GEN_ALERT_FIXTURE=1 npx vitest run src/lib/alerts/alertRules.fixtureGen.test.ts
import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { buildAlertFixture } from './alertRules.fixtureBuild'

describe.skipIf(process.env.SR_GEN_ALERT_FIXTURE !== '1')('alert rules parity fixture generator', () => {
  it('writes alertRules.fixture.json from the shipped twin', () => {
    const text = JSON.stringify(buildAlertFixture(), null, 1) + '\n'
    writeFileSync(new URL('./alertRules.fixture.json', import.meta.url), text)
    expect(text.length).toBeGreaterThan(1000)
  })
})
