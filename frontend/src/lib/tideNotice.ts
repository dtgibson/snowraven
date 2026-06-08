// Shared copy for the tide too-far / outside-US notice and its one-tap override
// button label. Extracted so the Weather tab (App.tsx) and the comparer's
// Weather & Tide section render byte-identical wording (FR-15 "mirroring the
// Weather tab's notice copy") — pure strings, trivially unit-testable.

export type TideNoticeKind = 'too-far' | 'outside-us'

/** The amber-notice sentence for a station that's too far / outside the US. */
export function tideTooFarNotice(station: string, distanceMi: number, kind: TideNoticeKind): string {
  const mi = distanceMi.toFixed(0)
  return kind === 'too-far'
    ? `The nearest tide station is ${mi} miles away (${station}). Tide data may not reflect your spot.`
    : `Tide information is only available in the US. The nearest US station is ${station}, ${mi} miles away.`
}

/** The override button label: "Show it anyway" (too-far) / "Show nearest US station". */
export function tideOverrideLabel(kind: TideNoticeKind): string {
  return kind === 'too-far' ? 'Show it anyway' : 'Show nearest US station'
}
