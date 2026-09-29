// The quiet EBIRD BAR CHART section (targets-tab FR-26 to FR-40; design-spec
// section 3): add, replace or remove the selected county's eBird bar-chart
// file, the file's range and its join accounting, the unmatched names, and the
// link to the county's bar chart on ebird.org.
//
// Every import goes through the one refusal registry (`importBarChartFile`:
// the filename rule before the bytes are read, the content rules before
// anything is written), so a refusal stores nothing, bumps nothing and leaves
// the county's existing file exactly as it was (FR-27). Its reason lands in an
// ALWAYS-MOUNTED `role="alert"` region as a sequence-keyed child, so the same
// refusal twice is announced twice (ui.md, v0.5.80).
//
// The ebird.org link opens through the external-open seam, never
// `window.open` (which WKWebView drops), and its region code comes from the
// geometry-derived county, gated by REGION_CODE_RE and URI-encoded, never from
// a filename (NFR-06).
//
// icloud-bar-chart-sync (design-spec section 1). On macOS and iOS (the
// platform gate) the card carries the Settings rows' own sync line, rendered
// from first paint at ONE stable position in every state (the line's children
// are replaced; the region is never remounted), fed by the controller's view
// of this county. With iCloud Sync on: Remove confirms first (FR-10), because
// the file goes from every synced device too, and the confirmed removal hands
// the county to `icloudActions.barChartsCleared`; an add records this device as
// the file's origin; a file in iCloud that has not reached this device reads
// "In iCloud, not downloaded here" with Download now (FR-16). Off Apple, and
// with sync off, the section is exactly what it was.

import { Fragment, useId, useRef, useState } from 'react'
import { ExternalLink, FileText, RefreshCw } from 'lucide-react'
import { Button } from '../ui/Button'
import { ModalDialog } from '../ui/ModalDialog'
import { SyncContent, SyncLine } from '../ui/SyncLine'
import { openExternalUrl } from '../../lib/openExternal'
import { showICloudSync } from '../../lib/platformGates'
import { barChartPageUrl } from '../../lib/targets/targetsUrls'
import { importBarChartFile, removeBarChartFile } from '../../lib/barChart/barChartImport'
import { monthRangeLabel } from '../../lib/barChart/barChartFilename'
import type { BarChartJoin } from '../../lib/barChart/barChartJoin'
import type { BarChartState } from '../../lib/targets/useBarChartFile'
import { icloudActions, syncOrigin, useICloudState, type SlotView } from '../../lib/icloud/icloudState'
import { BUTTONS, hereWord, removeCountyBody, removeCountyTitle } from '../../lib/icloud/icloudCopy'
import {
  ADD_FILE, ADD_FILE_DETAIL_ACTION, ADD_FILE_DETAIL_LEAD, ADD_FILE_DETAIL_TAIL, ADD_FILE_SYNC_NOTE, FILE_SECTION_LABEL,
  FILE_STATUS_UNKNOWN, FILE_UNREADABLE, HIDE_UNMATCHED, OPENS_NEW_TAB, POOL_NOT_LOADED, REMOVE_FAILED, REMOVE_FILE,
  REPLACE_FILE, RETRY, SHOW_UNMATCHED, addFileTitle, fileTitle, inICloudTitle, joinDetail, openBarChartLink,
  unmatchedIntro,
} from '../../lib/targets/targetsCopy'

interface Props {
  regionCode: string
  county: string
  state: BarChartState
  join: BarChartJoin | null
  onRetry: () => void
}

