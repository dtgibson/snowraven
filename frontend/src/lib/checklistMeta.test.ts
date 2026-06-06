import { describe, it, expect } from 'vitest'
import { protocolName, submissionAppName, submissionLabel, formatDuration, formatDistance, formatObservers } from './checklistMeta'

describe('protocolName', () => {
  it('maps known protocol ids to display names', () => {
    expect(protocolName('P22')).toBe('Traveling')
    expect(protocolName('P21')).toBe('Stationary')
    expect(protocolName('P20')).toBe('Incidental')
    expect(protocolName('P23')).toBe('Area')
    expect(protocolName('P62')).toBe('Pelagic')
  })
  it('falls back to the raw id for unknown protocols, empty for blank', () => {
    expect(protocolName('P99')).toBe('P99')
    expect(protocolName('')).toBe('')
    expect(protocolName(null)).toBe('')
  })
})

describe('submissionAppName', () => {
  it('maps known submission codes to app names', () => {
    expect(submissionAppName('EBIRD_iOS')).toBe('eBird iOS')
    expect(submissionAppName('EBIRD_Android')).toBe('eBird Android')
    expect(submissionAppName('EBIRD_WEB')).toBe('eBird Website')
    expect(submissionAppName('EBIRD_API')).toBe('eBird API')
  })
  it('prettifies unknown EBIRD_ codes and passes through others', () => {
    expect(submissionAppName('EBIRD_Foo')).toBe('eBird Foo')
    expect(submissionAppName('THIRDPARTY')).toBe('THIRDPARTY')
    expect(submissionAppName('')).toBe('')
  })
})

describe('submissionLabel', () => {
  it('appends the version when present', () => {
    expect(submissionLabel('EBIRD_iOS', '3.6.5')).toBe('eBird iOS 3.6.5')
    expect(submissionLabel('EBIRD_Android', '2.20')).toBe('eBird Android 2.20')
  })
  it('omits the version when absent', () => {
    expect(submissionLabel('EBIRD_iOS', '')).toBe('eBird iOS')
    expect(submissionLabel('EBIRD_iOS', null)).toBe('eBird iOS')
  })
  it('is empty when there is no app', () => {
    expect(submissionLabel('', '3.6.5')).toBe('')
  })
})

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(0.95)).toBe('57 min')
    expect(formatDuration(1)).toBe('1 hr')
    expect(formatDuration(1.5)).toBe('1h 30m')
    expect(formatDuration(2.0833)).toBe('2h 5m')
  })
  it('is empty for null / zero', () => {
    expect(formatDuration(null)).toBe('')
    expect(formatDuration(undefined)).toBe('')
    expect(formatDuration(0)).toBe('')
  })
})

describe('formatDistance', () => {
  it('converts km to miles when miles were entered', () => {
    // 1.83 km ≈ 1.14 mi
    expect(formatDistance(1.83, 'mi')).toBe('1.14 mi')
  })
  it('shows km when km were entered', () => {
    expect(formatDistance(2.5, 'km')).toBe('2.5 km')
  })
  it('defaults to km when unit missing, empty for null', () => {
    expect(formatDistance(2, '')).toBe('2 km')
    expect(formatDistance(null, 'mi')).toBe('')
  })
})

describe('formatObservers', () => {
  it('singular / plural / empty', () => {
    expect(formatObservers(1)).toBe('1 observer')
    expect(formatObservers(3)).toBe('3 observers')
    expect(formatObservers(0)).toBe('')
    expect(formatObservers(null)).toBe('')
  })
})
