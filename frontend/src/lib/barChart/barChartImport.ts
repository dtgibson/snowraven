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

import { storage } from '../storage'
import { notifyBarChartFilesChanged } from '../barChartFilesChanged'
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
    await storage.writeBarChartFile(regionCode, content, filename)
  } catch {
    return { ok: false, reason: BARCHART_SAVE_FAILED_MESSAGE }
  }
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
