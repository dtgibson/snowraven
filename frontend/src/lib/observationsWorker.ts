// Web Worker: parses the eBird backup CSV off the main thread so the UI stays
// responsive while a large export is parsed (notably on low-power devices / a Pi).
// Receives the raw CSV text, posts back the PACKED parse (observationsPacked.ts)
// with its buffers transferred, so the reply moves the arrays instead of
// serializing an object per row, and the main thread's entries share their
// strings (big-old-life-lists, decisions.md entry 2).
import { packEbirdObservations } from './parseEbirdObservations'
import { packedTransferables } from './observationsPacked'

const ctx = self as unknown as Worker

ctx.onmessage = (e: MessageEvent<string>) => {
  const packed = packEbirdObservations(e.data)
  ctx.postMessage(packed, packedTransferables(packed))
}
