// The user-approved iOS "Import" wording (pipeline/mobile-app/decisions.md,
// 2026-07-05) vs the unchanged desktop/web "Upload" wording — locked verbatim
// so a copy drift on either platform fails the suite (FR-12).
import { describe, it, expect } from 'vitest'
import { fileRowButtonLabel } from './fileRowCopy'

describe('fileRowButtonLabel', () => {
  it('iOS uses the approved Import wording, verbatim', () => {
    expect(fileRowButtonLabel(false, false, true)).toBe('Import file…')
    expect(fileRowButtonLabel(false, true, true)).toBe('Import new…')
    expect(fileRowButtonLabel(true, false, true)).toBe('Importing…')
    expect(fileRowButtonLabel(true, true, true)).toBe('Importing…')
  })

  it('desktop/web keep the shipped Upload wording, verbatim', () => {
    expect(fileRowButtonLabel(false, false, false)).toBe('Upload file')
    expect(fileRowButtonLabel(false, true, false)).toBe('Upload new')
    expect(fileRowButtonLabel(true, false, false)).toBe('Uploading…')
    expect(fileRowButtonLabel(true, true, false)).toBe('Uploading…')
  })
})
