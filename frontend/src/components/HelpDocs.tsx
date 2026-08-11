import { useEffect, useRef } from 'react'
import { BookOpen, X } from 'lucide-react'
import helpText from '../../../docs/HELP.md?raw'
import { OutboundLink } from './OutboundLink'
import { helpInlineTokenRe, isSafeHelpLinkTarget, parseHelpLinkToken } from '../lib/helpLinks'

// ── TOC definition ────────────────────────────────────────────────────────────

// One entry per `##` section in docs/HELP.md, IN THE SAME ORDER as the document —
// all 16. (The `sub: true` rows are a deliberately selective handful of `###`
// headings, not every one; HELP.md has 30+ and listing them all would bury the
// sections.) The ids must match textToId() of the heading text, since that is what
// the renderer stamps on each h2 and what the jump links target.
//
// Keep this in step with HELP.md: Calendar, Using SnowRaven offline, and Updating
// SnowRaven each shipped as content but were never added here, so for several
// versions they rendered in the body yet were unreachable from the sidebar.
const TOC: { id: string; label: string; sub: boolean }[] = [
  { id: 'getting-started',      label: 'Getting Started',        sub: false },
  { id: 'api-keys',             label: 'API Keys',               sub: false },
  { id: 'ebird-api-key',        label: 'eBird API key',          sub: true  },
  { id: 'openweather-api-key',  label: 'OpenWeather API key',    sub: true  },
  { id: 'default-files',        label: 'Default Files',          sub: false },
  { id: 'ebird-backup',         label: 'eBird backup',           sub: true  },
  { id: 'ml-export',            label: 'ML export',              sub: true  },
  { id: 'weather',              label: 'Weather',                sub: false },
  { id: 'species-detail',       label: 'Species Detail',         sub: false },
  { id: 'statistics',           label: 'Statistics',             sub: false },
  { id: 'calendar',             label: 'Calendar',               sub: false },
  { id: 'map-explorer',         label: 'Map Explorer',           sub: false },
  { id: 'multimedia',           label: 'Multimedia',             sub: false },
  { id: 'breeding-codes',       label: 'Breeding Codes',         sub: false },
  { id: 'named-birds',          label: 'Named Birds',            sub: false },
  { id: 'checklists',           label: 'Checklists',             sub: false },
  { id: 'list-comparer',        label: 'List Comparer',          sub: false },
  { id: 'settings',             label: 'Settings',               sub: false },
  { id: 'using-snowraven-offline', label: 'Using SnowRaven offline', sub: false },
  { id: 'updating-snowraven',   label: 'Updating SnowRaven',     sub: false },
]

// ── Markdown renderer ─────────────────────────────────────────────────────────

function textToId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
}

function renderInline(text: string): React.ReactNode {
  const pattern = helpInlineTokenRe()
  const segments: React.ReactNode[] = []
  let last = 0
  let ki = 0
  let m: RegExpExecArray | null

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) segments.push(text.slice(last, m.index))

    if (m[1]) {
      segments.push(<strong key={ki++}>{m[1].slice(2, -2)}</strong>)
    } else if (m[2]) {
      segments.push(
        <code key={ki++} style={{
          fontFamily: 'monospace', fontSize: '0.88em',
          background: 'var(--sr-surface-subtle)',
          border: '1px solid var(--sr-border)',
          borderRadius: 4, padding: '1px 5px',
          color: 'var(--sr-text)',
          overflowWrap: 'anywhere',
        }}>
          {m[2].slice(1, -1)}
        </code>
      )
    } else if (m[3]) {
      const link = parseHelpLinkToken(m[3])
      if (link) {
        // The target is gated before it can reach `href`. docs/HELP.md is a
        // developer-controlled file bundled at build time (the ?raw import
        // above), so today every target is https and this gate never fires —
        // it exists so the renderer's safety stops DEPENDING on that staying
        // true forever. On a miss we render the link text as plain escaped
        // text and drop the anchor, never a styled link we can't vouch for.
        // An `![alt](src)` image takes this same path; see lib/helpLinks.ts.
        //
        // That claim covers the WHOLE path, not just this branch. The scanner
        // above runs before the gate, so a gate alone would not have made good
        // on it: unbounded, the scanner was O(n^2) over its input (4.00x per
        // doubling, measured), and hostile Help content would have hung the
        // main thread long before any target reached this line. Its quantifiers
        // are length-bounded, so the scan is linear by construction.
        //
        // What the gate is NOT: a check on the host. It authorizes the SCHEME,
        // which is what stops script execution; an http(s) URL is then trusted
        // to be an http(s) URL. Same scope as CommentText's, deliberately.
        segments.push(
          isSafeHelpLinkTarget(link.target) ? (
            // OutboundLink is the standard wrapper for every non-checklist
            // external link (v0.5.32); this anchor predated it and hand-rolled
            // target/rel/cue. With plain-string children it emits the cue as an
            // aria-label rather than an .sr-only node, and the announced name is
            // UNCHANGED: "ebird.org (opens in a new tab)" on both revisions,
            // byte-identical, verified against real accessibility trees in
            // Chromium (Playwright + CDP Accessibility.getFullAXTree) and in
            // WebKit, the engine the macOS and iOS apps actually ship on.
            // href/target/rel and the visible copy are byte-identical too.
            //
            // Do NOT re-derive this from dom-accessibility-api (what jsdom and
            // testing-library compute). It omits the inter-node space both real
            // engines insert per the accname algorithm, so it reports a spurious
            // one-space delta between these two forms and makes an identical
            // name look like a change. It is a proxy, not a render.
            <OutboundLink key={ki++} href={link.target}
              style={{ color: 'var(--sr-accent)', textDecoration: 'underline' }}
            >
              {link.text}
            </OutboundLink>
          ) : (
            // Plain string, exactly like the surrounding text slices. An
            // empty-text link therefore vanishes entirely, which is correct;
            // THIS fallback never echoes the raw markdown source. The renderer
            // has a second one that does: a token longer than HELP_TOKEN_MAX is
            // never matched by the scanner, so it never reaches this branch at
            // all and its brackets, parens and URL render as escaped text. Both
            // fail closed with respect to linking, which is what matters, but
            // the two are not the same fallback.
            link.text
          )
        )
      }
    }
    last = m.index + m[0].length
  }

  if (last < text.length) segments.push(text.slice(last))
  if (segments.length === 0) return null
  if (segments.length === 1) return segments[0]
  return <>{segments}</>
}

