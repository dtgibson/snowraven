// The import tail for a county's eBird bar-chart file (targets-tab, schema.md
// section 2.4). Lazy: it rides the Targets chunk with the parser it calls.
//
// THE ORDER IS THE CONTRACT (FR-27, FR-37, QA-29):
//   1. the filename refusal, BEFORE the bytes are read (a picked `.zip` is never
//      read into memory to be refused afterwards);
//   2. the content refusals, BEFORE anything is written (size, the filename's
//      region code, the layout: lib/uploadGuard.ts owns all three);
//   3. the one write, which overwrites the file and its manifest entry together
//      (Add and Replace are the same call);
//   4. the one epoch bump, only after the write resolved.
// A refusal therefore stores nothing, clears nothing and bumps nothing, and the
// county's existing file and manifest entry are byte-identical afterwards.
//
// icloud-bar-chart-sync: with iCloud Sync on the caller passes this device as
// the file's `origin`; the entry records it, the county's line reads "Syncing,
// uploading" at once, and the epoch bump is what runs the check that pushes it.

import { storage, type FileOrigin } from '../storage'
import { notifyBarChartFilesChanged } from '../barChartFilesChanged'
import { icloudActions } from '../icloud/icloudState'
import { refuseBarChartByContent, refuseByFilename } from '../uploadGuard'
import { parseBarChart } from './parseBarChart'

/** The file could not be read from the picker (a revoked handle, an I/O error). */
export const BARCHART_READ_FAILED_MESSAGE = 'Could not read the file. Please try again.'

/** The write itself failed (a full disk; on web/Pi a non-OK answer). */
export const BARCHART_SAVE_FAILED_MESSAGE = 'Could not save the file. Please try again.'

export type BarChartImportResult = { ok: true } | { ok: false; reason: string }

export async function importBarChartFile(
  regionCode: string,
  countyLabel: string,
  filename: string,
  getContent: () => Promise<string>,
  origin?: FileOrigin,
): Promise<BarChartImportResult> {
  const nameRefusal = refuseByFilename(filename, 'barchart')
  if (nameRefusal) return { ok: false, reason: nameRefusal }

  let content: string
  try {
    content = await getContent()
  } catch {
    return { ok: false, reason: BARCHART_READ_FAILED_MESSAGE }
  }

  const contentRefusal = refuseBarChartByContent(content, { filename, regionCode, countyLabel }, parseBarChart)
  if (contentRefusal) return { ok: false, reason: contentRefusal }

  try {
    if (origin) await storage.writeBarChartFile(regionCode, content, filename, origin)
    else await storage.writeBarChartFile(regionCode, content, filename)
  } catch {
    return { ok: false, reason: BARCHART_SAVE_FAILED_MESSAGE }
  }
  // The line first, then the bump that runs the check (schema.md 5.7).
  if (origin) icloudActions.barChartSaved(regionCode)
  notifyBarChartFilesChanged()
  return { ok: true }
}

/**
 * Remove a county's file: the delete, then exactly one bump. A failed delete
 * rethrows WITHOUT bumping, so no reader re-reads a manifest that did not
 * change; the caller reports the failure.
 */
export async function removeBarChartFile(regionCode: string): Promise<void> {
  await storage.deleteBarChartFile(regionCode)
  notifyBarChartFilesChanged()
}

/**
 * Remove EVERY saved bar-chart file on this device (icloud-bar-chart-sync
 * FR-21, FR-22): one seam call, which rewrites the manifest to exactly the
 * files it could not remove, then exactly one bump when anything went. The
 * LOCAL removal only: the Settings control hands the removed codes to
 * `icloudActions.barChartsCleared` afterwards when sync is on. A rejected seam
 * call rethrows without bumping; the caller reports it.
 */
export async function clearAllBarChartFiles(): Promise<{ removed: string[]; failed: string[] }> {
  const result = await storage.deleteAllBarChartFiles()
  if (result.removed.length > 0) notifyBarChartFilesChanged()
  return result
}
