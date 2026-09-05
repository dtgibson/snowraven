// @vitest-environment jsdom
// Guard for improve: ml-export-hardening.
//
// `Settings.importFileContent` is the one place an upload can be refused, on every
// platform: `IOS_IMPORT_MECHANISM` is `'input'`, so the file input serves desktop,
// web, Pi, iPhone and iPad alike, and the native picker path (Mechanism B) calls
// straight into the same tail. Until this build the only thing it checked was that
// the NAME ended in `.csv`, so `MyEBirdData.csv` dropped into the ML Export slot
// was written to disk and failed later on the Multimedia tab, where nothing could
// say which file was wrong; and a file of any size was written on desktop and iOS,
// which have no cap.
//
// Four claims, each asserted for BOTH slots because the two rows share one code
// path and code symmetry is not evidence symmetry (v1.0.14):
//
//   1. A REFUSED UPLOAD IS NOT A WRITE. The message is necessary but not
//      sufficient; the row must also prove `storage.writeFile` never ran, that the
//      caches were not invalidated, and that the files epoch was not bumped. A
//      refusal that still replaced the stored file would be the worse bug.
//   2. THE MESSAGE RENDERS IN THE ROW'S EXISTING ERROR LINE, the same `role="alert"`
//      line that has always carried "Only .csv files are accepted." No new state,
//      control or screen: the absent case asserts nothing else appeared.
//   3. IT IS THE RIGHT ROW'S LINE. A file refused in the ML slot must not put a
//      message under eBird Backup.
//   4. THE HAPPY PATH IS UNCHANGED. A real export in its own slot still stores,
//      still invalidates its cache, and still reports no error, so the rows above
//      are not passing because uploads stopped working.
//
// The messages themselves are imported from `lib/uploadGuard` rather than retyped,
// so these rows prove DELIVERY; their CONTENT is pinned once, in
// `uploadGuard.test.ts`, against literals written there (the v0.5.88 rule about a
// reference point derived from the thing being verified).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const storageMock = vi.hoisted(() => ({
  getFilesStatus: vi.fn(),
  getApiKey: vi.fn(),
  getSetting: vi.fn(),
  setApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
  setSetting: vi.fn(),
  deleteSetting: vi.fn(),
}))
vi.mock('../lib/storage', () => ({ storage: storageMock }))
vi.mock('../lib/platform', () => ({
  isTauri: vi.fn(() => false),
  isIOS: vi.fn(() => false),
  isWindows: vi.fn(() => false),
  isMacOS: vi.fn(() => false),
}))
const caches = vi.hoisted(() => ({ clearEbird: vi.fn(), clearML: vi.fn(), invalidateHotspotSet: vi.fn() }))
vi.mock('../lib/observationsCache', () => ({ clearEbirdObservationsCache: caches.clearEbird }))
vi.mock('../lib/mlExportCache', () => ({ clearMLExportCache: caches.clearML }))
vi.mock('../lib/useHotspotSet', () => ({ invalidateHotspotSet: caches.invalidateHotspotSet }))
vi.mock('../lib/networkCache', () => ({ clearNetworkCache: vi.fn() }))
vi.mock('../lib/iosImport', () => ({ IOS_IMPORT_MECHANISM: 'input', pickCsvViaDialog: vi.fn() }))

import { Settings } from './Settings'
import { DEFAULT_TAB_ORDER } from '../lib/tabLayout'
import type { ConfigurableTab } from '../lib/tabLayout'
import {
  MAX_UPLOAD_BYTES, CSV_ONLY_MESSAGE, TOO_LARGE_MESSAGE, wrongExportMessage,
} from '../lib/uploadGuard'

// The two headers, in the real column order both services emit. Written out here
// rather than read from the tracked demo exports because this file runs under jsdom,
// where `import.meta.url` is an http URL and node:fs cannot resolve it; the demo
// exports themselves are swept in `uploadGuard.test.ts`, which runs under node.
const DEMO_ML = [
  'ML Catalog Number,Format,Common Name,Scientific Name,Date,Locality,eBird Checklist ID',
  '612000000,Photo,American Wigeon,Mareca americana,2024-01-03,Prospect Park,S9000000000',
].join('\n') + '\n'
const DEMO_EBIRD = [
  'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,County,Location,Date,ML Catalog Numbers',
  'S9000000000,American Wigeon,Mareca americana,271,2,Kings,Prospect Park,2024-01-03,',
].join('\n') + '\n'

/** The two rows, in the DOM order Settings renders them: eBird Backup, then ML
 *  Export. A third slot would read as a missing row rather than as nothing. */
const SLOTS = [
  { slot: 'ebird' as const, index: 0, label: 'eBird Backup', own: DEMO_EBIRD, other: DEMO_ML, ownName: 'MyEBirdData.csv', clears: caches.clearEbird },
  { slot: 'ml' as const, index: 1, label: 'ML Export', own: DEMO_ML, other: DEMO_EBIRD, ownName: 'ML__2024_abc.csv', clears: caches.clearML },
]

function renderSettings(onFilesSaved = vi.fn()) {
  const props: React.ComponentProps<typeof Settings> = {
    onOpenHelp: vi.fn(),
    textScale: 1,
    onTextScaleChange: vi.fn(),
    tabOrder: [...DEFAULT_TAB_ORDER],
    tabHidden: new Set<ConfigurableTab>(),
    onReorder: vi.fn(),
    onToggleVisibility: vi.fn(),
    onRestoreDefaults: vi.fn(),
    disableEmbeddedMedia: false,
    embeddedMediaPreferenceSaving: false,
    embeddedMediaPreferenceError: null,
    onDisableEmbeddedMediaChange: vi.fn(),
    onFilesSaved,
  }
  const utils = render(<Settings {...props} />)
  return { ...utils, onFilesSaved }
}

