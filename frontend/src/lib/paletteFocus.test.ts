// @vitest-environment jsdom
//
// Where focus goes when the command palette closes (FR-12, QA-12).
//
// The ONE property this exists to hold: focus never lands on `<body>`. Every
// branch of the liveness gate is exercised, and the four returned labels are
// what let a test assert the BRANCH rather than only the outcome -- so a gate
// that happened to reach the right element for the wrong reason still fails.
import { describe, it, expect, beforeEach } from 'vitest'
import { restoreOpenerFocus } from './paletteFocus'

function mount(html: string): HTMLElement {
  document.body.innerHTML = html
  return document.body
}
const byId = (id: string) => document.getElementById(id) as HTMLElement

beforeEach(() => { document.body.innerHTML = '' })

describe('the liveness gate, in order', () => {
  it('uses the trigger when it is present, enabled and not inert', () => {
    mount('<button id="opener">Search</button><main id="fallback" tabindex="-1"></main>')
    expect(restoreOpenerFocus({ trigger: () => byId('opener') }, byId('fallback'))).toBe('trigger')
    expect(document.activeElement).toBe(byId('opener'))
  })

  it('falls through when the trigger has UNMOUNTED (the More sheet case, FR-08)', () => {
    // The sheet's search row goes with the sheet, so its element is detached by
    // the time the palette closes. `document.contains` is what catches that; a
    // detached element accepts .focus() silently and leaves activeElement on
    // <body>, which is precisely the failure this returns a label for.
    mount('<button id="fallback-btn">More</button><main id="final" tabindex="-1"></main>')
    const detached = document.createElement('button')
    const branch = restoreOpenerFocus(
      { trigger: () => detached, fallback: () => byId('fallback-btn') },
      byId('final'),
    )
    expect(branch).toBe('fallback')
    expect(document.activeElement).toBe(byId('fallback-btn'))
  })

  it('falls through when the trigger is DISABLED', () => {
    mount('<button id="opener" disabled>Search</button><main id="final" tabindex="-1"></main>')
    expect(restoreOpenerFocus({ trigger: () => byId('opener') }, byId('final'))).toBe('final')
    expect(document.activeElement).toBe(byId('final'))
  })

  it('falls through when the trigger sits inside an INERT subtree (FR-14)', () => {
    // The case the palette creates and nothing else in the app does: it is fully
    // operable over a fullscreen Map Explorer, which marks the whole navigation
    // inert. A nav control that opened the palette before the map went
    // fullscreen is in the DOM, is not disabled, and cannot take focus -- so
    // focusing it would silently drop focus to <body>.
    mount('<nav inert><button id="opener">Search</button></nav><main id="final" tabindex="-1"></main>')
    expect(restoreOpenerFocus({ trigger: () => byId('opener') }, byId('final'))).toBe('final')
    expect(document.activeElement).toBe(byId('final'))
  })

  it('applies the SAME gate to the opener\'s own fallback', () => {
    // Non-vacuity for the branch above: the gate is not a special case for the
    // trigger. An inert fallback is skipped too, and the final one is used.
    mount('<nav inert><button id="a">a</button><button id="b">b</button></nav><main id="final" tabindex="-1"></main>')
    const branch = restoreOpenerFocus(
      { trigger: () => byId('a'), fallback: () => byId('b') },
      byId('final'),
    )
    expect(branch).toBe('final')
  })

  it('uses the final fallback when there is no opener at all', () => {
    mount('<main id="final" tabindex="-1"></main>')
    expect(restoreOpenerFocus(null, byId('final'))).toBe('final')
    expect(document.activeElement).toBe(byId('final'))
  })

  it('REJECTS <body> as a trigger, which is what the chord captures most of the time', () => {
    // MEASURED, not reasoned about. `document.activeElement` is `<body>`
    // whenever nothing in the page holds focus -- an ordinary state after a
    // fresh load or a click on non-interactive content -- and the chord captures
    // its opener eagerly from exactly that property. `<body>` is in the
    // document, is not disabled and is not inert, so every other clause of the
    // gate admits it; focusing it leaves focus precisely where FR-12 forbids it
    // to be. A Chromium and WebKit probe caught the restore reporting success
    // with focus sitting on `<body>`.
    mount('<main id="final" tabindex="-1"></main>')
    expect(restoreOpenerFocus({ trigger: () => document.body }, byId('final'))).toBe('final')
    expect(document.activeElement).toBe(byId('final'))
  })

  it('rejects <html> for the same reason', () => {
    mount('<main id="final" tabindex="-1"></main>')
    expect(restoreOpenerFocus({ trigger: () => document.documentElement }, byId('final'))).toBe('final')
  })

  it('falls through when the engine REFUSES the focus, whatever the reason', () => {
    // The general backstop behind the enumerated rejections: a candidate that
    // silently declines focus for a reason nobody listed falls through rather
    // than ending the restore on nothing. Enumerating those reasons would be a
    // PREDICTION about an engine, and this app has already paid once for
    // predicting focus behaviour instead of observing it.
    mount('<button id="stubborn">no</button><main id="final" tabindex="-1"></main>')
    const stubborn = byId('stubborn')
    stubborn.focus = () => {}          // accepts the call, takes no focus
    expect(restoreOpenerFocus({ trigger: () => stubborn }, byId('final'))).toBe('final')
    expect(document.activeElement).toBe(byId('final'))
  })

  it('reports NONE rather than guessing when nothing is focusable', () => {
    // Only reachable if <main> itself were gone. Nothing is focused, because
    // there is nowhere honest to put it -- and the label says so rather than the
    // caller having to infer it from focus having not moved.
    mount('')
    expect(restoreOpenerFocus(null, null)).toBe('none')
  })
})

describe('the property FR-12 actually states', () => {
  const CASES: { name: string; html: string; opener: () => HTMLElement | null }[] = [
    { name: 'a live trigger', html: '<button id="o">o</button><main id="m" tabindex="-1"></main>', opener: () => byId('o') },
    { name: 'an unmounted trigger', html: '<main id="m" tabindex="-1"></main>', opener: () => document.createElement('button') },
    { name: 'a disabled trigger', html: '<button id="o" disabled></button><main id="m" tabindex="-1"></main>', opener: () => byId('o') },
    { name: 'an inert trigger', html: '<nav inert><button id="o"></button></nav><main id="m" tabindex="-1"></main>', opener: () => byId('o') },
    { name: 'a null trigger', html: '<main id="m" tabindex="-1"></main>', opener: () => null },
    { name: 'the body element itself', html: '<main id="m" tabindex="-1"></main>', opener: () => document.body },
  ]

  it.each(CASES.map(c => [c.name, c] as const))(
    'focus never lands on <body> with %s',
    (_label, c) => {
      mount(c.html)
      restoreOpenerFocus({ trigger: c.opener }, byId('m'))
      expect(document.activeElement).not.toBe(document.body)
      expect(document.activeElement).toBeTruthy()
    },
  )
})
