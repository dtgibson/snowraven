// The Projects section's body (county-shading-and-project-stats, design-spec.md
// View 4; densified layout + participation chart per projects-stats-card,
// design-refinement.md). Mounted ONLY by BirdingStats' Projects SectionCard.
//
// Two zones. Zone A is the state block — always present, structurally the
// shipped `.sr-exotic` block renamed `.sr-proj-*`, because it is the same kind
// of thing: a number the app has to go and earn, reported honestly while it is
// still incomplete. Zone B is the results: a projects block and a portals block,
// each present once at least one checklist has been checked AND that block's own
// list is non-empty. They are siblings, never nested — an account that has
// joined no project still has a "How you submitted" reading to show.
//
// Layout lives in globals.css (`.sr-proj-*`), never in an inline style: a React
// inline style is specificity (1,0,0) and unreachable from a media query.
// Colours stay inline and come only from `var(--sr-*)` tokens; this feature
// mints none.
//
// Three things that must not be reintroduced, each a live defect in the
// shipped precedent this copies:
//   1. the live region is `flex` in EVERY state, idle included. `display: none`
//      on a `role="status"` removes it from the accessibility tree, so it would
//      be INSERTED along with its first message, which breaks announcement
//      entirely and is invisible to jsdom and to every layout measurement;
//   2. the message sits in a SEQUENCE-KEYED CHILD, so an identical repeat is a
//      real node replacement and still announces. Never append an invisible
//      character to force a diff, which would make every textContent assertion
//      quietly false;
//   3. the progress row is CONDITIONALLY RENDERED, never `hidden` against an
//      author `display` (which `[hidden]` loses to).
//
// NO PROJECT IDENTIFIER IS EVER A LINK OR A URL SEGMENT (FR-29). There is no
// link component in these rows, and there is no endpoint that would resolve one.

import {
  AlertCircle, Check, Circle, Clock, KeyRound, Loader2, Play, RotateCw, Square, WifiOff,
} from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { Divider, SubLabel } from './statsPrimitives'
import { fmt, fmtSharePct } from '../lib/statsFormat'
import { formatDateRange } from '../lib/formatDate'
import {
  projectsCopy, shareClause, skippedNote,
  PORTALS_CHART_CAPTION, PORTALS_NOTE, PORTALS_SUBLABEL,
  PROJECTS_CHART_CAPTION, PROJECTS_SUBLABEL, UNNAMED_PROJECT_NOTE,
  type ProjectsActionId, type ProjectsIconKind, type ProjectsTone,
} from '../lib/projectsCopy'
import type { ChecklistProjectsController } from '../lib/useChecklistProjects'

const TONE_COLOR: Record<ProjectsTone, string> = {
  accent: 'var(--sr-accent)',
  warning: 'var(--sr-warning)',
  error: 'var(--sr-error)',
  muted: 'var(--sr-text-muted)',
}

// ── The participation chart (projects-stats-card) ────────────────────────────
//
// A decorative vertical bar chart in the shared .sr-grid-chart-aside column
// beside the rows: same facts, no new data, DERIVED AT RENDER TIME from the
// deriveProjectsView output (the v1.0.5 decision — nothing derived is ever
// persisted). It charts the FIRST eight rows of whichever block owns it, and
// only when that block has at least two: a bar chart of one is chrome around a
// single fact (the v1.0.3 ranked-list rule), so a single row states the fact
// and no dot renders.
//
// The categorical ORDER is fixed and never cycled — accent, photo-blue,
// audio-amber, video-violet, then slate for every charted row past the fourth
// (identity carried by the row text). It is deliberately a different order from
// the observer donut's array: measured with the dataviz palette validator, the
// donut's blue↔violet adjacency is near-indistinguishable under deuteranopia
// (ΔE 1.3); with amber third the set passes every separation check in both
// themes. Token VALUES are untouched; only this chart's assignment encodes the
// fix. Color is reinforcement, never sole carrier: bar order equals row order,
// and the row text is the identity (WCAG 1.4.1 holds with color removed).

