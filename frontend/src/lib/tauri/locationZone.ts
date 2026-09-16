import { invoke } from '@tauri-apps/api/core'
import { zoneOrUtc } from '../wallClock'

/**
 * The LOCATION's IANA timezone name, guaranteed usable by this runtime's `Intl`.
 *
 * THE ONE CHOKEPOINT where the native seam's answer becomes a zone the rest of
 * the desktop code may pass around freely, and it exists because the Python twin
 * has that shape already: `backend/formatters/weather.py`'s `get_timezone`
 * resolves once into a `ZoneInfo` and hands that object down, so nothing
 * downstream can be given a name that does not resolve. This side passed a raw
 * string down instead, and there are FOUR places it is dereferenced --
 * `nowInZone`, `convergeLocal`, `formatLocalTime` (which builds the copy block a
 * user pastes into a public eBird checklist), and `tzClock.ts`'s `fmtFor`,
 * reached through `localClock` from `planTideRange` and `buildWeatherPlan`.
 * Guarding four call sites is the "one side's enforcement dropped" shape;
 * resolving once is the twin's.
 *
 * That fourth site is why this chokepoint covers FIVE service paths rather than
 * three: before it, `getTidePlan` and `getWeatherPlan` called the command
 * directly and fed the raw string into `localClock` -> `Intl`, which is the
 * identical failure shape. Every other `Intl` dereference of a zone in the app
 * is either fed from here or already guarded (`planReadout`'s try,
 * `PlanResult`'s `safeLocalClock`).
 *
 * This comment said THREE until QA round 3. The count was corrected in
 * `decisions.md` and the PR description first and not here, which inverts the
 * repo's own rule that a swept claim is repaired starting at the SOURCE -- the
 * v1.0.17 precedent exactly, a struck premise surviving in a doc comment in the
 * very file the fix was about.
 *
 * `Intl.DateTimeFormat({ timeZone })` throws a `RangeError` carrying NO `status`
 * for a zone it will not accept, and `isOfflineError` reads a status-less throw
 * as connection-level -- so an unusable zone told the user their online device
 * was offline. Security review F1.
 *
 * Two different names reach it and the seam closes only one of them:
 *   * `""`, which `tzf_rs::DefaultFinder::get_tz_name` returns for a point no
 *     polygon covers. Closed in `src-tauri/src/lib.rs` so the command matches
 *     the Python twin's `or "UTC"` for every JS caller at once.
 *   * a well-formed name this runtime's ICU does not know -- tzf-rs ships its
 *     own tzdb-derived data and the webview supplies ICU's, so a zone present in
 *     one and absent from the other resolves natively and throws here. The seam
 *     default structurally cannot see this one; measured identical to the empty
 *     case before the fix.
 */
/** The sentence a failed lookup carries. It never reaches the screen -- the
 *  panel renders its own copy from `classifyLiveError(err).kind` -- so this is
 *  a machine-visible contract, and it is a fixed literal because the caught
 *  value is platform-supplied and can carry a path or an internal detail. */
export const ZONE_LOOKUP_FAILED = 'Could not determine the timezone for this location.'

export async function locationZone(lat: number, lng: number): Promise<string> {
  let name: string
  try {
    name = await invoke('get_timezone', { lat, lng })
  } catch {
    // A SEAM HAS TWO FAILURE MODES AND THEY GET DIFFERENT ANSWERS.
    //
    // The `zoneOrUtc` below answers "the lookup succeeded and told us this
    // point has no usable zone" -- an uncovered point, where UTC is the honest
    // best effort and matches the backend. This arm answers "the lookup did not
    // happen", which is a different fact: the point probably DOES have a zone,
    // and substituting UTC would invent a moment up to ten hours off for a US
    // coastal point. Answering a different moment than the one asked about is
    // the single thing this whole build exists to prevent, so this refuses.
    //
    // It refuses WITH A STATUS, which is the part that closes the defect: the
    // rejection was status-less, and `isOfflineError` reads that as
    // connection-level, so the panel said "you're offline" about a command that
    // makes no network call at all and cannot fail for being offline.
    //
    // 500, and it is the PARITY-preserving choice rather than a taste call. The
    // reachable trigger is a NaN or out-of-range coordinate (open deferral 4),
    // and `GET /tide/at?lat=nan` answers 500 on the backend today, because its
    // own `get_timezone` sits outside every route's try. Measured, both
    // runtimes: the user meets one generic error sentence either way. A UTC
    // fallback here would make desktop SUCCEED where web/Pi fails -- a fresh
    // divergence, in the direction of a confidently wrong answer.
    //
    // The caught value is discarded rather than re-messaged, so no platform
    // path or internal detail can reach a `detail`.
    throw Object.assign(new Error(ZONE_LOOKUP_FAILED), { status: 500 })
  }
  return zoneOrUtc(name)
}
