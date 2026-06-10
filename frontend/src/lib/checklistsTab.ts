// Pure data layer for the Checklists tab: per-checklist row data + filter flags,
// the two comment-search boxes' entries, and the composable AND filters. No
// React, no I/O — unit-tested like lib/mediaComments.ts. See
// pipeline/checklists-tab/{prd,schema,design-spec}.md.
//
// Weather/tide toggle semantics (PRD FR-05/06/07): while blocks are hidden,
// display AND search both run on stripWeatherTideBlocks() output, and a comment
// that is empty after stripping counts as NO comment (boxes and filters alike).
// The has-weather/has-tide FILTER FLAGS are toggle-independent (FR-08) — they
// describe the raw comment.

import type { ObservationEntry, ChecklistEntry, DateRangeState } from '../types'
import { computeChecklists } from './birdingStats'
import { decodeEntities } from './commentText'
import { hasWeatherBlock, hasTideBlock, stripWeatherTideBlocks } from './commentBlocks'
import { observationMediaFormats, type MediaFormat } from './observationMedia'

export type TriState = 'has' | 'no' | null

export interface ChecklistRowData {
  checklist: ChecklistEntry
  /** Decoded checklist comment, blocks intact. */
  commentFull: string
  /** Decoded checklist comment with weather/tide blocks stripped. */
  commentStripped: string
  hasSpeciesComments: boolean
  /** From the backup's ML catalog numbers — works without the ML export. */
  hasAnyMedia: boolean
  /** Per-type formats via the ML export join; empty when no export is loaded. */
  mediaFormats: Set<MediaFormat>
  hasBreeding: boolean
  weatherBlock: boolean
  tideBlock: boolean
}

/** One row per checklist with every filterable flag pre-derived in one pass.
 *  `mediaMap` is the ML export's catalogId → format map (null without it). */
export function buildChecklistRows(
  observations: ObservationEntry[],
  mediaMap: Record<string, string> | null,
): ChecklistRowData[] {
  const checklists = computeChecklists(observations)

  const spComments = new Map<string, boolean>()
  const anyMedia = new Map<string, boolean>()
  const catalogIds = new Map<string, string[]>()
  const breeding = new Map<string, boolean>()
  for (const o of observations) {
    const id = o.submissionId
    if (o.speciesComments.trim()) spComments.set(id, true)
    if (o.catalogIds.length > 0) {
      anyMedia.set(id, true)
      if (mediaMap) {
        const ids = catalogIds.get(id)
        if (ids) ids.push(...o.catalogIds)
        else catalogIds.set(id, [...o.catalogIds])
      }
    }
    if (o.breedingCode !== null) breeding.set(id, true)
  }

  return checklists.map(c => {
    const raw = c.checklistComments
    return {
      checklist: c,
      commentFull: decodeEntities(raw).trim(),
      commentStripped: stripWeatherTideBlocks(raw),
      hasSpeciesComments: spComments.get(c.submissionId) ?? false,
      hasAnyMedia: anyMedia.get(c.submissionId) ?? false,
      mediaFormats: mediaMap
        ? observationMediaFormats(catalogIds.get(c.submissionId) ?? [], mediaMap)
        : new Set<MediaFormat>(),
      hasBreeding: breeding.get(c.submissionId) ?? false,
      weatherBlock: hasWeatherBlock(raw),
      tideBlock: hasTideBlock(raw),
    }
  })
}

/** The comment text to render for a row under the current toggle ('' = none). */
export function displayComment(row: ChecklistRowData, showBlocks: boolean): string {
  return showBlocks ? row.commentFull : row.commentStripped
}

// ── Comment-search boxes ─────────────────────────────────────────────────────

export interface ChecklistCommentEntry {
  submissionId: string
  date: string
  location: string
  text: string
}

export interface SpeciesCommentEntry extends ChecklistCommentEntry {
  commonName: string
  scientificName: string
}

/** One entry per checklist whose comment is non-empty under the toggle. */
export function buildChecklistComments(
  rows: ChecklistRowData[],
  showBlocks: boolean,
): ChecklistCommentEntry[] {
  const out: ChecklistCommentEntry[] = []
  for (const r of rows) {
    const text = displayComment(r, showBlocks)
    if (!text) continue
    out.push({
      submissionId: r.checklist.submissionId,
      date: r.checklist.date,
      location: r.checklist.location,
      text,
    })
  }
  return out
}

/** One entry per observation whose species comment is non-empty under the
 *  toggle (FR-05 applies to species comments too — a pasted block hides). */
