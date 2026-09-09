// @vitest-environment jsdom
// Regression guard for stalled web/Pi stored-file reads.
//
// A bare fetch + Response.text() has two unbounded waits: headers and the next
// body byte. Because observationsCache and mlExportCache memoize their first
// promise, either wait used to poison every dependent tab for the rest of the
// session. These tests exercise the real WebStorage adapter and the real cache
// owners, not a mocked storage seam.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearEbirdObservationsCache, loadEbirdObservations } from './observationsCache'
import { clearMLExportCache, loadMLExport } from './mlExportCache'
import { FILE_READ_INACTIVITY_MS, storage } from './storage'

const EBIRD_CSV = 'Submission ID,Common Name,Scientific Name,Date\nS1,Sora,Porzana carolina,2024-04-09\n'
const ML_CSV = 'Catalog Number,Common Name,Scientific Name,Format\n1,American Robin,Turdus migratorius,Photo\n'

function streamingResponse(text: string): Response {
  const bytes = new TextEncoder().encode(text)
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    }),
    text: async () => text,
  } as Response
}

beforeEach(() => {
  clearEbirdObservationsCache()
  clearMLExportCache()
  vi.useFakeTimers()
  delete (globalThis as { Worker?: unknown }).Worker
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('WebStorage.readFile inactivity bound', () => {
  it.each(['ebird', 'ml'] as const)('settles a stalled %s header wait and aborts its request', async (name) => {
    let signal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      // Deliberately ignore abort. The explicit timeout race must still settle
      // the adapter even if a transport is late to reject its fetch promise.
      return new Promise<Response>(() => {})
    }))

    let settled = false
    const read = storage.readFile(name).then(
      value => { settled = true; return value },
      error => { settled = true; throw error },
    )
    read.catch(() => {})

    await vi.advanceTimersByTimeAsync(FILE_READ_INACTIVITY_MS - 1)
    expect(settled).toBe(false)
    expect(signal?.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(read).rejects.toThrow(/timed out/i)
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['ebird', 'ml'] as const)('settles a stalled %s body read and cancels its reader', async (name) => {
    const cancel = vi.fn()
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({
      start(c) { controller = c },
      cancel() { cancel() },
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      body,
      text: async () => '',
    } as Response)))

    const read = storage.readFile(name)
    read.catch(() => {})
    controller.enqueue(new TextEncoder().encode('header,one\n'))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(FILE_READ_INACTIVITY_MS)

    await expect(read).rejects.toThrow(/timed out/i)
    await vi.advanceTimersByTimeAsync(0)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rearms on every chunk, so a healthy streaming read may exceed the total bound', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({ start(c) { controller = c } })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      body,
      text: async () => '',
    } as Response)))

    const read = storage.readFile('ebird')
    await vi.advanceTimersByTimeAsync(20_000)
    controller.enqueue(new TextEncoder().encode('Submission ID,'))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(20_000)
    controller.enqueue(new TextEncoder().encode('Common Name\n'))
    controller.close()

    await expect(read).resolves.toBe('Submission ID,Common Name\n')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not treat zero-byte chunks as body progress', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({ start(c) { controller = c } })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      body,
      text: async () => '',
    } as Response)))

    const read = storage.readFile('ebird')
    read.catch(() => {})
    await vi.advanceTimersByTimeAsync(FILE_READ_INACTIVITY_MS - 1)
    controller.enqueue(new Uint8Array())
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(1)
    await expect(read).rejects.toThrow(/timed out/i)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('a timed-out real cache load can retry without restarting', () => {
  it('clears the eBird shared in-flight promise, then reads and parses the next response', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(() => {}))
      .mockResolvedValueOnce(streamingResponse(EBIRD_CSV))
    vi.stubGlobal('fetch', fetchMock)

    const first = loadEbirdObservations()
    await vi.advanceTimersByTimeAsync(FILE_READ_INACTIVITY_MS)
    await expect(first).resolves.toBeNull()

    const second = await loadEbirdObservations()
    expect(second?.observations.map(o => o.submissionId)).toEqual(['S1'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does the same through the ML cache owner and its real parser', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(() => {}))
      .mockResolvedValueOnce(streamingResponse(ML_CSV))
    vi.stubGlobal('fetch', fetchMock)

    const first = loadMLExport()
    await vi.advanceTimersByTimeAsync(FILE_READ_INACTIVITY_MS)
    await expect(first).resolves.toBeNull()

    const second = await loadMLExport()
    expect(second?.entries.map(e => e.commonName)).toEqual(['American Robin'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