type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; id: string; text: string }
  | { kind: 'h3'; id: string; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'hr' }
  | { kind: 'pre'; lang: string; text: string }

function parseBlocks(md: string): Block[] {
  const lines = md.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('### ')) {
      const text = line.slice(4)
      blocks.push({ kind: 'h3', id: textToId(text), text })
      i++
    } else if (line.startsWith('## ')) {
      const text = line.slice(3)
      blocks.push({ kind: 'h2', id: textToId(text), text })
      i++
    } else if (line.startsWith('# ')) {
      blocks.push({ kind: 'h1', text: line.slice(2) })
      i++
    } else if (line === '---') {
      blocks.push({ kind: 'hr' })
      i++
    } else if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      blocks.push({ kind: 'pre', lang, text: codeLines.join('\n') })
    } else if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2))
        i++
      }
      blocks.push({ kind: 'ul', items })
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      blocks.push({ kind: 'ol', items })
    } else if (line.trim() === '') {
      i++
    } else {
      const pLines: string[] = []
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].startsWith('#') &&
        !lines[i].startsWith('- ') &&
        !lines[i].startsWith('```') &&
        lines[i] !== '---' &&
        !/^\d+\. /.test(lines[i])
      ) {
        pLines.push(lines[i])
        i++
      }
      if (pLines.length > 0) {
        blocks.push({ kind: 'p', text: pLines.join(' ') })
      }
    }
  }

  return blocks
}

