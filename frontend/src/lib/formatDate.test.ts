import { describe, it, expect } from 'vitest'
import { formatDateMonthFirst } from './formatDate'

describe('formatDateMonthFirst', () => {
  it('formats a plain ISO date month-first', () => {
    expect(formatDateMonthFirst('2024-01-05')).toBe('Jan 5, 2024')
    expect(formatDateMonthFirst('2023-12-31')).toBe('Dec 31, 2023')
  })

  it('strips a trailing time component', () => {
    expect(formatDateMonthFirst('2024-07-09 06:30')).toBe('Jul 9, 2024')
  })

  it('returns an empty string for empty input', () => {
    expect(formatDateMonthFirst('')).toBe('')
  })

  it('returns the original string when unparseable', () => {
    expect(formatDateMonthFirst('not-a-date')).toBe('not-a-date')
  })
})
