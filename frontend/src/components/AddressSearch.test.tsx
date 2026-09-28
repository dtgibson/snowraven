// @vitest-environment jsdom
// The shared place-name search (Map Explorer's sidebars and the Targets tab's
// measuring-point chooser; targets-tab design-spec 2a, QA-53a).
//
// The claims: SUBMIT-ONLY (typing sends nothing; Enter or Search sends one
// request), ONE REQUEST PER PRESS (a press while one is outstanding sends
// nothing), the ANSWER IS VALIDATED (a malformed body is "No location found",
// never a NaN handed onward), offline reads as offline, and the Map Explorer
// register renders the markup it shipped with.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const H = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../lib/transport', () => ({ transport: { get: H.get }, TransportError: class extends Error {} }))

import { AddressSearch } from './AddressSearch'
import { PLACE_NOT_FOUND, PLACE_SEARCH_FAILED } from '../lib/placeSearch'
import { OFFLINE_MESSAGE } from '../lib/offlineMessage'

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

beforeEach(() => { H.get.mockReset() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const field = () => screen.getByRole('textbox', { name: 'Search by place name' })
const go = () => screen.getByRole('button', { name: 'Search' })
const HINT = 'A hint.'

describe.each([
  ['Map Explorer register', undefined],
  ['chooser register', HINT],
] as const)('%s', (_label, hint) => {
  it('typing sends nothing; Enter sends exactly one request, for the trimmed query', async () => {
    const onLocate = vi.fn()
    H.get.mockResolvedValue([{ lat: '37.68', lon: '-121.77' }])
    render(<AddressSearch onLocate={onLocate} hint={hint} />)
    for (const v of ['L', 'Li', 'Liver', ' Livermore  ']) fireEvent.change(field(), { target: { value: v } })
    expect(H.get).not.toHaveBeenCalled()
    fireEvent.keyDown(field(), { key: 'Enter' })
    await waitFor(() => expect(onLocate).toHaveBeenCalledWith(37.68, -121.77, 'Livermore'))
    expect(H.get).toHaveBeenCalledTimes(1)
    expect(H.get).toHaveBeenCalledWith('/nominatim/search', { q: 'Livermore' })
  })

  it('a second press while one is outstanding sends nothing', async () => {
    const gate = deferred<unknown>()
    H.get.mockReturnValueOnce(gate.promise)
    const onLocate = vi.fn()
    render(<AddressSearch onLocate={onLocate} hint={hint} />)
    fireEvent.change(field(), { target: { value: 'Livermore' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    fireEvent.keyDown(field(), { key: 'Enter' })
    fireEvent.click(go())
    expect(H.get).toHaveBeenCalledTimes(1)
    gate.resolve([{ lat: '1', lon: '2' }])
    await waitFor(() => expect(onLocate).toHaveBeenCalledTimes(1))
  })

  it.each([
    ['an empty list', []],
    ['a body that is not a list', { error: 'x' }],
    // Array-like but not a list: only the Array.isArray check refuses it (the
    // first-result object check would accept its [0]).
    ['an array-like object that is not a list', { length: 1, 0: { lat: '1', lon: '2' } }],
    ['a first result that is not an object', [null]],
    ['a non-numeric latitude', [{ lat: 'abc', lon: '1' }]],
    ['an out-of-range longitude', [{ lat: '1', lon: '181' }]],
    ['missing coordinates', [{ display_name: 'X' }]],
  ])('%s is "No location found", and nothing is located', async (_l, body) => {
    const onLocate = vi.fn()
    H.get.mockResolvedValue(body)
    render(<AddressSearch onLocate={onLocate} hint={hint} />)
    fireEvent.change(field(), { target: { value: 'Nowhere' } })
    fireEvent.click(go())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(PLACE_NOT_FOUND))
    expect(onLocate).not.toHaveBeenCalled()
  })

  it('offline reads as offline, never as a miss or a failure', async () => {
    // With the device offline (jsdom reports online, which on web/Pi reads a
    // connection failure as "can't reach the SnowRaven server").
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    H.get.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<AddressSearch onLocate={() => {}} hint={hint} />)
    fireEvent.change(field(), { target: { value: 'Livermore' } })
    fireEvent.click(go())
    await waitFor(() => expect(screen.getByRole('alert').textContent).not.toBe(''))
    const text = screen.getByRole('alert').textContent
    expect(text).not.toBe(PLACE_NOT_FOUND)
    expect(text).not.toBe(PLACE_SEARCH_FAILED)
    expect(text).toBe(OFFLINE_MESSAGE)
  })
})

describe('the chooser register (design-spec 2a)', () => {
  it('shows the hint until a miss replaces it, in an alert region mounted before the message, and keeps focus in the field', async () => {
    H.get.mockResolvedValue([])
    render(<AddressSearch onLocate={() => {}} hint={HINT} />)
    const region = screen.getByRole('alert')
    expect(region.textContent).toBe('')
    expect(screen.getByText(HINT)).toBeTruthy()
    expect(field().getAttribute('aria-describedby')).toBe(screen.getByText(HINT).id)
    fireEvent.change(field(), { target: { value: 'Nowhere' } })
    go().focus()
    fireEvent.click(go())
    await waitFor(() => expect(region.textContent).toBe(PLACE_NOT_FOUND))
    // The same node: a region created with its first message is not announced.
    expect(screen.getByRole('alert')).toBe(region)
    expect(screen.queryByText(HINT)).toBeNull()
    expect(document.activeElement).toBe(field())
    // A repeated miss is a real node replacement, so it is announced again.
    const first = region.firstElementChild
    fireEvent.click(go())
    await waitFor(() => expect(region.firstElementChild).not.toBe(first))
    expect(region.textContent).toBe(PLACE_NOT_FOUND)
  })

  it('the Search button is native-disabled only while the field is empty, aria-disabled while a search runs', async () => {
    const gate = deferred<unknown>()
    H.get.mockReturnValueOnce(gate.promise)
    render(<AddressSearch onLocate={() => {}} hint={HINT} />)
    expect((go() as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(field(), { target: { value: 'x' } })
    expect((go() as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(go())
    await waitFor(() => expect(go().getAttribute('aria-disabled')).toBe('true'))
    expect((go() as HTMLButtonElement).disabled).toBe(false)
    gate.resolve([{ lat: '1', lon: '2' }])
  })

  it('a caller-supplied failure line replaces Map Explorer\'s coordinate advice', async () => {
    H.get.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }))
    render(<AddressSearch onLocate={() => {}} hint={HINT} failedMessage="Location search failed. Try again." />)
    fireEvent.change(field(), { target: { value: 'x' } })
    fireEvent.click(go())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Location search failed. Try again.'))
  })
})

describe('the Map Explorer register renders the markup it shipped with', () => {
  it('inline-styled field and button, no hint, no alert until a message', async () => {
    H.get.mockResolvedValue([])
    const { container } = render(<AddressSearch onLocate={() => {}} />)
    expect(container.querySelector('.sr-tg-apop-search')).toBeNull()
    expect((field() as HTMLInputElement).style.height).toBe('34px')
    expect(go().style.width).toBe('34px')
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.change(field(), { target: { value: 'x' } })
    fireEvent.click(go())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(PLACE_NOT_FOUND))
    expect(PLACE_NOT_FOUND).toBe('No location found. Try a different search term.')
  })
})
