// @vitest-environment jsdom
//
// The share popup: the copy result (QA-33), the honest failure state (QA-34),
// the mode reaching an already-open popup (QA-35 / QA-36), the live region, and
// the single close path. Stubs the map deps — no maplibre-gl, no WebGL.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'

const copyText = vi.hoisted(() => vi.fn())
const getSetting = vi.hoisted(() => vi.fn())
const setSetting = vi.hoisted(() => vi.fn())
const popupProps = vi.hoisted(() => [] as Record<string, unknown>[])

// The compact body cap is measured from the map, so the fake reports a map
// height and where the pin projects inside it.
const mapBox = vi.hoisted(() => ({ height: 220, pinY: 110 }))
const fakeMap = vi.hoisted(() => ({
  getContainer: () => ({ get clientHeight() { return mapBox.height } }),
  project: () => ({ x: 0, y: mapBox.pinY }),
  on: () => {},
  off: () => {},
}))

vi.mock('../../lib/clipboard', () => ({ copyText }))
vi.mock('../../lib/storage', () => ({ storage: { getSetting, setSetting } }))
vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: fakeMap }),
  Popup: (props: Record<string, unknown>) => {
    popupProps.push(props)
    return <div data-testid="popup">{props.children as ReactNode}</div>
  },
}))

import { SharePopup } from './SharePopup'
import { setShareCopyMode } from '../../lib/shareCopyPreference'

beforeEach(() => {
  copyText.mockReset().mockResolvedValue(true)
  getSetting.mockReset().mockResolvedValue(null)
  setSetting.mockReset().mockResolvedValue(undefined)
  popupProps.length = 0
  mapBox.height = 220   // the Named Birds card map (.sr-named-map)
  mapBox.pinY = 110     // worst case: dead centre, least room on either side
  // Every case starts from the default mode; the store is module-level.
  setShareCopyMode('coords-and-links')
})
afterEach(() => { cleanup(); vi.useRealTimers() })

const LAT = 38.54321
const LNG = -121.98765
const THREE_LINE =
  '38.54321, -121.98765\n'
  + 'Google Maps: https://maps.google.com/?q=38.54321,-121.98765\n'
  + 'Apple Maps: https://maps.apple.com/?q=38.54321,-121.98765'

function mount(overrides: Partial<React.ComponentProps<typeof SharePopup>> = {}) {
  const onClose = overrides.onClose ?? vi.fn()
  render(<SharePopup lat={LAT} lng={LNG} compact={false} offset={35} {...overrides} onClose={onClose} />)
  return { onClose }
}

describe('SharePopup contents (FR-08 / FR-30)', () => {
  it('shows the coordinates as text, a copy control, and a close control', () => {
    mount()
    expect(screen.getByText('38.54321, -121.98765')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy coordinates and links' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close and remove the pin' })).toBeTruthy()
  })

  it('names the ACTIVE mode on the button and in the mode line, before any press (QA-36)', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Copy coordinates and links' })).toBeTruthy()
    expect(screen.getByText('With Google Maps and Apple Maps links.')).toBeTruthy()
  })

  it('renders the live region from the start, empty, so its later text is announced', () => {
    const { container } = render(<SharePopup lat={LAT} lng={LNG} compact={false} offset={35} onClose={vi.fn()} />)
    const region = container.querySelector('[role="status"]')
    expect(region).toBeTruthy()
    expect(region!.textContent).toBe('')
  })

  it('mounts the maplibre popup with our own close button and no click-to-dismiss', () => {
    mount()
    const props = popupProps.at(-1)!
    // Our close button carries the honest name; maplibre hardcodes "Close popup".
    expect(props.closeButton).toBe(false)
    // A stray map click must not destroy the pin.
    expect(props.closeOnClick).toBe(false)
  })
})