export function buildSpeciesComments(
  observations: ObservationEntry[],
  showBlocks: boolean,
): SpeciesCommentEntry[] {
  const out: SpeciesCommentEntry[] = []
  for (const o of observations) {
    if (!o.speciesComments.trim()) continue
    const text = showBlocks
      ? decodeEntities(o.speciesComments).trim()
      : stripWeatherTideBlocks(o.speciesComments)
    if (!text) continue
    out.push({
      submissionId: o.submissionId,
      date: o.date,
      location: o.location,
      text,
      commonName: o.commonName,
      scientificName: o.scientificName,
    })
  }
  return out
}

/** Case-insensitive substring filter over `text`, then date sort (submission id
 *  breaks ties for stable order). Search runs on the entry's display text, so
 *  hidden block content can never match (FR-06). */
export function filterAndSortComments<T extends ChecklistCommentEntry>(
  entries: T[],
  query: string,
  sort: 'newest' | 'oldest',
): T[] {
  const q = query.trim().toLowerCase()
  const matched = q ? entries.filter(e => e.text.toLowerCase().includes(q)) : [...entries]
  const dir = sort === 'newest' ? -1 : 1
  return matched.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    if (byDate !== 0) return dir * byDate
    return dir * a.submissionId.localeCompare(b.submissionId)
  })
}

// ── The all-checklists list ──────────────────────────────────────────────────

export interface ChecklistFilterState {
  checklistComment: TriState
  speciesComments: TriState
  media: TriState
  breeding: TriState
  weatherBlock: TriState
  tideBlock: TriState
  complete: TriState
  photo: TriState
  audio: TriState
  video: TriState
  protocol: string | null   // raw eBird protocol id (e.g. "P22")
  county: string | null
  dateRange: DateRangeState
}

export const CHECKLIST_FILTER_CLEAR: ChecklistFilterState = {
  checklistComment: null,
  speciesComments: null,
  media: null,
  breeding: null,
  weatherBlock: null,
  tideBlock: null,
  complete: null,
  photo: null,
  audio: null,
  video: null,
  protocol: null,
  county: null,
  dateRange: { from: '', to: '' },
}

/** True when every cycling pill is off (the "All" pill's active condition —
 *  county/date/protocol selects are intentionally not part of it). */
export function isPillFilterClear(f: ChecklistFilterState): boolean {
  return (
    f.checklistComment === null &&
    f.speciesComments === null &&
    f.media === null &&
    f.breeding === null &&
    f.weatherBlock === null &&
    f.tideBlock === null &&
    f.complete === null &&
    f.photo === null &&
    f.audio === null &&
    f.video === null
  )
}

function tri(value: boolean, state: TriState): boolean {
  return state === null || (state === 'has') === value
}

/** Whether a row currently HAS a checklist comment — toggle-aware (FR-07). */
export function rowHasComment(row: ChecklistRowData, showBlocks: boolean): boolean {
  return displayComment(row, showBlocks) !== ''
}

/** AND-composed filters (FR-19/20). `showBlocks` feeds the toggle-aware
 *  checklist-comment tri-state; the weather/tide flags ignore it (FR-08). */
export function filterChecklistRows(
  rows: ChecklistRowData[],
  f: ChecklistFilterState,
  showBlocks: boolean,
): ChecklistRowData[] {
  return rows.filter(r => {
    const c = r.checklist
    if (!tri(rowHasComment(r, showBlocks), f.checklistComment)) return false
    if (!tri(r.hasSpeciesComments, f.speciesComments)) return false
    if (!tri(r.hasAnyMedia, f.media)) return false
    if (!tri(r.hasBreeding, f.breeding)) return false
    if (!tri(r.weatherBlock, f.weatherBlock)) return false
    if (!tri(r.tideBlock, f.tideBlock)) return false
    // Complete/incomplete: a checklist without the All-Obs-Reported flag is
    // neither — it matches only when the filter is off.
    if (f.complete !== null && (c.allObsReported === null || (f.complete === 'has') !== c.allObsReported)) return false
    if (!tri(r.mediaFormats.has('Photo'), f.photo)) return false
    if (!tri(r.mediaFormats.has('Audio'), f.audio)) return false
    if (!tri(r.mediaFormats.has('Video'), f.video)) return false
    if (f.protocol !== null && c.protocol !== f.protocol) return false
    if (f.county !== null && c.county !== f.county) return false
    if (f.dateRange.from && c.date < f.dateRange.from) return false
    if (f.dateRange.to && c.date > f.dateRange.to) return false
    return true
  })
}

/** Date sort, newest first by default (submission id breaks date ties). */
export function sortChecklistRows(
  rows: ChecklistRowData[],
  sort: 'newest' | 'oldest',
): ChecklistRowData[] {
  const dir = sort === 'newest' ? -1 : 1
  return [...rows].sort((a, b) => {
    const byDate = a.checklist.date.localeCompare(b.checklist.date)
    if (byDate !== 0) return dir * byDate
    return dir * a.checklist.submissionId.localeCompare(b.checklist.submissionId)
  })
}
