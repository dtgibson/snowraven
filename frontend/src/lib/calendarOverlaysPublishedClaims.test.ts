// The Calendar overlays' published claims in docs/HELP.md, held to the code
// (calendar-overlays, FR-34, QA-39). The house pattern for a feature that adds
// help sentences (.claude/rules/docs-and-website.md; palettePublishedClaims is
// the shape): scope to the feature's own passage, assert the passage EXISTS
// before checking what it says (deleting it is the move a hurried edit reaches
// for), build every matcher from the imported constant, and publish the
// PROPERTY rather than the count.
//
// README.md and website/ carry no overlays sentence: a feature build may only
// PROPOSE one (pipeline/calendar-overlays/copy-proposal.md) and it lands after
// the user approves it. When it does, extend this roster with that passage.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  OVERLAYS_GROUP_LABEL, MEDIA_SWITCH_LABEL, BREEDING_SWITCH_LABEL, CODES_OPTIONS, TILE_CODE_ROW_CAP,
} from './calendarOverlays'
import { BREEDING_CATEGORY_LABELS } from './breedingCodes'

const help = readFileSync(new URL('../../../docs/HELP.md', import.meta.url), 'utf8')

/** A `###` subsection, heading to the next `##` or `###`. */
function subsection(heading: string): string {
  const start = help.indexOf(`\n### ${heading}\n`)
  expect(start, `docs/HELP.md has a \`### ${heading}\` subsection`).toBeGreaterThan(-1)
  const rest = help.slice(start + 1)
  const end = rest.slice(1).search(/\n#{2,3} /)
  return end === -1 ? rest : rest.slice(0, end + 1)
}

const overlays = subsection('Overlays: media and breeding')
const popup = subsection('The day popup')

describe('docs/HELP.md describes the Calendar overlays as shipped (QA-39)', () => {
  it('the passage exists, inside the Calendar section, before the day popup', () => {
    expect(overlays.length).toBeGreaterThan(600)
    const cal = help.indexOf('\n## Calendar\n')
    const next = help.indexOf('\n## ', cal + 1)
    const at = help.indexOf('\n### Overlays: media and breeding\n')
    expect(cal).toBeGreaterThan(-1)
    expect(at).toBeGreaterThan(cal)
    expect(at).toBeLessThan(next)
    expect(at).toBeLessThan(help.indexOf('\n### The day popup\n'))
  })

  it('names every control by its on-screen label, read from the constants', () => {
    for (const label of [OVERLAYS_GROUP_LABEL, MEDIA_SWITCH_LABEL, BREEDING_SWITCH_LABEL, ...CODES_OPTIONS.map(o => o.label)]) {
      expect(overlays, `the passage names "${label}"`).toContain(`**${label}**`)
    }
  })

  it('names the three categories and says the category is carried by shape, not color', () => {
    for (const cat of Object.values(BREEDING_CATEGORY_LABELS)) expect(overlays).toContain(`**${cat}**`)
    expect(overlays).toMatch(/without relying on color/)
    expect(overlays).toMatch(/solid for \*\*Confirmed\*\*, half-filled for \*\*Probable\*\*, open for \*\*Possible\*\*/)
  })

  it('says both overlays are off by default and the choices are remembered across launches, never per-session', () => {
    expect(overlays).toMatch(/\*\*off by default\*\*/)
    expect(overlays).toMatch(/\*\*remembered across launches\*\*/)
    expect(overlays).not.toMatch(/per-session|resetting on relaunch/)
  })

  it('publishes the row cap as a property (+N), never as a number', () => {
    expect(overlays).toContain('**+N**')
    const words = ['zero', 'one', 'two', 'three', 'four', 'five']
    const capWord = words[TILE_CODE_ROW_CAP]
    expect(overlays).not.toMatch(new RegExp(`\\b(${TILE_CODE_ROW_CAP}|${capWord}) codes\\b`, 'i'))
  })

  it('the day popup passage says it always lists every code, whatever the codes choice', () => {
    expect(popup).toMatch(/always lists every code/)
    for (const o of CODES_OPTIONS) expect(popup).toContain(o.label)
  })

  it('carries no em dash (U+2014) in either passage', () => {
    expect(overlays).not.toContain('—')
    expect(popup).not.toContain('—')
  })
})
