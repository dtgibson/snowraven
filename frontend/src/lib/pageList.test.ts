// The generic long-list pager (life-lists-tab schema 6.2). `weatherBacklog.test.ts`
// is unchanged by the extraction, which is the proof that `pageBacklog`'s outputs
// did not move; these rows pin the generic helper's four shapes and its clamp.

import { describe, it, expect } from 'vitest'
import { pageList, PAGE_SIZE } from './pageList'

const rows = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('pageList', () => {
  it('pages 100 at a time', () => { expect(PAGE_SIZE).toBe(100) })

  it('empty, under a page, exactly a page, and over a page', () => {
    expect(pageList(rows(0), PAGE_SIZE)).toEqual({ visible: [], total: 0, hasMore: false, nextCount: 0 })
    expect(pageList(rows(40), PAGE_SIZE)).toMatchObject({ total: 40, hasMore: false, nextCount: 40 })
    expect(pageList(rows(40), PAGE_SIZE).visible).toHaveLength(40)
    expect(pageList(rows(100), PAGE_SIZE)).toMatchObject({ total: 100, hasMore: false, nextCount: 100 })
    const over = pageList(rows(250), PAGE_SIZE)
    expect(over).toMatchObject({ total: 250, hasMore: true, nextCount: 200 })
    expect(over.visible).toEqual(rows(100))
    expect(pageList(rows(250), 200)).toMatchObject({ hasMore: true, nextCount: 250 })
    expect(pageList(rows(250), 250)).toMatchObject({ hasMore: false, nextCount: 250 })
  })

  it('clamps a shown count below zero or past the end', () => {
    expect(pageList(rows(5), -3)).toMatchObject({ visible: [], hasMore: true, nextCount: 5 })
    expect(pageList(rows(5), 999).visible).toEqual(rows(5))
  })
})
