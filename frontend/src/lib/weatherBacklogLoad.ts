// The Weather Backlog's load decision, lifted out of `App.tsx`'s effect so it
// can be driven by a test.
//
// WHY THIS FILE EXISTS AT ALL. The effect it came from was the one
// `loadEbirdObservations` caller in the app that said something about the user's
// backup without first asking `storage.getFilesStatus()` whether one is stored
// (DECISIONS.md v1.0.15 named it by that property). Every other caller branches
// on the status first, so a falsy load already means "stored but unloadable"
// there; here the two collapsed, and the copy it defaulted to -- "Load your
// eBird backup first", with a Go to Import button -- is the right answer to only
// one of them. A birder whose stored `MyEBirdData.csv` was truncated by an
// interrupted write was told to import a file Settings plainly listed as saved.
//
// The fix is one added await, a fourth state, and the guards that come with
// owning the whole decision rather than half of it, and the reason it is a MODULE
// rather than four more lines in the effect is evidence: no test in this repo
// renders `App.tsx`, so a branch written there is unguarded no matter how
// carefully it is written. Everything that decides -- the status branch, the
// falsy branch, the rejection branch, and the row build -- lives here, where
// `honestLoadFailures.test.tsx` drives it directly. What is left at the call
// site is one liveness check and one setter, which is as small as the unguarded
// remainder can be made without rendering the whole app.
//
// The dependencies are injected rather than imported for the same reason. A test
// that mocked `../lib/storage` and `../lib/observationsCache` wholesale to reach
// this code would be mocking the two modules it is trying to prove this function
// consults (DECISIONS.md v1.0.15: a guard test that mocks a module wholesale
// structurally cannot verify that module); handing them in makes the contract
// the argument list.

import type { ObservationEntry } from '../types'
import type { ChecklistRowData } from './checklistsTab'

/**
 * The Weather Backlog's fourth `rows` state: a backup IS stored and it could not
 * be turned into rows. Deliberately distinct from `null` (no backup stored, →
 * the Go to Import guidance) and `undefined` (still building, → the spinner),
 * because the `setup-required` / `error` split those two encode is the whole
 * point of this fix (DECISIONS.md, 2026-05-22).
 *
 * It is a fourth value on the ONE prop rather than a boolean beside it: a
 * separate flag would admit "load failed and rows are ready" as a representable
 * state, and there is no honest thing to render for that.
 */
export const BACKLOG_LOAD_FAILED = 'backlog-load-failed'

/** Everything `rows` can be once the load has settled. */
export type ResolvedBacklogRows = ChecklistRowData[] | null | typeof BACKLOG_LOAD_FAILED

/**
 * Returned when the run was superseded (a newer `filesVersion`, or an unmount)
 * while it was waiting. The caller writes NO state for it -- it is not a fourth
 * display state, and writing `undefined` for it would push a settled section
 * back to its spinner. TypeScript enforces the narrowing: `setBacklogRows`
 * accepts `ResolvedBacklogRows | undefined`, which this value is not.
 */
export const BACKLOG_SUPERSEDED = 'backlog-superseded'

export interface BacklogLoadDeps {
  /** `storage.getFilesStatus` -- is a backup STORED, whatever it contains. */
  getFilesStatus: () => Promise<{ ebird: unknown }>
  /** `loadEbirdObservations` -- the parse-once cache, falsy on any failure. */
  loadObservations: () => Promise<{ observations: ObservationEntry[] } | null>
  /** `buildChecklistRows`, curried with the backlog's null mediaMap. */
  buildRows: (observations: ObservationEntry[]) => ChecklistRowData[]
  /**
   * False once this run has been superseded. Checked after BOTH awaits: the
   * status read added an async boundary, and a run that loses the race must
   * stop rather than spend a full row build on an answer nobody will read.
   */
  isCurrent: () => boolean
}