/** Drive the file input for one slot with a File carrying `content`. */
function upload(container: HTMLElement, index: number, name: string, content: string) {
  const inputs = container.querySelectorAll('input[type="file"]')
  expect(inputs.length).toBe(2)          // the roster is complete
  const input = inputs[index] as HTMLInputElement
  const file = new File([content], name, { type: 'text/csv' })
  // jsdom's File.text() is present but the component only needs the string.
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

const alerts = () => screen.queryAllByRole('alert').map(n => n.textContent)

beforeEach(() => {
  for (const fn of Object.values(storageMock)) fn.mockReset()
  storageMock.getFilesStatus.mockResolvedValue({ ebird: null, ml: null })
  storageMock.getApiKey.mockResolvedValue(null)
  storageMock.getSetting.mockResolvedValue(null)
  storageMock.writeFile.mockResolvedValue(undefined)
  storageMock.deleteFile.mockResolvedValue(undefined)
  storageMock.setSetting.mockResolvedValue(undefined)
  storageMock.deleteSetting.mockResolvedValue(undefined)
  caches.clearEbird.mockReset()
  caches.clearML.mockReset()
  caches.invalidateHotspotSet.mockReset()
})

afterEach(cleanup)

describe('a refused upload shows a reason and stores nothing', () => {
  it.each(SLOTS.map(r => [r.label, r] as const))(
    '%s refuses the other slot\'s export, naming what this slot takes',
    async (_l, row) => {
      const { container, onFilesSaved } = renderSettings()
      await waitFor(() => expect(container.querySelectorAll('input[type="file"]').length).toBe(2))

      upload(container, row.index, 'SomeExport.csv', row.other)

      await waitFor(() => expect(alerts()).toContain(wrongExportMessage(row.slot)))
      // The refusal is not a replace: nothing was written, no cache was dropped,
      // and no tab was told a file changed.
      expect(storageMock.writeFile).not.toHaveBeenCalled()
      expect(caches.clearEbird).not.toHaveBeenCalled()
      expect(caches.clearML).not.toHaveBeenCalled()
      expect(onFilesSaved).not.toHaveBeenCalled()
      // ...and no other row grew a message.
      expect(alerts()).toEqual([wrongExportMessage(row.slot)])
    },
  )

  it.each(SLOTS.map(r => [r.label, r] as const))(
    '%s refuses a CSV that is neither export',
    async (_l, row) => {
      const { container } = renderSettings()
      await waitFor(() => expect(container.querySelectorAll('input[type="file"]').length).toBe(2))

      upload(container, row.index, 'notes.csv', 'name,value\n1,2\n')

      await waitFor(() => expect(alerts()).toEqual([wrongExportMessage(row.slot)]))
      expect(storageMock.writeFile).not.toHaveBeenCalled()
    },
  )

  it.each(SLOTS.map(r => [r.label, r] as const))(
    '%s refuses a file over the 50 MB cap, and says so rather than blaming the file type',
    async (_l, row) => {
      const { container } = renderSettings()
      await waitFor(() => expect(container.querySelectorAll('input[type="file"]').length).toBe(2))

      // The RIGHT export for this slot, past the cap: the message must be about
      // size, or the user goes looking for a different download.
      upload(container, row.index, row.ownName, row.own + 'x'.repeat(MAX_UPLOAD_BYTES))

      await waitFor(() => expect(alerts()).toEqual([TOO_LARGE_MESSAGE]))
      expect(storageMock.writeFile).not.toHaveBeenCalled()
    },
  )

  it.each(SLOTS.map(r => [r.label, r] as const))(
    '%s still refuses a name that is not .csv, before reading the file at all',
    async (_l, row) => {
      const { container } = renderSettings()
      await waitFor(() => expect(container.querySelectorAll('input[type="file"]').length).toBe(2))

      const inputs = container.querySelectorAll('input[type="file"]')
      const input = inputs[row.index] as HTMLInputElement
      const read = vi.fn(() => Promise.resolve(row.own))
      const file = new File([row.own], 'export.zip', { type: 'application/zip' })
      Object.defineProperty(file, 'text', { value: read })
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      fireEvent.change(input)

      await waitFor(() => expect(alerts()).toEqual([CSV_ONLY_MESSAGE]))
      expect(read).not.toHaveBeenCalled()
      expect(storageMock.writeFile).not.toHaveBeenCalled()
    },
  )
})

describe('the accepted upload is unchanged', () => {
  it.each(SLOTS.map(r => [r.label, r] as const))(
    '%s stores its own export, invalidates its cache, and shows no error',
    async (_l, row) => {
      const { container, onFilesSaved } = renderSettings()
      await waitFor(() => expect(container.querySelectorAll('input[type="file"]').length).toBe(2))

      upload(container, row.index, row.ownName, row.own)

      await waitFor(() => expect(storageMock.writeFile).toHaveBeenCalledWith(row.slot, row.own, row.ownName, undefined))
      await waitFor(() => expect(onFilesSaved).toHaveBeenCalled())
      expect(row.clears).toHaveBeenCalled()
      expect(alerts()).toEqual([])
    },
  )

  it('a refusal clears once a good file follows it, so the row is not stuck', async () => {
    const { container } = renderSettings()
    await waitFor(() => expect(container.querySelectorAll('input[type="file"]').length).toBe(2))

    upload(container, 1, 'MyEBirdData.csv', DEMO_EBIRD)
    await waitFor(() => expect(alerts()).toEqual([wrongExportMessage('ml')]))

    upload(container, 1, 'ML__2024_abc.csv', DEMO_ML)
    await waitFor(() => expect(storageMock.writeFile).toHaveBeenCalled())
    await waitFor(() => expect(alerts()).toEqual([]))
  })
})