function renderBlock(block: Block, idx: number): React.ReactNode {
  switch (block.kind) {
    case 'h1':
      return (
        <h1 key={idx} style={{
          fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.02em',
          color: 'var(--sr-text)', marginBottom: 6, lineHeight: 1.2,
        }}>
          {block.text}
        </h1>
      )

    case 'h2':
      return (
        <h2 key={idx} id={block.id} style={{
          fontSize: '1.125rem', fontWeight: 700, color: 'var(--sr-text)',
          marginTop: 40, marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid var(--sr-border-subtle)',
        }}>
          {block.text}
        </h2>
      )

    case 'h3':
      return (
        <h3 key={idx} id={block.id} style={{
          fontSize: '0.6875rem', fontWeight: 700, color: 'var(--sr-text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
          marginTop: 24, marginBottom: 8,
        }}>
          {block.text}
        </h3>
      )

    case 'p':
      return (
        <p key={idx} style={{
          fontSize: '0.875rem', lineHeight: 1.75, color: 'var(--sr-text)', marginBottom: 14,
        }}>
          {renderInline(block.text)}
        </p>
      )

    case 'ul':
      return (
        <ul key={idx} style={{ marginBottom: 14, paddingLeft: 22, listStyle: 'disc' }}>
          {block.items.map((item, j) => (
            <li key={j} style={{ fontSize: '0.875rem', lineHeight: 1.75, color: 'var(--sr-text)', marginBottom: 4 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )

    case 'ol':
      return (
        <ol key={idx} style={{ marginBottom: 14, paddingLeft: 22, listStyle: 'decimal' }}>
          {block.items.map((item, j) => (
            <li key={j} style={{ fontSize: '0.875rem', lineHeight: 1.75, color: 'var(--sr-text)', marginBottom: 4 }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      )

    case 'hr':
      return (
        <hr key={idx} style={{
          border: 'none', borderTop: '1px solid var(--sr-border)', margin: '32px 0',
        }} />
      )

    case 'pre':
      return (
        <pre key={idx} style={{
          background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)',
          borderRadius: 8, padding: '14px 16px', overflowX: 'auto', marginBottom: 14,
          fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--sr-text)', fontFamily: 'monospace',
        }}>
          {block.text}
        </pre>
      )
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HelpDocs({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Restore focus to whatever opened the overlay (footer Help, Settings, or the
  // Welcome screen) when it unmounts — standard dialog behavior. The lazy mount
  // uses fallback={null}, so at first effect time focus is still on the opener.
  // This effect must run BEFORE the closeRef-focus effect so it captures the
  // opener, not the Close button.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    return () => opener?.focus()
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'Tab') {
        const overlay = document.getElementById('sr-help-overlay')
        if (!overlay) return
        const focusables = Array.from(
          overlay.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')
        ).filter(el => !el.hasAttribute('disabled'))
        if (focusables.length < 2) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function scrollToSection(id: string) {
    const el = document.getElementById(id)
    if (!el || !bodyRef.current) return
    const body = bodyRef.current
    const bodyRect = body.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    body.scrollTop += elRect.top - bodyRect.top - 20
  }

  const blocks = parseBlocks(helpText)

  return (
    <div
      id="sr-help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="SnowRaven Documentation"
      // Positioning lives in globals.css, NOT inline: an inline `inset: 0`
      // (specificity 1,0,0) can't be overridden, so the iOS safe-area inset that
      // keeps the header's icon and title clear of the status bar / Dynamic
      // Island had nowhere to hang.
      className="sr-help-panel"
      style={{
        background: 'var(--sr-surface)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        height: 52, borderBottom: '1px solid var(--sr-border)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
        flexShrink: 0, background: 'var(--sr-surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <BookOpen size={16} style={{ color: 'var(--sr-accent)', flexShrink: 0 }} />
          <span style={{
            fontSize: '0.875rem', fontWeight: 600, color: 'var(--sr-text)',
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            SnowRaven Documentation
          </span>
        </div>
        <button tabIndex={0}
          ref={closeRef}
          className="sr-touch-target"
          onClick={onClose}
          aria-label="Close documentation"
          style={{
            width: 32, height: 32, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--sr-text-muted)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--sr-surface-subtle)'
            e.currentTarget.style.color = 'var(--sr-text)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none'
            e.currentTarget.style.color = 'var(--sr-text-muted)'
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', display: 'flex' }}>
        <div className="sr-help-row sr-pad-x-trim" style={{
          display: 'flex', width: '100%', maxWidth: 1100,
          margin: '0 auto', padding: '0 24px', gap: 40, alignItems: 'flex-start',
        }}>

          {/* TOC Sidebar */}
          {/* The height cap lives in globals.css alongside the panel's iOS inset:
              on iOS the scrollport is also shorter by the top safe-area inset, and
              an inline max-height could not be adjusted for it. */}
          <nav className="sr-help-toc" aria-label="Documentation contents" style={{
            width: 200, flexShrink: 0, padding: '32px 0',
            position: 'sticky', top: 0,
            overflowY: 'auto',
          }}>
            <div style={{
              fontSize: '0.65625rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--sr-text-muted)',
              marginBottom: 10, paddingLeft: 10,
            }}>
              Contents
            </div>
            {TOC.map(item => (
              <button tabIndex={0}
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: item.sub ? '5px 10px 5px 20px' : '5px 10px',
                  borderRadius: 6, border: 'none', background: 'none',
                  fontSize: item.sub ? '0.75rem' : '0.78125rem',
                  color: 'var(--sr-text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  marginBottom: 1,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--sr-surface-subtle)'
                  e.currentTarget.style.color = 'var(--sr-text)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.color = 'var(--sr-text-muted)'
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          {/* .sr-help-content is the phone-tier hook: once the ≤640 tier flips the
              row to flex-direction: column, the parent's inline alignItems:'flex-start'
              governs WIDTH (the cross axis), so this column shrink-to-fits to its
              widest child's min-content instead of filling the row. minWidth:0 below
              cannot help — it relaxes the MAIN axis. The constraint lives in
              globals.css, per the "make layout responsive with a class, never an
              inline style" rule. */}
          <div className="sr-help-content" style={{ flex: 1, minWidth: 0, padding: '40px 0 80px', maxWidth: 680 }}>
            {blocks.map((block, idx) => renderBlock(block, idx))}
          </div>

        </div>
      </div>
    </div>
  )
}
