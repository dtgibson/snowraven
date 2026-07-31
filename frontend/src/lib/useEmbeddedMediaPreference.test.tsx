// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEmbeddedMediaPreference } from './useEmbeddedMediaPreference'

afterEach(cleanup)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

type PreferenceAdapter = {
  getSetting<T>(key: string): Promise<T | null>
  setSetting<T>(key: string, value: T): Promise<void>
}

function PreferenceHarness({ adapter }: { adapter: PreferenceAdapter }) {
  const preference = useEmbeddedMediaPreference(adapter)
  return (
    <div>
      <output data-testid="value">{preference.disableEmbeddedMedia === null ? 'loading' : String(preference.disableEmbeddedMedia)}</output>
      <output data-testid="allowed">{String(preference.embedAllowed)}</output>
      <output data-testid="saving">{String(preference.preferenceSaving)}</output>
      <output data-testid="error">{preference.preferenceError ?? ''}</output>
      <button onClick={() => preference.setDisableEmbeddedMedia(true)}>Disable</button>
      <button onClick={() => preference.setDisableEmbeddedMedia(false)}>Enable</button>
    </div>
  )
}

function adapterWith(raw: unknown, setSetting = vi.fn(async () => {})): PreferenceAdapter {
  return {
    getSetting: vi.fn(async () => raw) as PreferenceAdapter['getSetting'],
    setSetting: setSetting as PreferenceAdapter['setSetting'],
  }
}

describe('useEmbeddedMediaPreference — closed hydration and legacy-safe default', () => {
  it('keeps iframe eligibility closed until the durable value resolves', async () => {
    const read = deferred<unknown>()
    const adapter: PreferenceAdapter = {
      getSetting: vi.fn(() => read.promise) as PreferenceAdapter['getSetting'],
      setSetting: vi.fn(async () => {}) as PreferenceAdapter['setSetting'],
    }
    render(<PreferenceHarness adapter={adapter} />)

    expect(screen.getByTestId('value').textContent).toBe('loading')
    expect(screen.getByTestId('allowed').textContent).toBe('false')

    await act(async () => { read.resolve(false) })
    await waitFor(() => expect(screen.getByTestId('allowed').textContent).toBe('true'))
  })

  it.each([null, false, 'true', 1, {}, []])('treats a missing or non-boolean value (%j) as off', async raw => {
    render(<PreferenceHarness adapter={adapterWith(raw)} />)
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('false'))
    expect(screen.getByTestId('allowed').textContent).toBe('true')
  })

  it('honors only the literal saved value true as disabled', async () => {
    render(<PreferenceHarness adapter={adapterWith(true)} />)
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('true'))
    expect(screen.getByTestId('allowed').textContent).toBe('false')
  })

  it('falls back to the off-by-default value when preference hydration fails', async () => {
    const adapter: PreferenceAdapter = {
      getSetting: vi.fn(async () => { throw new Error('unavailable') }) as PreferenceAdapter['getSetting'],
      setSetting: vi.fn(async () => {}) as PreferenceAdapter['setSetting'],
    }
    render(<PreferenceHarness adapter={adapter} />)
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('false'))
    expect(screen.getByTestId('allowed').textContent).toBe('true')
  })
})

describe('useEmbeddedMediaPreference — immediate propagation and durable reconciliation', () => {
  it('closes iframe eligibility immediately, before its persistence write finishes', async () => {
    const write = deferred<void>()
    const setSetting = vi.fn(() => write.promise)
    render(<PreferenceHarness adapter={adapterWith(false, setSetting)} />)
    await waitFor(() => expect(screen.getByTestId('allowed').textContent).toBe('true'))

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    expect(screen.getByTestId('value').textContent).toBe('true')
    expect(screen.getByTestId('allowed').textContent).toBe('false')
    expect(screen.getByTestId('saving').textContent).toBe('true')
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith('disableEmbeddedMedia', true))

    await act(async () => { write.resolve() })
    await waitFor(() => expect(screen.getByTestId('saving').textContent).toBe('false'))
  })

  it('restores the last durable choice and exposes an error when saving fails', async () => {
    const setSetting = vi.fn(async () => { throw new Error('disk full') })
    render(<PreferenceHarness adapter={adapterWith(false, setSetting)} />)
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('false'))

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    expect(screen.getByTestId('value').textContent).toBe('true')

    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('false'))
    expect(screen.getByTestId('error').textContent).toMatch(/previous choice was restored/i)
  })

  it('serializes rapid toggles and finishes on the newest durable choice', async () => {
    const first = deferred<void>()
    const second = deferred<void>()
    const setSetting = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    render(<PreferenceHarness adapter={adapterWith(false, setSetting)} />)
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('false'))

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enable' }))
    expect(screen.getByTestId('value').textContent).toBe('false')
    await waitFor(() => expect(setSetting).toHaveBeenCalledTimes(1))

    await act(async () => { first.resolve() })
    await waitFor(() => expect(setSetting).toHaveBeenCalledTimes(2))
    expect(setSetting).toHaveBeenLastCalledWith('disableEmbeddedMedia', false)

    await act(async () => { second.resolve() })
    await waitFor(() => expect(screen.getByTestId('saving').textContent).toBe('false'))
    expect(screen.getByTestId('value').textContent).toBe('false')
    expect(screen.getByTestId('error').textContent).toBe('')
  })
})
