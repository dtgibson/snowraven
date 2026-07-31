import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    if (!entry.name.endsWith('.tsx') || entry.name.endsWith('.test.tsx')) return []
    return [path]
  })
}

describe('embedded media iframe inventory', () => {
  it('keeps MediaFrame as the only Macaulay iframe constructor', () => {
    const constructors = sourceFiles(SRC_ROOT)
      .filter(path => {
        const source = readFileSync(path, 'utf8')
        return source.includes('<iframe') || (source.includes('macaulaylibrary.org/asset/') && source.includes('/embed'))
      })
      .map(path => relative(SRC_ROOT, path))

    expect(constructors).toEqual(['components/MediaEmbed.tsx'])
  })
})