const CHART_MAX = 8
const CHART_CATEGORICAL = [
  'var(--sr-accent)',
  'var(--sr-graph-photo)',
  'var(--sr-graph-audio)',
  'var(--sr-graph-video)',
] as const

function chartColor(i: number): string {
  return i < CHART_CATEGORICAL.length ? CHART_CATEGORICAL[i] : 'var(--sr-chart-slate)'
}

interface ChartDatum {
  key: string
  checklists: number
}

/**
 * The aside. The wrapper is `aria-hidden` + `inert` — the shipped donut
 * precedent: recharts leaves a focusable root <svg> otherwise, and every figure
 * the chart shows is already in the rows as accessible text (via projectsCopy).
 * The caption sits INSIDE the inert wrapper, since it labels a decoration whose
 * accessible equivalent is the rows.
 *
 * The caller keys this element by `data.length`, so the .sr-proj-viz entrance
 * (140ms house ease-out) replays exactly when the chartable SHAPE changes — a
 * new bar appearing mid-sweep — never per progress tick. The bars themselves
 * carry NO internal animation: recharts animation is JS-driven (blind to
 * prefers-reduced-motion) and would replay per data tick during a live sweep;
 * widths snap to each throttled emission instead, which reads as live progress.
 *
 * Height is container-level px on purpose: the bars carry no text, so they owe
 * nothing to text scale.
 */
