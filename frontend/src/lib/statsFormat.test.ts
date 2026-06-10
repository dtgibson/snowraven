import { describe, it, expect } from 'vitest'
import { formatSpanLength } from './statsFormat'

describe('formatSpanLength', () => {
  it('uses days under two months', () => {
    expect(formatSpanLength(1)).toBe('1 day')
    expect(formatSpanLength(41)).toBe('41 days')
    expect(formatSpanLength(60)).toBe('60 days')
  })
  it('uses rounded months from two months to two years', () => {
    expect(formatSpanLength(61)).toBe('2 months')
    expect(formatSpanLength(578)).toBe('19 months')
    expect(formatSpanLength(700)).toBe('23 months')
  })
  it('uses half-year precision from two years up', () => {
    expect(formatSpanLength(722)).toBe('2 years') // Jun 12, 2024 – Jun 3, 2026
    expect(formatSpanLength(877)).toBe('2.5 years')
    expect(formatSpanLength(1096)).toBe('3 years')
  })
  it('returns "" for negative or non-finite input', () => {
    expect(formatSpanLength(-1)).toBe('')
    expect(formatSpanLength(NaN)).toBe('')
  })
})