/**
 * Decide what the Weather Backlog should show, from the same two questions every
 * other stored-file surface asks in the same order: is a backup stored, and did
 * it load? It answers one of them differently, and only one: a status read that
 * REJECTS (see below).
 *
 * A rejection lands on the same branch as a falsy load. `loadEbirdObservations`
 * structurally cannot reject today (v1.0.15 moved the read inside its own try),
 * so the catch is defense in depth -- but it is defense that has to point at the
 * honest state rather than at the setup-shaped one, which is what it did before.
 *
 * THIS PROMISE NEVER REJECTS, and the caller depends on that: `App.tsx` has no
 * `.catch`, because a branch written there would be in the one file no test
 * renders. What carries it, exactly: EVERY call this function makes into an
 * injected dependency happens inside a `try` -- both `isCurrent()` call sites,
 * the row build included, which is why that one is `return await` and not
 * `return` -- and the function's own statements are a `Boolean`, two comparisons
 * and returns, none of which can throw.
 *
 * ONE BOUNDARY, NAMED because an absolute claim that is false is worth less than
 * a bounded one that is true. Rejection is closed; NON-SETTLEMENT is not. A
 * dependency that returns a thenable which never settles leaves this promise
 * pending forever (measured: still pending at 2s), `setBacklogRows` never runs,
 * and the section holds its spinner. No `try` can close that, here or anywhere:
 * the answer to it is a timeout, which belongs to whoever introduces a dependency
 * that can hang, and none of the four can today. Apart from that, there are no
 * exceptions; if one is ever added it belongs in this paragraph, because a
 * totality claim with an unnamed exception is worse than an honest partial one.
 *
 * Two ways this has already been got wrong, both recorded because both read as
 * correct on inspection. The effect this replaced wrapped its whole `.then` body
 * in a single `.catch`, so a throw from `buildChecklistRows` was covered before
 * the lift; left outside it would escape unhandled and park the section on its
 * spinner for the session, which is worse than the bug being fixed. And the
 * second `isCurrent()` call was outside every `try`, invisible because the first
 * one is not. So the guard against a third is not a habit but the shape of the
 * test: `honestLoadFailures.test.tsx` iterates the dependency OBJECT rather than
 * a list of names, and throws on each of the first several calls to each member,
 * so a dependency added to `BacklogLoadDeps` later is covered without anyone
 * remembering to cover it, and a call site reached only on a later invocation is
 * reached too.
 */
export async function resolveBacklogRows(
  deps: BacklogLoadDeps,
): Promise<ResolvedBacklogRows | typeof BACKLOG_SUPERSEDED> {
  let stored: boolean
  try {
    const status = await deps.getFilesStatus()
    if (!deps.isCurrent()) return BACKLOG_SUPERSEDED
    stored = Boolean(status.ebird)
  } catch {
    // The status read itself failed, so whether a backup is stored is unknown.
    // Report the load failure rather than the absence: this section cannot see
    // the file, and telling someone who has one to go import it is exactly the
    // lie being removed.
    //
    // WHAT THIS BRANCH DOES NOT REACH, on either platform, because naming only
    // the desktop half would leave the picture half drawn. `TauriStorage.readMeta`
    // swallows its own failures into `{ebird: null, ml: null}`, and
    // `WebStorage.getFilesStatus` does the identical thing for a non-ok response,
    // so a backend answering 500 reads as "no backup stored" and lands on the
    // guidance rather than here. Only a REJECTION reaches this catch. That
    // residual sits one layer down, is shared with every other stored-file
    // surface, and is recorded in ROADMAP.md rather than fixed here.
    //
    // THIS DIVERGES FROM THE EIGHT TAB LOADERS, deliberately and knowingly. Their
    // outer `catch` maps a rejecting status read to `setup-required`, which is
    // this family's own lie one layer up and is ordinary on web and Pi, where the
    // call is a bare `fetch` at a backend that can be unreachable. The divergence
    // is recorded in ROADMAP.md as an argument for doing the eight, not as a
    // reason to undo this one: with no way to see the file, "you have no backup"
    // is a claim this section has no basis for.
    return BACKLOG_LOAD_FAILED
  }

  if (!stored) return null

  let loaded: { observations: ObservationEntry[] } | null
  try {
    loaded = await deps.loadObservations()
    // INSIDE the try, and that placement is the point rather than a formatting
    // choice. This call sat outside every `try` in the first attempt at this
    // build, which made the promise reject and the section spin forever. It read
    // as guarded because the FIRST `isCurrent()` call happens to sit inside the
    // status read's try, so a predicate that throws immediately is caught and one
    // that throws late is not. Cancellation still wins over a falsy load, which
    // is the rule Finding C exists for: the check is ahead of `!loaded`.
    if (!deps.isCurrent()) return BACKLOG_SUPERSEDED
  } catch {
    return BACKLOG_LOAD_FAILED
  }
  if (!loaded) return BACKLOG_LOAD_FAILED

  try {
    // `return await`, not `return`, and the `await` is load-bearing on a value the
    // type says is a plain array. An async function's `return v` performs promise
    // resolution of `v` AFTER the try block has exited, so if a `buildRows`
    // implementation ever hands back a thenable, BOTH the `Get(v, "then")` lookup
    // and the `then` call itself happen outside this catch: a rejecting thenable
    // and a throwing `then` GETTER are two separate doors out of a statement that
    // looks entirely enclosed. Awaiting pulls the unwrapping back inside. The cost
    // on the shipped array path is one microtask tick.
    return await deps.buildRows(loaded.observations)
  } catch {
    // A backup that read and parsed but could not be turned into ROWS is still a
    // backup that could not be turned into rows, which is the property in the
    // brief word for word. `buildChecklistRows` is a pure pass over already
    // normalized records, so this is remote rather than likely -- but it is the
    // difference between one honest message and a spinner that never resolves.
    return BACKLOG_LOAD_FAILED
  }
}
