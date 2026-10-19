// Browser harness for decisions.md entry 1: the shipped worker pipeline and the
// packed one, run in a real page with real workers, so every leg that crosses a
// thread (the parse reply, the stats hand-over) is measured where it happens.
// One bundle serves the page and its workers; it branches on `document`.
//
// Page:   page.html?csv=<name>&shape=shipped|packed[&throttleLegs=1]
// Result: posted to /result as JSON and printed into the page.
import { parseEbirdObservations } from '../../../../frontend/src/lib/parseEbirdObservations'
import { computeStatsBundle } from '../../../../frontend/src/lib/statsBundle'
import { packEbirdObservations, materializeObservations, repack } from './packed-proto'
import type { PackedObservations } from './packed-proto'
import type { ObservationEntry } from '../../../../frontend/src/types'

const REQ = { includeSpuh: false, granularity: 'total' as const, excludedNames: [] as string[] }
const now = () => performance.now()
const transfers = (p: PackedObservations) => [p.str.buffer, p.num.buffer]

declare const self: { onmessage: ((e: MessageEvent) => void) | null; postMessage: (m: unknown, t?: Transferable[]) => void }

if (typeof document === 'undefined') {
  // -- worker --
  let held: ObservationEntry[] | null = null
  self.onmessage = (e: MessageEvent) => {
    const m = e.data
    const t = now()
    if (m.cmd === 'parse-shipped') {
      const obs = parseEbirdObservations(m.text)
      self.postMessage({ ms: now() - t, obs })
    } else if (m.cmd === 'parse-packed') {
      const p = packEbirdObservations(m.text)
      self.postMessage({ ms: now() - t, p }, transfers(p))
    } else if (m.cmd === 'hold-shipped') {
      held = m.obs
      const t2 = now()
      computeStatsBundle(held!, REQ)
      self.postMessage({ ms: now() - t2 })
    } else if (m.cmd === 'hold-packed') {
      held = materializeObservations(m.p)
      const matMs = now() - t
      const t2 = now()
      computeStatsBundle(held, REQ)
      self.postMessage({ ms: now() - t2, matMs })
    }
  }
} else {
  // -- page --
  const q = new URLSearchParams(location.search)
  const csv = q.get('csv') ?? 'big-21856.csv'
  const shape = q.get('shape') ?? 'packed'
  const out: Record<string, unknown> = { csv, shape, ua: navigator.userAgent }
  const heap = (): number | null => {
    const g = (globalThis as unknown as { gc?: () => void }).gc
    if (g) { g(); g() }
    const pm = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    return pm ? pm.usedJSHeapSize : null
  }
  // The reply handlers are made in a scope that does not hold the message, so
  // posting a message never keeps its text alive for the length of the parse.
  const waitReply = (w: Worker) => new Promise<MessageEvent>((res, rej) => {
    w.onmessage = res
    w.onerror = (ev) => rej(new Error(String((ev as ErrorEvent).message)))
  })
  const ask = (w: Worker, msg: unknown, tr: Transferable[] = []) => {
    const reply = waitReply(w)
    w.postMessage(msg, tr)
    return reply
  }
  const mark = (k: string, v: unknown) => { out[k] = typeof v === 'number' ? Math.round(v) : v }
  const run = async () => {
    const show = document.getElementById('out')!
    try {
      let t = now()
      let text: string | null = await (await fetch(`/csv/${csv}`)).text()
      mark('fetchMs', now() - t)
      mark('chars', text.length)
      const h0 = heap()
      const url = (document.querySelector('script[data-bundle]') as HTMLScriptElement).src
      const parser = new Worker(url)
      let obs: ObservationEntry[]
      t = now()
      if (shape === 'shipped') {
        const e = await ask(parser, { cmd: 'parse-shipped', text })
        mark('parseRoundTripMs', now() - t)
        const td = now()
        const d = e.data
        mark('replyDeserializeMs', now() - td)
        mark('workerParseMs', d.ms)
        obs = d.obs
      } else {
        // The new design drops the main thread's copy of the text as soon as it
        // is posted, so only the worker's copy is alive during the parse.
        const posted = ask(parser, { cmd: 'parse-packed', text })
        if (q.get('release') === '1') text = null
        const e = await posted
        mark('parseRoundTripMs', now() - t)
        const td = now()
        const d = e.data
        mark('replyDeserializeMs', now() - td)
        mark('workerParseMs', d.ms)
        const tm = now()
        obs = materializeObservations(d.p)
        mark('materializeMs', now() - tm)
      }
      parser.terminate()
      mark('rows', obs.length)
      // The text is still alive here, as it was at h0, so the delta is the copy.
      const h1 = heap()
      text = null
      if (h0 !== null && h1 !== null) { mark('mainCopyMB', (h1 - h0) / 1048576); mark('mainBytesPerRow', (h1 - h0) / obs.length) }
      // Stats hand-over: the first message of a stats worker's life.
      const stats = new Worker(url)
      t = now()
      if (shape === 'shipped') {
        const tp = now()
        const p = ask(stats, { cmd: 'hold-shipped', obs })
        mark('handoverPostMs', now() - tp)
        const e = await p
        mark('workerStatsMs', e.data.ms)
      } else {
        const tr = now()
        const packed = repack(obs)
        mark('repackMs', now() - tr)
        const tp = now()
        const p = ask(stats, { cmd: 'hold-packed', p: packed }, transfers(packed))
        mark('handoverPostMs', now() - tp)
        const e = await p
        mark('workerMaterializeMs', e.data.matMs)
        mark('workerStatsMs', e.data.ms)
      }
      mark('handoverRoundTripMs', now() - t)
      const h2 = heap()
      if (h2 !== null && h1 !== null) mark('heapAfterHandoverMB', (h2 - (h0 ?? 0)) / 1048576)
      mark('done', true)
      ;(window as unknown as { __obs: unknown }).__obs = obs
      ;(window as unknown as { __stats: unknown }).__stats = stats
    } catch (err) {
      mark('error', String(err))
    }
    show.textContent = JSON.stringify(out)
    document.title = out.error ? 'error' : 'done'
    await fetch('/result', { method: 'POST', body: JSON.stringify(out) }).catch(() => {})
  }
  void run()
}
