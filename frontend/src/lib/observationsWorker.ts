// Web Worker: parses the eBird backup CSV off the main thread so the UI stays
// responsive while a large export is parsed (notably on low-power devices / a Pi).
// Receives the raw CSV text, posts back the parsed ObservationEntry[].
import { parseEbirdObservations } from './parseEbirdObservations'

const ctx = self as unknown as Worker

ctx.onmessage = (e: MessageEvent<string>) => {
  ctx.postMessage(parseEbirdObservations(e.data))
}
