// Pure-JS readers for the committed iOS manifests: Apple plists and the
// xcodegen project.yml. Test-only (nothing in the app imports this file), and
// shared by lib/iosSceneManifest.test.ts (where they were written, and where
// their guard-the-guard rows still live) and lib/iosWidgetManifest.test.ts
// (ios-lifer-widgets), so the second guard reuses them rather than copying
// them. Moved here verbatim so a test file never has to import another test
// file, which would register that file's suites twice.
//
// Pure JS on purpose: the frontend CI job runs on ubuntu-latest, where neither
// `plutil` nor `PlistBuddy` exists.

// ── A minimal plist reader ──────────────────────────────────────────────────
// Pure JS on purpose: the frontend CI job runs on ubuntu-latest, where neither
// `plutil` nor `PlistBuddy` exists, so shelling out would make this guard
// macOS-only and it would silently not run where it matters most. It fails
// CLOSED on anything it does not understand rather than returning a partial
// object, so a plist shape it cannot read is an error and never a pass.
export type PlistValue = string | number | boolean | PlistValue[] | { [k: string]: PlistValue }

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
}
const decodeEntities = (s: string) => s.replace(/&(?:amp|lt|gt|quot|apos);/g, m => ENTITIES[m])

export function parsePlist(xml: string): PlistValue {
  const src = xml
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  let i = 0
  const ws = () => { while (i < src.length && /\s/.test(src[i]!)) i += 1 }
  function tag(): { name: string, closing: boolean, selfClosing: boolean } {
    ws()
    if (src[i] !== '<') throw new Error(`plist: expected '<' at offset ${i}`)
    const end = src.indexOf('>', i)
    if (end < 0) throw new Error('plist: unterminated tag')
    const raw = src.slice(i + 1, end)
    i = end + 1
    return {
      name: raw.replace(/^\//, '').replace(/\/$/, '').trim().split(/\s/)[0]!,
      closing: raw.startsWith('/'),
      // `<dict/>` is how an EMPTY dict is spelled, and it is exactly the shape
      // of the trap this guard exists to reject (tauri-apps/tauri #15719).
      // Without this the self-closing form is read as an OPENING tag, silently
      // swallows its parent's terminator, and the reader throws somewhere else
      // entirely -- which is how the guard-the-guard row below found it.
      selfClosing: raw.endsWith('/') && !raw.startsWith('/'),
    }
  }
  function text(until: string): string {
    const close = `</${until}>`
    const at2 = src.indexOf(close, i)
    if (at2 < 0) throw new Error(`plist: unterminated <${until}>`)
    const t = src.slice(i, at2)
    i = at2 + close.length
    return decodeEntities(t)
  }
  function value(): PlistValue {
    const t = tag()
    if (t.closing) throw new Error(`plist: unexpected closing </${t.name}>`)
    switch (t.name) {
      case 'true': return true
      case 'false': return false
      case 'string': return t.selfClosing ? '' : text('string')
      case 'integer': return Number(text('integer'))
      case 'real': return Number(text('real'))
      case 'dict': {
        if (t.selfClosing) return {}
        const out: Record<string, PlistValue> = {}
        for (;;) {
          ws()
          const next = tag()
          if (next.closing && next.name === 'dict') return out
          if (next.closing || next.name !== 'key') throw new Error(`plist: expected <key>, got <${next.name}>`)
          out[text('key')] = value()
        }
      }
      case 'array': {
        if (t.selfClosing) return []
        const out: PlistValue[] = []
        for (;;) {
          ws()
          const mark = i
          const next = tag()
          if (next.closing && next.name === 'array') return out
          i = mark
          out.push(value())
        }
      }
      default: throw new Error(`plist: unsupported element <${t.name}>`)
    }
  }
  const root = tag()
  if (root.name !== 'plist') throw new Error(`plist: expected <plist>, got <${root.name}>`)
  return value()
}

// ── A targeted reader for project.yml ───────────────────────────────────────
// Deliberately NOT a YAML parser: no YAML library is a declared dependency of
// `frontend`, and adding one to read four values would be a production
// dependency added for a test. This reads the manifest BLOCK by indentation and
// then asserts on its lines. What it cannot see, stated rather than assumed: a
// flow-style mapping (`{ a: 1 }`), an anchor/alias, or a quoted key. Every one
// of those would make the block-shape assertions below fail rather than pass,
// so it errs closed.

/** project.yml with YAML comments removed. */
export function yamlWithoutComments(src: string): string {
  return src.split('\n').map(line => line.replace(/(^|\s)#.*$/, '')).join('\n')
}

/** The indented block under `key:`, comments already stripped. */
export function yamlBlock(src: string, key: string): string[] {
  const lines = yamlWithoutComments(src).split('\n')
  const start = lines.findIndex(l => new RegExp(`^(\\s*)${key}:\\s*$`).test(l))
  if (start < 0) return []
  const indent = lines[start]!.match(/^\s*/)![0].length
  const out: string[] = []
  for (let n = start + 1; n < lines.length; n += 1) {
    const line = lines[n]!
    if (line.trim() === '') continue
    if (line.match(/^\s*/)![0].length <= indent) break
    out.push(line)
  }
  return out
}

