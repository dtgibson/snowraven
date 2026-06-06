// Safe rendering of eBird checklist/species comments. The API returns comments
// HTML-entity-encoded (e.g. "&#x1f325;" for ☁️) with \r\n line breaks. We decode
// entities WITHOUT using innerHTML, then split into plain-text + link segments so
// the UI can render text as escaped React children and only emit <a> for validated
// http(s) URLs. This avoids any HTML/JS injection from comment content.

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
}

function fromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return ''
  try {
    return String.fromCodePoint(cp)
  } catch {
    return ''
  }
}

/** Decode numeric (&#nn; / &#xhh;) and a few named HTML entities. No innerHTML. */
export function decodeEntities(s: string): string {
  if (!s) return ''
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m, n) => NAMED[n] ?? m)
}

export interface CommentSegment {
  text: string
  /** Present only for a validated http(s) link segment. */
  href?: string
}

// Matches http(s) URLs; stops at whitespace and characters unlikely to be in a URL.
const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g

/** Split text into plain + link segments. Only http/https become links. */
export function linkify(s: string): CommentSegment[] {
  const out: CommentSegment[] = []
  if (!s) return out
  let last = 0
  let m: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((m = URL_RE.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) })
    let url = m[1]
    // Don't swallow trailing sentence punctuation into the link.
    const trail = /[.,;:!?]+$/.exec(url)
    let suffix = ''
    if (trail) {
      suffix = trail[0]
      url = url.slice(0, url.length - suffix.length)
    }
    out.push({ text: url, href: url })
    if (suffix) out.push({ text: suffix })
    last = m.index + m[1].length
  }
  if (last < s.length) out.push({ text: s.slice(last) })
  return out
}

/** Decode entities then split into renderable segments (validated links). */
export function commentSegments(raw: string): CommentSegment[] {
  return linkify(decodeEntities(raw))
}

/** True if a comment has any content once decoded/trimmed. */
export function hasComment(raw: string | null | undefined): boolean {
  return !!raw && decodeEntities(raw).trim().length > 0
}
