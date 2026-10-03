// Pure-JS readers for the F-Droid recipe (android-release schema 6.4, 6.5),
// the sibling of test/androidProject.ts. Test-only: nothing in the app
// imports this file. Pure JS on purpose, and no new npm dependency: the
// frontend CI job runs on ubuntu-latest, and a YAML library added for one
// guard would be a dependency the app never ships. Each reader fails CLOSED on
// a shape it does not understand, and each has guard-the-guard rows in
// lib/fdroidRecipe.test.ts.

// ── A flat YAML reader ──────────────────────────────────────────────────────
// Reads the block subset an fdroiddata metadata file is written in: nested
// mappings, sequences (a sequence item may open a mapping on its own line, as
// a Builds entry does), plain scalars and # comments. A plain scalar may run
// on to more-indented continuation lines, which YAML folds with one space:
// `fdroid rewritemeta` writes long values that way, at about 80 columns. Every
// scalar comes back as the TEXT it was written as, so `versionCode: 1000048`
// reads "1000048"; the guards compare text, and a row that cares how YAML
// would type a value says so itself.
//
// Refused rather than guessed at, each with an error naming the line: a tab
// in indentation or text, a CR, a BOM, a document marker, flow collections,
// anchors, aliases, tags, block scalars, quoted scalars, a ": " inside a
// plain scalar, an empty value, a YAML null spelled as a value, a duplicate
// key, a child sequence at its key's own indentation, a continuation line
// after a comment or a blank line or opening with "- ", and indentation that
// matches no open block. A refusal fails the guard, so a reshaped recipe is
// looked at rather than half-read.
export type YamlValue = string | YamlValue[] | YamlMap
export interface YamlMap { [key: string]: YamlValue }

// `comment`: a comment was cut from this line. `afterBreak`: a blank or
// comment-only line came just before it. Either one ends a plain scalar.
interface YamlLine { n: number; indent: number; text: string; comment: boolean; afterBreak: boolean }

