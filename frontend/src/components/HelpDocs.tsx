import { useEffect, useRef } from 'react'
import { BookOpen, X } from 'lucide-react'
import helpText from '../../../docs/HELP.md?raw'

// ── TOC definition ────────────────────────────────────────────────────────────

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
  { id: 'map-explorer',         label: 'Map Explorer',           sub: false },
  { id: 'multimedia',           label: 'Multimedia',             sub: false },
  { id: 'breeding-codes',       label: 'Breeding Codes',         sub: false },
  { id: 'named-birds',          label: 'Named Birds',            sub: false },
  { id: 'checklists',           label: 'Checklists',             sub: false },
  { id: 'list-comparer',        label: 'List Comparer',          sub: false },
  { id: 'settings',             label: 'Settings',               sub: false },
]

// ── Markdown renderer ─────────────────────────────────────────────────────────

function textToId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
}

function renderInline(text: string): React.ReactNode {
  const pattern = /(\*\*(?:[^*]|\*(?!\*))+\*\*)|(`[^`]+`)|(\[[^\]]*\]\([^)]*\))/g
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
        }}>
          {m[2].slice(1, -1)}
        </code>
      )
    } else if (m[3]) {
      const lm = m[3].match(/\[([^\]]*)\]\(([^)]*)\)/)
      if (lm) {
        segments.push(
          <a key={ki++} href={lm[2]} target="_blank" rel="noreferrer"
            style={{ color: 'var(--sr-accent)', textDecoration: 'underline' }}
          >
            {lm[1]}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
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
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <BookOpen size={16} style={{ color: 'var(--sr-accent)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--sr-text)' }}>
            SnowRaven Documentation
          </span>
        </div>
        <button tabIndex={0}
          ref={closeRef}
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
        <div className="sr-help-row" style={{
          display: 'flex', width: '100%', maxWidth: 1100,
          margin: '0 auto', padding: '0 24px', gap: 40, alignItems: 'flex-start',
        }}>

          {/* TOC Sidebar */}
          <nav className="sr-help-toc" aria-label="Documentation contents" style={{
            width: 200, flexShrink: 0, padding: '32px 0',
            position: 'sticky', top: 0,
            maxHeight: 'calc(100vh - 52px)', overflowY: 'auto',
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
          <div style={{ flex: 1, minWidth: 0, padding: '40px 0 80px', maxWidth: 680 }}>
            {blocks.map((block, idx) => renderBlock(block, idx))}
          </div>

        </div>
      </div>
    </div>
  )
}