function ParticipationChart({ caption, data }: { caption: string; data: ChartDatum[] }) {
  return (
    <div className="sr-proj-viz" aria-hidden="true" inert>
      <span className="sr-proj-viz-cap">{caption}</span>
      <div style={{ height: 24 * data.length + 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis type="category" dataKey="key" hide />
            {/* Each bar sits on a full-length track (the house BarRow language);
                minPointSize keeps a tiny project visible as a sliver. */}
            <Bar
              dataKey="checklists"
              barSize={12}
              radius={[0, 3, 3, 0]}
              minPointSize={2}
              background={{ fill: 'var(--sr-surface-subtle)', radius: 3 }}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={d.key} fill={chartColor(i)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** The row's dot, linking it to its bar. Rendered INSIDE the name span — never
 *  as a direct row child, or the ≤640 stacking rule would hand it width:100%. */
function RowDot({ index }: { index: number }) {
  return <span className="sr-proj-dot" style={{ background: chartColor(index) }} aria-hidden="true" />
}

function StatusIcon({ kind, tone }: { kind: ProjectsIconKind; tone: ProjectsTone }) {
  const style = { color: TONE_COLOR[tone] }
  const cls = 'sr-proj-icon'
  switch (kind) {
    case 'loader':
      return <Loader2 size={14} strokeWidth={2.2} className={`spin ${cls}`} aria-hidden="true" style={style} />
    case 'check':
      return <Check size={14} strokeWidth={2.2} className={cls} aria-hidden="true" style={style} />
    case 'alert':
      return <AlertCircle size={14} strokeWidth={2.2} className={cls} aria-hidden="true" style={style} />
    case 'key':
      return <KeyRound size={14} strokeWidth={2.2} className={cls} aria-hidden="true" style={style} />
    case 'wifi':
      return <WifiOff size={14} strokeWidth={2.2} className={cls} aria-hidden="true" style={style} />
    case 'clock':
      return <Clock size={14} strokeWidth={2.2} className={cls} aria-hidden="true" style={style} />
    default:
      return <Circle size={14} strokeWidth={2.2} strokeDasharray="3 3" className={cls} aria-hidden="true" style={style} />
  }
}

function ActionIcon({ id }: { id: ProjectsActionId }) {
  if (id === 'start') return <Play size={12} strokeWidth={2.2} aria-hidden="true" />
  if (id === 'stop') return <Square size={11} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />
  return <RotateCw size={12} strokeWidth={2.2} aria-hidden="true" />
}

// The date span is the SHIPPED `formatDateRange`, which already produces the
// design's exact form ("Feb 14 – Jun 28, 2026"), collapses an equal pair to one
// date, and honors the user's date-format preference. The glyph is an en dash,
// the sanctioned one for a numeric range; there are no em dashes anywhere in
// this feature's copy.

export interface ProjectsSectionProps {
  controller: ChecklistProjectsController
  onGoToSettings: () => void
}

export function ProjectsSection({ controller, onGoToSettings }: ProjectsSectionProps) {
  const { status, statusSeq, view } = controller
  const copy = projectsCopy(status, view.projects.length)

  const onAct = (id: ProjectsActionId) => {
    if (id === 'start') controller.start()
    else if (id === 'stop') controller.stop()
    else if (id === 'again') controller.checkAgain()
    else controller.resume()
  }

  // The progress pair measures checked / total, NOT done / target. That is what
  // makes a resume never restart the bar at zero, and it means the sentence, the
  // bar and the readout quote ONE pair of numbers on the whole card, so they
  // cannot disagree — structurally rather than by discipline. A pass with
  // failures correctly stops short of 100%, which is honest and is explained by
  // the unanswered state.
  const showProgress = copy.progress && 'checked' in status && 'total' in status
  const total = 'total' in status ? status.total : 0
  // Clamped at the render, deliberately, ON TOP of the controller's fix rather
  // than instead of it. `aria-valuenow` above `aria-valuemax` is a progress bar
  // that reports more than its own maximum: a screen reader announces a
  // nonsense percentage and the readout reads "6,502 / 3,251". Whatever the
  // controller does, THIS element must never emit that pair, so the invariant
  // is enforced where the attribute is written. The controller test presses
  // Check again and asserts the unclamped figure, so the clamp cannot quietly
  // become the only thing holding the invariant up.
  const rawChecked = 'checked' in status ? status.checked : 0
  const checked = Math.min(rawChecked, total)

  // Chart ownership (see the Zone B comment below). Everything here derives at
  // render time from the deriveProjectsView output — nothing is persisted.
  const projectsBlock = view.checked > 0 && view.projects.length > 0
  const portalsBlock = view.checked > 0 && view.portals.length > 0
  const projectsCharted: ChartDatum[] =
    projectsBlock && view.projects.length >= 2
      ? view.projects.slice(0, CHART_MAX).map(r => ({ key: r.key, checklists: r.checklists }))
      : []
  const portalsCharted: ChartDatum[] =
    !projectsBlock && portalsBlock && view.portals.length >= 2
      ? view.portals.slice(0, CHART_MAX).map(p => ({ key: p.code, checklists: p.checklists }))
      : []

  const projectRowsEl = (
    <div className="sr-proj-rows">
      {view.projects.map((row, i) => {
        const span = formatDateRange(row.firstDate, row.lastDate)
        const hasBar = i < projectsCharted.length
        return (
          <div key={row.key} className="sr-proj-row">
            <span className="sr-proj-name">
              {hasBar && <RowDot index={i} />}
              {row.named ? row.label : <span className="raw">{row.label}</span>}
            </span>
            <span className="sr-proj-n">
              {fmt(row.checklists)} {row.checklists === 1 ? 'checklist' : 'checklists'}
            </span>
            <span className="sr-proj-meta">
              {shareClause(fmtSharePct(row.checklists, view.checked), view.checked)}
              {span && <><span className="sep">&middot;</span>{span}</>}
            </span>
            {!row.named && <span className="sr-proj-unnamed">{UNNAMED_PROJECT_NOTE}</span>}
          </div>
        )
      })}
    </div>
  )

  const portalRowsEl = (
    <div className="sr-proj-portals">
      {view.portals.map((p, i) => {
        const hasBar = i < portalsCharted.length
        return (
          <div key={p.code} className="sr-proj-portalrow">
            <span className="nm">
              {hasBar && <RowDot index={i} />}
              {p.named ? p.label : <code>{p.code}</code>}
            </span>
            <span className="vl">
              {fmt(p.checklists)} {p.checklists === 1 ? 'checklist' : 'checklists'}
            </span>
            <span className="sh">
              {shareClause(fmtSharePct(p.checklists, view.checked), view.checked)}
            </span>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="sr-proj">
      <div className="sr-proj-statusrow">
        <div className="sr-proj-status" role="status" aria-live="polite">
          <StatusIcon kind={copy.icon} tone={copy.tone} />
          <span key={statusSeq} className="sr-proj-msg">
            {copy.msg}
            {copy.link && (
              <>
                {' '}
                <button type="button" tabIndex={0} className="sr-proj-link" onClick={onGoToSettings}>
                  {copy.link}
                </button>
              </>
            )}
          </span>
        </div>

        {copy.actions.length > 0 && (
          <div className="sr-proj-actions">
            {copy.actions.map(a => (
              <button
                key={a.id}
                type="button"
                tabIndex={0}
                className={a.primary ? 'sr-proj-act sr-proj-act--primary' : 'sr-proj-act'}
                onClick={() => onAct(a.id)}
              >
                <ActionIcon id={a.id} />
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showProgress && (
        <div className="sr-proj-progress">
          <div
            className="sr-proj-track"
            role="progressbar"
            aria-label="Project check progress"
            aria-valuenow={checked}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            <div
              className="sr-proj-fill"
              style={{ width: `${total > 0 ? Math.min(100, Math.round((checked / total) * 100)) : 0}%` }}
            />
          </div>
          <span className="sr-proj-count">{fmt(checked)} / {fmt(total)}</span>
        </div>
      )}

      <p className="sr-proj-rule">{copy.note}</p>
      {view.skipped > 0 && <p className="sr-proj-rule">{skippedNote(view.skipped, view.total)}</p>}

      {/* Zone B. `checked > 0 && projects.length === 0` is the EARNED ZERO, and
          it is stated by the tally sentence above against its denominator
          rather than by an empty list here.

          THE TWO BLOCKS ARE SIBLINGS, NOT NESTED. The portal breakdown used to
          sit inside the projects guard, which made it unreachable in the COMMON
          case: a sweep that finds only submission portals and no project (every
          account that has never joined one) showed no breakdown at all, even
          though the answer had been paid for and was sitting in the store. Each
          block now gates on its OWN list, and each opens with its own Divider so
          either can be the first thing in the zone.

          THE CHART GATE: the participation chart renders in whichever block owns
          it, and only when that block has ≥ 2 rows. The projects block owns it
          whenever it renders; when it does not (no projects at all) and the
          portals block has ≥ 2 rows, the portals block takes the chart-aside
          grid instead — with no projects present there is nothing for it to be
          subordinate to. Dots render only on rows that actually have a bar. */}
      {projectsBlock && (
        <>
          <Divider />
          <SubLabel>{PROJECTS_SUBLABEL}</SubLabel>
          {projectsCharted.length > 0 ? (
            <div className="sr-grid-chart-aside" style={{ alignItems: 'start', ['--sr-aside' as string]: '200px' }}>
              {projectRowsEl}
              <ParticipationChart
                key={projectsCharted.length}
                caption={PROJECTS_CHART_CAPTION}
                data={projectsCharted}
              />
            </div>
          ) : projectRowsEl}
        </>
      )}

      {/* The portal breakdown is visually and semantically SUBORDINATE and is
          never presented as a project: its own sublabel, its own note saying
          what it is, and a quieter row treatment (no dots, no chart, no color
          while the projects block renders). It renders on its own evidence —
          `checked > 0 && portals.length > 0` — so an account with no project
          contribution still gets the reading its sweep paid for. */}
      {portalsBlock && (
        <>
          <Divider />
          <SubLabel>{PORTALS_SUBLABEL}</SubLabel>
          <p className="sr-proj-rule sr-proj-portalnote">{PORTALS_NOTE}</p>
          {portalsCharted.length > 0 ? (
            <div className="sr-grid-chart-aside" style={{ alignItems: 'start', ['--sr-aside' as string]: '200px' }}>
              {portalRowsEl}
              <ParticipationChart
                key={portalsCharted.length}
                caption={PORTALS_CHART_CAPTION}
                data={portalsCharted}
              />
            </div>
          ) : portalRowsEl}
        </>
      )}
    </div>
  )
}