const UNSUPPORTED_START = /^(?:[[\]{},&*!|>'"%@`#]|[-?:](?:\s|$))/
const YAML_NULL = new Set(['~', 'null', 'Null', 'NULL'])

function yamlScalar(raw: string, n: number): string {
  const s = raw.trim()
  if (s === '') throw new Error(`yaml line ${n}: empty value`)
  if (UNSUPPORTED_START.test(s)) throw new Error(`yaml line ${n}: unsupported scalar ${JSON.stringify(s)}`)
  if (s.includes(': ') || s.endsWith(':')) throw new Error(`yaml line ${n}: ": " inside a plain scalar`)
  if (YAML_NULL.has(s)) throw new Error(`yaml line ${n}: a YAML null where text was expected`)
  return s
}

export function parseFlatYaml(src: string): YamlMap {
  if (src.includes('\r')) throw new Error('yaml: CR line endings are not read')
  if (src.charCodeAt(0) === 0xfeff) throw new Error('yaml: a byte-order mark is not read')
  const lines: YamlLine[] = []
  let pendingBreak = false
  src.split('\n').forEach((raw, i) => {
    const n = i + 1
    const indent = /^ */.exec(raw)![0].length
    let text = raw.slice(indent)
    // A # opens a comment at the start of the text or after whitespace; a
    // plain scalar cannot carry " #", so this cut is YAML's own.
    const hash = text.search(/(?:^|[ \t])#/)
    const comment = hash >= 0
    if (comment) text = text.slice(0, hash)
    text = text.replace(/ +$/, '')
    if (text === '') { pendingBreak = true; return }
    if (text.includes('\t')) throw new Error(`yaml line ${n}: a tab is not read`)
    if (indent === 0 && /^(?:---|\.\.\.)(?:\s|$)/.test(text)) throw new Error(`yaml line ${n}: a document marker is not read`)
    lines.push({ n, indent, text, comment, afterBreak: pendingBreak })
    pendingBreak = false
  })

  let pos = 0
  const isSeqItem = (text: string) => /^-(?: |$)/.test(text)

  /**
   * A plain scalar that started on line `l`, inside a block at `ownerIndent`,
   * with any more-indented continuation lines folded in with one space each.
   */
  function plain(first: string, ownerIndent: number, l: YamlLine): string {
    let value = yamlScalar(first, l.n)
    let last = l
    while (pos < lines.length && lines[pos]!.indent > ownerIndent) {
      const c = lines[pos]!
      if (last.comment) throw new Error(`yaml line ${c.n}: a continuation after a comment is not read`)
      if (c.afterBreak) throw new Error(`yaml line ${c.n}: a continuation after a blank or comment line is not read`)
      if (isSeqItem(c.text)) throw new Error(`yaml line ${c.n}: a continuation line opening with "- " is not read`)
      value += ' ' + yamlScalar(c.text, c.n)
      last = c
      pos += 1
    }
    return value
  }

  function child(parent: YamlLine, key: string): YamlValue {
    const next = lines[pos]
    if (!next || next.indent <= parent.indent) {
      if (next && next.indent === parent.indent && isSeqItem(next.text)) {
        throw new Error(`yaml line ${next.n}: a sequence at its key's own indentation is not read`)
      }
      throw new Error(`yaml line ${parent.n}: "${key}" has no value`)
    }
    return isSeqItem(next.text) ? seq(next.indent) : map(next.indent)
  }

  function map(indent: number): YamlMap {
    const out = Object.create(null) as YamlMap
    while (pos < lines.length) {
      const l = lines[pos]!
      if (l.indent < indent) break
      if (l.indent > indent) throw new Error(`yaml line ${l.n}: unexpected indentation`)
      if (isSeqItem(l.text)) throw new Error(`yaml line ${l.n}: a sequence item where a key was expected`)
      const sep = l.text.indexOf(': ')
      let key: string
      let rest: string | undefined
      if (sep >= 0) { key = l.text.slice(0, sep); rest = l.text.slice(sep + 2) }
      else if (l.text.endsWith(':')) key = l.text.slice(0, -1)
      else throw new Error(`yaml line ${l.n}: expected "key:" or "key: value"`)
      key = yamlScalar(key, l.n)
      if (Object.hasOwn(out, key)) throw new Error(`yaml line ${l.n}: duplicate key "${key}"`)
      pos += 1
      out[key] = rest !== undefined ? plain(rest, indent, l) : child(l, key)
    }
    return out
  }

  function seq(indent: number): YamlValue[] {
    const out: YamlValue[] = []
    while (pos < lines.length) {
      const l = lines[pos]!
      if (l.indent < indent) break
      if (l.indent > indent) throw new Error(`yaml line ${l.n}: unexpected indentation`)
      const m = /^-( +)(.*)$/.exec(l.text)
      if (!m) {
        throw new Error(l.text === '-'
          ? `yaml line ${l.n}: an empty sequence item is not read`
          : `yaml line ${l.n}: a key where a sequence item was expected`)
      }
      const content = m[2]!
      if (isSeqItem(content)) throw new Error(`yaml line ${l.n}: a nested sequence on one line is not read`)
      if (content.includes(': ') || content.endsWith(':')) {
        // A mapping opens on the item's own line; its first key sits at the
        // column after "- ", and its later keys must line up with it.
        lines[pos] = { ...l, indent: indent + 1 + m[1]!.length, text: content }
        out.push(map(indent + 1 + m[1]!.length))
      } else {
        pos += 1
        out.push(plain(content, indent, l))
      }
    }
    return out
  }

  if (lines.length === 0) throw new Error('yaml: empty document')
  if (lines[0]!.indent !== 0) throw new Error(`yaml line ${lines[0]!.n}: the document must start at column 0`)
  const root = map(0)
  if (pos !== lines.length) throw new Error(`yaml line ${lines[pos]!.n}: unexpected indentation`)
  return root
}

/** Typed access into a parsed document: each throws on the wrong shape. */
export function yamlText(m: YamlMap, key: string): string {
  const v = Object.hasOwn(m, key) ? m[key] : undefined
  if (typeof v !== 'string') throw new Error(`yaml: "${key}" is not text`)
  return v
}
export function yamlList(m: YamlMap, key: string): YamlValue[] {
  const v = Object.hasOwn(m, key) ? m[key] : undefined
  if (!Array.isArray(v)) throw new Error(`yaml: "${key}" is not a sequence`)
  return v
}
export function yamlTextList(m: YamlMap, key: string): string[] {
  return yamlList(m, key).map((v, i) => {
    if (typeof v !== 'string') throw new Error(`yaml: "${key}"[${i}] is not text`)
    return v
  })
}
/**
 * A script field (sudo, init, prebuild, build, postbuild) as its lines. fdroidserver
 * reads a text value as one line and `fdroid rewritemeta` writes a one-line
 * script as text, so both shapes are the same field (metadata.py,
 * _format_script and parse_yaml_metadata's TYPE_SCRIPT branch).
 */
export function yamlScript(m: YamlMap, key: string): string[] {
  const v = Object.hasOwn(m, key) ? m[key] : undefined
  if (typeof v === 'string') return [v]
  return yamlTextList(m, key)
}
export function yamlMap(v: YamlValue | undefined, what: string): YamlMap {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`yaml: ${what} is not a mapping`)
  return v
}

// ── A shell env-file reader (scripts/android/toolchain.env) ──────────────────
// The file is sourced by POSIX sh, so the reader accepts only lines whose
// meaning sh cannot change: NAME=word or NAME="words", with no expansion,
// substitution, escape or operator, and an optional trailing comment. A line
// of any other shape, or a name set twice, throws.
const ENV_LINE = /^([A-Z][A-Z0-9_]*)=(?:"([^"$`\\]*)"|([^\s"'$`\\#;&|<>(){}]*))(?:[ \t]+#.*)?$/

export function parseShellEnv(src: string): Record<string, string> {
  const out = Object.create(null) as Record<string, string>
  src.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) return
    const m = ENV_LINE.exec(line)
    if (!m) throw new Error(`env line ${i + 1}: unrecognized shape ${JSON.stringify(line)}`)
    const name = m[1]!
    if (Object.hasOwn(out, name)) throw new Error(`env line ${i + 1}: ${name} set twice`)
    out[name] = m[2] ?? m[3]!
  })
  return out
}