describe('copy success (FR-25 / FR-26 / FR-27, QA-33)', () => {
  it('writes the exact three-line payload through the clipboard SEAM', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Copy coordinates and links' }))
    await waitFor(() => expect(copyText).toHaveBeenCalledTimes(1))
    expect(copyText).toHaveBeenCalledWith(THREE_LINE)
  })

  it('shows a Copied confirmation, announces it, and settles back after about two seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { container } = render(<SharePopup lat={LAT} lng={LNG} compact={false} offset={35} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy coordinates and links' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy())
    expect(container.querySelector('[role="status"]')!.textContent)
      .toBe('Location copied to the clipboard.')

    await act(async () => { vi.advanceTimersByTime(2100) })
    expect(screen.getByRole('button', { name: 'Copy coordinates and links' })).toBeTruthy()
  })

  it('announces EVERY copy, including a repeat of the IDENTICAL message (QA-33)', async () => {
    // The bug this locks: setting a live region's state to the string it already
    // holds makes React bail out, so the region's DOM never mutates and
    // assistive tech says nothing the second time. The visible confirmation
    // re-rendered every press, which is exactly what made it easy to miss.
    // Measured as DOM mutations rather than reasoned about.
    const { container } = render(<SharePopup lat={LAT} lng={LNG} compact={false} offset={35} onClose={vi.fn()} />)
    const region = container.querySelector('[role="status"]')!

    let mutations = 0
    const observer = new MutationObserver(records => { mutations += records.length })
    observer.observe(region, { childList: true, characterData: true, subtree: true })

    const btn = screen.getByRole('button', { name: 'Copy coordinates and links' })

    fireEvent.click(btn)
    await waitFor(() => expect(mutations).toBeGreaterThan(0))
    const afterFirst = mutations
    expect(region.textContent).toBe('Location copied to the clipboard.')

    // Same button, same coordinate, same mode: byte-identical message.
    fireEvent.click(btn)
    await waitFor(() => expect(mutations).toBeGreaterThan(afterFirst))

    observer.disconnect()
    // The region still reads exactly the message: the repeat is carried by a
    // node replacement, not by smuggling an invisible character into the text.
    expect(region.textContent).toBe('Location copied to the clipboard.')
  })

  it('keeps the ONE live region mounted throughout, never remounting it with its text', async () => {
    const { container } = render(<SharePopup lat={LAT} lng={LNG} compact={false} offset={35} onClose={vi.fn()} />)
    const region = container.querySelector('[role="status"]')!
    fireEvent.click(screen.getByRole('button', { name: 'Copy coordinates and links' }))
    await waitFor(() => expect(region.textContent).toBe('Location copied to the clipboard.'))
    // Same node object, still in the document: the region pre-existed its text.
    expect(container.querySelector('[role="status"]')).toBe(region)
    expect(region.isConnected).toBe(true)
  })

  it('never shows the failure block on a successful copy', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Copy coordinates and links' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy())
    expect(screen.queryByText('Text to copy')).toBeNull()
  })
})

describe('copy failure (FR-28, QA-34)', () => {
  it('is honest: no success claim, an explicit message, and the FULL payload revealed', async () => {
    copyText.mockResolvedValue(false)
    const { container } = render(<SharePopup lat={LAT} lng={LNG} compact={false} offset={35} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy coordinates and links' }))

    await waitFor(() => expect(
      screen.getByText('Could not copy automatically. Select the text below and copy it.'),
    ).toBeTruthy())

    // The button never claims success.
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy coordinates and links' })).toBeTruthy()

    // The complete payload, verbatim, selectable.
    const pre = container.querySelector('pre.sr-share-payload')!
    expect(pre.textContent).toBe(THREE_LINE)

    expect(container.querySelector('[role="status"]')!.textContent)
      .toBe('Could not copy. The text is shown so you can copy it manually.')
  })

  it('offers Select all, which uses the Selection API and makes NO clipboard call', async () => {
    copyText.mockResolvedValue(false)
    const { container } = render(<SharePopup lat={LAT} lng={LNG} compact={false} offset={35} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy coordinates and links' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Select all' })).toBeTruthy())

    copyText.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))

    // It cannot fail the way the copy just did, because it never calls the seam.
    expect(copyText).not.toHaveBeenCalled()
    expect(container.querySelector('[role="status"]')!.textContent)
      .toBe("Text selected. Copy it with your device's copy command.")
  })
})

describe('the mode in effect at press time (FR-29 / FR-36, QA-35)', () => {
  it('a preference change relabels an ALREADY-OPEN popup and changes what the next press copies', async () => {
    mount()
    expect(screen.getByRole('button', { name: 'Copy coordinates and links' })).toBeTruthy()

    act(() => { setShareCopyMode('coords-only') })

    expect(screen.getByRole('button', { name: 'Copy coordinates' })).toBeTruthy()
    expect(screen.getByText('Coordinates only.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Copy coordinates' }))
    await waitFor(() => expect(copyText).toHaveBeenCalledTimes(1))
    expect(copyText).toHaveBeenCalledWith('38.54321, -121.98765')
  })

  it('a mode change clears a stale failure block, whose payload would be the wrong text', async () => {
    copyText.mockResolvedValue(false)
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Copy coordinates and links' }))
    await waitFor(() => expect(screen.getByText('Text to copy')).toBeTruthy())

    act(() => { setShareCopyMode('coords-only') })
    expect(screen.queryByText('Text to copy')).toBeNull()
  })
})

