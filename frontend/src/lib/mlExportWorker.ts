// Web Worker: parses the Macaulay Library export CSV off the main thread so the UI
// stays responsive while a large export is parsed (notably on low-power devices and
// a Pi). Receives the raw CSV text, posts back an MLParseReply.
//
// The twin of `observationsWorker.ts`, with one difference that is the reason this
// file has a body rather than a one-liner: `parseMLExport` THROWS on a file that is
// not an ML export, and an uncaught throw here would reach the main thread as this
// worker's `error` event — which the settle contract reads as the worker having
// died. Catching it and answering `{ ok: false }` keeps "your file is not an
// export" and "the parse fell over" as two different events on the wire.
import { parseMLExport } from './parseMLExport'
import type { MLParseReply } from './parseMLExportOffThread'

const ctx = self as unknown as Worker

ctx.onmessage = (e: MessageEvent<string>) => {
  let reply: MLParseReply
  try {
    reply = { ok: true, result: parseMLExport(e.data) }
  } catch {
    reply = { ok: false }
  }
  ctx.postMessage(reply)
}