// ── F-Droid's UpdateCheckData, run the way checkupdates runs it ──────────────
// fdroidserver 2.4.5 checkupdates.check_tags: the field is split on "|" into
// exactly four parts (code file, code regex, name file, name regex); a name
// file of "." reuses the code file's text; each regex is applied with
// re.search and its group 1 is the value. These guards demand exactly ONE
// match per regex, so re.search's first match is the only one.
export interface UpdateCheck { codeFile: string; codeRe: string; nameFile: string; nameRe: string }

export function splitUpdateCheckData(field: string): UpdateCheck {
  const parts = field.split('|')
  if (parts.length !== 4) throw new Error(`UpdateCheckData: expected 4 "|"-separated fields, found ${parts.length}`)
  const [codeFile, codeRe, nameFile, nameRe] = parts as [string, string, string, string]
  return { codeFile, codeRe, nameFile: nameFile === '.' ? codeFile : nameFile, nameRe }
}

/** Group 1 of the one match of `pattern` in `text`; throws on zero or several matches. */
export function matchOnce(pattern: string, text: string, what: string): string {
  const ms = [...text.matchAll(new RegExp(pattern, 'g'))]
  if (ms.length !== 1) throw new Error(`${what}: expected exactly one match of ${pattern}, found ${ms.length}`)
  const g = ms[0]![1]
  if (g === undefined) throw new Error(`${what}: ${pattern} has no group 1`)
  return g
}