describe('the single close path (FR-09 / FR-40)', () => {
  it('the close control routes through onClose', () => {
    const { onClose } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Close and remove the pin' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape routes through the SAME onClose', () => {
    const { onClose } = mount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a non-Escape key does not close it', () => {
    const { onClose } = mount()
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('unbinds its Escape listener on unmount, so a closed popup cannot swallow Escape', () => {
    const onClose = vi.fn()
    const { unmount } = render(<SharePopup lat={LAT} lng={LNG} compact={false} offset={35} onClose={onClose} />)
    unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('compact density (D-07)', () => {
  it('reduces size but keeps every label, the mode line and the failure controls', async () => {
    copyText.mockResolvedValue(false)
    const { container } = render(<SharePopup lat={LAT} lng={LNG} compact offset={30} onClose={vi.fn()} />)
    expect(popupProps.at(-1)!.className).toContain('sr-share-popup--compact')

    fireEvent.click(screen.getByRole('button', { name: 'Copy coordinates and links' }))
    await waitFor(() => expect(screen.getByText('Text to copy')).toBeTruthy())

    expect(screen.getByText('With Google Maps and Apple Maps links.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Select all' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close and remove the pin' })).toBeTruthy()
    expect(container.querySelector('pre.sr-share-payload')!.textContent).toBe(THREE_LINE)
  })

  it('the NON-compact body carries the shared .sr-map-popup-body scroll cap (NFR-06)', () => {
    const { container } = render(<SharePopup lat={LAT} lng={LNG} compact={false} offset={35} onClose={vi.fn()} />)
    expect(container.querySelector('.sr-share-pop-body.sr-map-popup-body')).toBeTruthy()
  })
})

// The compact popup has to fit a FIXED 220px card map that clips (.sr-named-map
// carries overflow: hidden), so its scroll cap is measured from the map rather
// than derived from the font size.
describe('the compact scroll cap fits the map it is in (NFR-06)', () => {
  const bodyCap = (container: HTMLElement) =>
    (container.querySelector('.sr-share-pop-body') as HTMLElement).style.getPropertyValue('--sr-share-body-cap')

  function mountCompact() {
    return render(<SharePopup lat={LAT} lng={LNG} compact offset={30} onClose={vi.fn()} />)
  }

  it('shrinks to the room available on a 220px card map with the pin dead centre', () => {
    // room = max(110 - 30, 220 - 110 - 30) - 8 = 72; cap = 72 - 44 chrome = 28,
    // floored at the 44px touch target. The old 9.5rem cap was 152px here, which
    // is how a ~195px popup ended up in ~80px of room.
    const { container } = mountCompact()
    expect(bodyCap(container)).toBe('44px')
  })

  it('takes the extra room when the pin sits near an edge', () => {
    mapBox.pinY = 40 // plenty of room below
    const { container } = mountCompact()
    // room = max(10, 150) - 8 = 142; cap = 142 - 44 = 98
    expect(bodyCap(container)).toBe('98px')
  })

  it('never exceeds the designed maximum, however tall the map is', () => {
    mapBox.height = 900
    mapBox.pinY = 450
    const { container } = mountCompact()
    expect(bodyCap(container)).toBe('152px')
  })

  it('is expressed in PX, so 200% in-app text scale cannot double it on a card that never grows', () => {
    const { container } = mountCompact()
    const cap = bodyCap(container)
    expect(cap).toMatch(/^\d+px$/)
    expect(cap).not.toContain('rem')
  })

  it('leaves the non-compact popup unmeasured, on the shared viewport-relative cap', () => {
    const { container } = render(<SharePopup lat={LAT} lng={LNG} compact={false} offset={35} onClose={vi.fn()} />)
    expect(bodyCap(container)).toBe('')
  })

  it('keeps the failure block and Select all INSIDE that capped, scrollable body', async () => {
    copyText.mockResolvedValue(false)
    const { container } = mountCompact()
    fireEvent.click(screen.getByRole('button', { name: 'Copy coordinates and links' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Select all' })).toBeTruthy())

    const body = container.querySelector('.sr-share-pop-body')!
    // Reachable by scrolling rather than clipped away by the map's overflow.
    expect(body.contains(screen.getByRole('button', { name: 'Select all' }))).toBe(true)
    expect(body.contains(container.querySelector('pre.sr-share-payload')!)).toBe(true)
    expect(body.contains(screen.getByRole('button', { name: 'Copy coordinates and links' }))).toBe(true)
  })
})
