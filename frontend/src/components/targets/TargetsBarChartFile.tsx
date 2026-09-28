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

import { Fragment, useId, useRef, useState } from 'react'
import { ExternalLink, FileText, RefreshCw } from 'lucide-react'
import { Button } from '../ui/Button'
import { openExternalUrl } from '../../lib/openExternal'
import { barChartPageUrl } from '../../lib/targets/targetsUrls'
import { importBarChartFile, removeBarChartFile } from '../../lib/barChart/barChartImport'
import { monthRangeLabel } from '../../lib/barChart/barChartFilename'
import type { BarChartJoin } from '../../lib/barChart/barChartJoin'
import type { BarChartState } from '../../lib/targets/useBarChartFile'
import {
  ADD_FILE, ADD_FILE_DETAIL_ACTION, ADD_FILE_DETAIL_LEAD, ADD_FILE_DETAIL_TAIL, FILE_SECTION_LABEL, FILE_STATUS_UNKNOWN,
  FILE_UNREADABLE, HIDE_UNMATCHED, OPENS_NEW_TAB, POOL_NOT_LOADED, REMOVE_FAILED, REMOVE_FILE, REPLACE_FILE, RETRY,
  SHOW_UNMATCHED, addFileTitle, fileTitle, joinDetail, openBarChartLink, unmatchedIntro,
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
  const [busy, setBusy] = useState(false)
  const [alert, setAlert] = useState<{ message: string; seq: number } | null>(null)
  const [showUnmatched, setShowUnmatched] = useState(false)
  const discId = `${uid}-unmatched`

  const say = (message: string) => setAlert(prev => ({ message, seq: (prev?.seq ?? 0) + 1 }))

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''   // picking the same file again must fire a change
    if (!file) return
    setBusy(true)
    try {
      const res = await importBarChartFile(regionCode, county, file.name, () => file.text())
      if (res.ok) { setAlert(null); setShowUnmatched(false) } else say(res.reason)
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async () => {
    setBusy(true)
    try {
      await removeBarChartFile(regionCode)
      setAlert(null)
      setShowUnmatched(false)
    } catch {
      say(REMOVE_FAILED)
    } finally {
      setBusy(false)
    }
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
    <Button type="button" className="sr-btn-quiet sr-btn-quiet--danger" disabled={busy} onClick={() => { void onRemove() }}>
      {REMOVE_FILE}
    </Button>
  )

  let body: React.ReactNode
  if (state.status === 'unknown') {
    body = (
      <div className="sr-tg-file-main">
        <FileText size={16} strokeWidth={2} aria-hidden="true" />
        <div className="sr-tg-file-line">
          <span className="sr-tg-file-title">{FILE_STATUS_UNKNOWN}</span>
          <span className="sr-tg-file-detail">
            <Button type="button" className="sr-tg-link" onClick={onRetry}>
              <RefreshCw size={12} strokeWidth={2.2} aria-hidden="true" />{RETRY}
            </Button>
          </span>
        </div>
      </div>
    )
  } else if (state.status === 'present' || state.status === 'unreadable') {
    const title = state.status === 'present'
      ? fileTitle(county, state.range.years, monthRangeLabel(state.range.months))
      : FILE_UNREADABLE
    const unmatched = join?.unmatched ?? []
    body = (
      <>
        <div className="sr-tg-file-main">
          <FileText size={16} strokeWidth={2} aria-hidden="true" />
          <div className="sr-tg-file-line">
            <span className="sr-tg-file-title">{title}</span>
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
          </div>
        </div>
        <div className="sr-tg-file-actions">
          {pickButton(REPLACE_FILE, false)}
          {removeButton}
        </div>
        {state.status === 'present' && unmatched.length > 0 ? (
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
        ) : null}
      </>
    )
  } else if (state.status === 'absent') {
    body = (
      <>
        <div className="sr-tg-file-main">
          <FileText size={16} strokeWidth={2} aria-hidden="true" />
          <div className="sr-tg-file-line">
            <span className="sr-tg-file-title">{addFileTitle(county)}</span>
            <span className="sr-tg-file-detail">
              {ADD_FILE_DETAIL_LEAD}<b>{ADD_FILE_DETAIL_ACTION}</b>{ADD_FILE_DETAIL_TAIL}{' '}
              {pageLink}
            </span>
          </div>
        </div>
        <div className="sr-tg-file-actions">{pickButton(ADD_FILE, true)}</div>
      </>
    )
  } else {
    body = (
      <div className="sr-tg-file-main">
        <FileText size={16} strokeWidth={2} aria-hidden="true" />
        <div className="sr-tg-file-line"><span className="sr-tg-file-detail" aria-busy="true">{' '}</span></div>
      </div>
    )
  }

  return (
    <section className="sr-tg-file-sec" aria-labelledby={`${uid}-label`}>
      <span className="sr-tg-seclabel" id={`${uid}-label`}>{FILE_SECTION_LABEL}</span>
      <div className="sr-tg-file-card">
        {body}
        {picker}
        <div role="alert" className="sr-tg-alert">
          {alert ? <Fragment key={alert.seq}>{alert.message}</Fragment> : null}
        </div>
      </div>
    </section>
  )
}