export function TargetsBarChartFile({ regionCode, county, state, join, onRetry }: Props) {
  const uid = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const pickRef = useRef<HTMLButtonElement>(null)
  const removeRef = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  const [alert, setAlert] = useState<{ message: string; seq: number } | null>(null)
  const [showUnmatched, setShowUnmatched] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const discId = `${uid}-unmatched`

  // The platform gate (gated markup, never hidden markup) and the county's view.
  const gate = showICloudSync()
  const ics = useICloudState()
  const syncOn = gate && ics.syncEnabled
  const syncView: SlotView | null = gate && Object.hasOwn(ics.barCharts, regionCode) ? ics.barCharts[regionCode] : null

  const say = (message: string) => setAlert(prev => ({ message, seq: (prev?.seq ?? 0) + 1 }))

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''   // picking the same file again must fire a change
    if (!file) return
    setBusy(true)
    try {
      // With sync on, this device is the file's origin (FR-07); the county's
      // line reads "Syncing, uploading" at once and the check pushes it.
      const origin = gate ? syncOrigin(ics) ?? undefined : undefined
      const res = await importBarChartFile(regionCode, county, file.name, () => file.text(), origin)
      if (res.ok) { setAlert(null); setShowUnmatched(false) } else say(res.reason)
    } finally {
      setBusy(false)
    }
  }

  /** The local removal. Resolves true when the file is gone. */
  const onRemove = async (): Promise<boolean> => {
    setBusy(true)
    try {
      await removeBarChartFile(regionCode)
      setAlert(null)
      setShowUnmatched(false)
      return true
    } catch {
      say(REMOVE_FAILED)
      return false
    } finally {
      setBusy(false)
    }
  }

  // With sync on, Remove asks first (FR-10); with sync off it is the instant
  // local action it always was.
  const onRemoveClick = () => {
    if (syncOn) setConfirmOpen(true)
    else void onRemove()
  }

  const onConfirmRemove = async () => {
    setConfirmOpen(false)
    const clearedAt = new Date().toISOString()
    if (await onRemove()) void icloudActions.barChartsCleared([regionCode], clearedAt)
  }

  const url = barChartPageUrl(regionCode)
  const pageLink = url ? (
    <Button type="button" className="sr-tg-link" onClick={() => openExternalUrl(url)}>
      {openBarChartLink(county)}
      <ExternalLink size={12} strokeWidth={2.2} aria-hidden="true" />
      <span className="sr-only">{OPENS_NEW_TAB}</span>
    </Button>
  ) : null

  const picker = (
    <input ref={inputRef} type="file" accept=".txt,.tsv" style={{ display: 'none' }} onChange={e => { void onPick(e) }} />
  )
  const pickButton = (label: string, accent: boolean) => (
    <Button
      ref={pickRef}
      type="button"
      className={accent ? 'sr-btn-accent' : 'sr-btn-quiet'}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={() => inputRef.current?.click()}
    >
      {accent ? <FileText size={13} strokeWidth={2.2} aria-hidden="true" /> : null}{label}
    </Button>
  )
  const removeButton = (
    <Button ref={removeRef} type="button" className="sr-btn-quiet sr-btn-quiet--danger" disabled={busy} onClick={onRemoveClick}>
      {REMOVE_FILE}
    </Button>
  )

  // Every state renders the same skeleton, so the sync line keeps ONE position
  // (the third child of the line) and is never remounted by a state change: a
  // live region inserted with its message is never announced (ui.md).
  let title: React.ReactNode = null
  let detail: React.ReactNode
  let actions: React.ReactNode = null
  let disclosure: React.ReactNode = null

  if (state.status === 'unknown') {
    title = <span className="sr-tg-file-title">{FILE_STATUS_UNKNOWN}</span>
    detail = (
      <span className="sr-tg-file-detail">
        <Button type="button" className="sr-tg-link" onClick={onRetry}>
          <RefreshCw size={12} strokeWidth={2.2} aria-hidden="true" />{RETRY}
        </Button>
      </span>
    )
  } else if (state.status === 'present' || state.status === 'unreadable') {
    const unmatched = join?.unmatched ?? []
    title = (
      <span className="sr-tg-file-title">
        {state.status === 'present' ? fileTitle(county, state.range.years, monthRangeLabel(state.range.months)) : FILE_UNREADABLE}
      </span>
    )
    detail = (
      <span className="sr-tg-file-detail">
        {state.status === 'present' ? (
          join ? (
            <>
              {joinDetail(join.matched, join.skippedForms, unmatched.length)}
              {unmatched.length > 0 ? (
                <>
                  {' · '}
                  <Button
                    type="button"
                    className="sr-tg-link"
                    aria-expanded={showUnmatched}
                    aria-controls={discId}
                    onClick={() => setShowUnmatched(v => !v)}
                  >
                    {showUnmatched ? HIDE_UNMATCHED : SHOW_UNMATCHED}
                  </Button>
                </>
              ) : null}
            </>
          ) : POOL_NOT_LOADED
        ) : null}
        {state.status === 'present' ? ' · ' : null}
        {state.meta.filename}
      </span>
    )
    actions = (
      <div className="sr-tg-file-actions">
        {pickButton(REPLACE_FILE, false)}
        {removeButton}
      </div>
    )
    if (state.status === 'present' && unmatched.length > 0) {
      disclosure = (
        <div className={`sr-tg-disc${showUnmatched ? ' is-open' : ''}`} id={discId}>
          <div inert={!showUnmatched}>
            <div className="sr-tg-disc-body">
              {unmatchedIntro(county)}
              <ul>
                {unmatched.map((u, i) => (
                  <li key={i}>{u.name}{u.sciName ? <> (<i>{u.sciName}</i>)</> : null}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )
    }
  } else if (state.status === 'absent') {
    // The county's file is in iCloud but not on this device: say so in the
    // title, and keep the add path beneath (a file added here is the newer
    // upload and wins, FR-01).
    const inICloudOnly = syncView?.state === 'in-icloud-not-downloaded'
    title = <span className="sr-tg-file-title">{inICloudOnly ? inICloudTitle(county) : addFileTitle(county)}</span>
    detail = (
      <span className="sr-tg-file-detail">
        {ADD_FILE_DETAIL_LEAD}<b>{ADD_FILE_DETAIL_ACTION}</b>{ADD_FILE_DETAIL_TAIL}{' '}
        {syncOn && !inICloudOnly ? <>{ADD_FILE_SYNC_NOTE}{' '}</> : null}
        {pageLink}
      </span>
    )
    actions = <div className="sr-tg-file-actions">{pickButton(ADD_FILE, true)}</div>
  } else {
    detail = <span className="sr-tg-file-detail" aria-busy="true">{' '}</span>
  }

  const syncLine = gate ? (
    <SyncLine
      view={syncView}
      render={(v) => (
        <SyncContent
          view={v}
          onDownloadNow={() => { void icloudActions.downloadBarChartNow(regionCode) }}
          onRetry={() => { void icloudActions.retryBarChart(regionCode) }}
        />
      )}
    />
  ) : null

  return (
    <section className="sr-tg-file-sec" aria-labelledby={`${uid}-label`}>
      <span className="sr-tg-seclabel" id={`${uid}-label`}>{FILE_SECTION_LABEL}</span>
      <div className="sr-tg-file-card">
        <div className="sr-tg-file-main">
          <FileText size={16} strokeWidth={2} aria-hidden="true" />
          <div className="sr-tg-file-line">
            {title}
            {detail}
            {syncLine}
          </div>
        </div>
        {actions}
        {disclosure}
        {picker}
        <div role="alert" className="sr-tg-alert">
          {alert ? <Fragment key={alert.seq}>{alert.message}</Fragment> : null}
        </div>
      </div>
      {gate ? (
        <ModalDialog
          open={confirmOpen}
          title={removeCountyTitle(county)}
          trigger={() => removeRef.current}
          fallbackFocus={() => pickRef.current}
          onRequestClose={() => setConfirmOpen(false)}
          initialFocus="first"
          actions={
            <>
              <Button type="button" className="sr-btn-quiet sr-touch-target" onClick={() => setConfirmOpen(false)}>{BUTTONS.cancel}</Button>
              <Button type="button" className="sr-btn-quiet sr-btn-quiet--danger sr-touch-target" onClick={() => { void onConfirmRemove() }}>
                {BUTTONS.removeAllSynced}
              </Button>
            </>
          }
        >
          <p className="sr-dlg-text">{removeCountyBody(county, hereWord(ics.platform))}</p>
        </ModalDialog>
      ) : null}
    </section>
  )
}
