import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { Tab } from '../lib/tabLayout'

export interface NavItem {
  id: Tab
  label: string
  icon: React.ReactNode
}

interface TabNavProps {
  items: NavItem[]
  activeTab: Tab
  onSelect: (tab: Tab) => void
}

// Horizontal padding (px) reserved by the bar wrapper (0 24px each side).
const BAR_WRAP_PADDING = 48

export function TabNav({ items, activeTab, onSelect }: TabNavProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  // Collapse to the dropdown the moment the bar would overflow, rather than at
  // a fixed breakpoint — this is the "collapse when it would otherwise
  // overflow" decision from the PRD, and it holds for any tab count or zoom.
  // useLayoutEffect measures before paint, so the correct layout shows with no
  // flash (NFR-03).
  useLayoutEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current
      const probe = probeRef.current
      if (!wrap || !probe) return
      const available = wrap.clientWidth - BAR_WRAP_PADDING
      const needed = probe.scrollWidth
      setCollapsed(needed > available)
    }
    measure()
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined' && wrapRef.current) {
      ro = new ResizeObserver(measure)
      ro.observe(wrapRef.current)
    }
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [items])

  return (
    <div ref={wrapRef} style={{ borderBottom: '1px solid var(--sr-border)', flexShrink: 0, position: 'relative' }}>
      {/* Hidden probe: the full bar at its natural width, used only to measure
          whether the visible bar would overflow. */}
      <div
        ref={probeRef}
        aria-hidden="true"
        style={{ position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none', display: 'inline-flex', whiteSpace: 'nowrap' }}
      >
        {items.map(item => (
          <span key={item.id} style={{ ...tabStyle(false), display: 'inline-flex' }}>
            {item.icon}
            {item.label}
          </span>
        ))}
      </div>

      {collapsed ? (
        <TabDropdown items={items} activeTab={activeTab} onSelect={onSelect} />
      ) : (
        <TabBar items={items} activeTab={activeTab} onSelect={onSelect} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Desktop: horizontal tab bar (unchanged behavior — roving tabindex + arrows)
// ---------------------------------------------------------------------------

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 16px',
    border: 'none',
    borderBottom: `2px solid ${active ? 'var(--sr-accent)' : 'transparent'}`,
    background: 'none',
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    fontWeight: 500,
    color: active ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
    cursor: 'pointer',
    marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
  }
}

function TabBar({ items, activeTab, onSelect }: TabNavProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '0 24px' }}>
      <nav
        aria-label="Main navigation"
        style={{ display: 'flex', maxWidth: 880, width: '100%', justifyContent: 'center' }}
        role="tablist"
        onKeyDown={e => {
          const idx = items.findIndex(it => it.id === activeTab)
          if (idx === -1) return
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            const next = items[(idx + 1) % items.length]
            onSelect(next.id)
            document.getElementById(`tab-${next.id}`)?.focus()
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            const prev = items[(idx - 1 + items.length) % items.length]
            onSelect(prev.id)
            document.getElementById(`tab-${prev.id}`)?.focus()
          }
        }}
      >
        {items.map(item => (
          <button
            key={item.id}
            role="tab"
            aria-selected={activeTab === item.id}
            aria-controls={`panel-${item.id}`}
            id={`tab-${item.id}`}
            tabIndex={activeTab === item.id ? 0 : -1}
            style={tabStyle(activeTab === item.id)}
            onClick={() => onSelect(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Narrow: dropdown
// ---------------------------------------------------------------------------

function TabDropdown({ items, activeTab, onSelect }: TabNavProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const active = items.find(it => it.id === activeTab) ?? items[0]

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  // FR-11: close on outside click.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // When opening, move focus to the active option (NFR-01).
  useEffect(() => {
    if (!open) return
    const idx = Math.max(0, items.findIndex(it => it.id === activeTab))
    itemRefs.current[idx]?.focus()
  }, [open, items, activeTab])

  const focusItem = (idx: number) => {
    const n = items.length
    const wrapped = ((idx % n) + n) % n
    itemRefs.current[wrapped]?.focus()
  }
  const currentFocusIndex = () =>
    itemRefs.current.findIndex(el => el === document.activeElement)

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusItem(currentFocusIndex() + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusItem(currentFocusIndex() - 1)
        break
      case 'Home':
        e.preventDefault()
        focusItem(0)
        break
      case 'End':
        e.preventDefault()
        focusItem(items.length - 1)
        break
      case 'Escape':
        e.preventDefault()
        close(true)
        break
      case 'Tab':
        close(false)
        break
    }
  }

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
    }
  }

  const select = (tab: Tab) => {
    onSelect(tab)
    close(true)
  }

  return (
    <div style={{ padding: '12px 16px', position: 'relative' }} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Navigation, current view ${active.label}`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onTriggerKeyDown}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 14px',
          borderRadius: 8,
          border: '1px solid var(--sr-border-medium)',
          background: 'var(--sr-surface)',
          color: 'var(--sr-text)',
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--sr-accent)' }}>
          {active.icon}
          <span style={{ color: 'var(--sr-text)' }}>{active.label}</span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          style={{ color: 'var(--sr-text-muted)', transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Navigate to"
          aria-activedescendant={`tab-${activeTab}`}
          onKeyDown={onMenuKeyDown}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: 'calc(100% - 2px)',
            background: 'var(--sr-surface)',
            border: '1px solid var(--sr-border)',
            borderRadius: 8,
            boxShadow: 'var(--sr-card-shadow)',
            padding: 6,
            // Above Leaflet's panes and controls (which reach ~1000) so the
            // menu is never painted under the map.
            zIndex: 1200,
          }}
        >
          {items.map((item, i) => {
            const isActive = item.id === activeTab
            const isSettings = item.id === 'settings'
            return (
              <div key={item.id}>
                {isSettings && i > 0 && (
                  <div style={{ height: 1, background: 'var(--sr-border)', margin: '6px 4px' }} />
                )}
                <button
                  ref={el => { itemRefs.current[i] = el }}
                  type="button"
                  role="option"
                  id={`tab-${item.id}`}
                  aria-selected={isActive}
                  tabIndex={0}
                  onClick={() => select(item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '11px 12px',
                    border: 'none',
                    background: isActive ? 'var(--sr-accent-bg)' : 'none',
                    borderRadius: 6,
                    fontFamily: 'var(--font-sans)',
                    fontSize: 15,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--sr-accent)' : 'var(--sr-text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', color: isActive ? 'var(--sr-accent)' : 'var(--sr-text-muted)' }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {isActive && <Check size={16} aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--sr-accent)' }} />}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
