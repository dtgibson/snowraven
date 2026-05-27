import { useEffect, useRef, useState } from 'react'
import { BookOpen, Eye, EyeOff, FileCheck, FileQuestion, Lock } from 'lucide-react'
import type { StoredFileInfo, StoredFilesStatus } from '../types'
import { applyTheme, readStoredPreference } from '../lib/theme'
import type { ThemePreference } from '../lib/theme'
import { type ConfigurableTab, TAB_LABELS, DEFAULT_TAB_ORDER } from '../lib/tabLayout'
import { HelpDocs } from './HelpDocs'
import { storage } from '../lib/storage'
import { isTauri } from '../lib/platform'

type ConsentState = 'idle' | 'pending'

function formatUploadDate(iso: string): string {
  try {
    const d = new Date(iso)
    return (
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) +
      ' at ' +
      d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
    )
  } catch {
    return iso
  }
}

// ---- Appearance row ----

function AppearanceRow() {
  const [preference, setPreference] = useState<ThemePreference>(readStoredPreference)
  const [consentState, setConsentState] = useState<ConsentState>('idle')
  const [pendingPreference, setPendingPreference] = useState<ThemePreference | null>(null)

  function selectTheme(pref: ThemePreference) {
    if (pref === 'system') {
      try { localStorage.removeItem('sr-theme') } catch { /* private browsing */ }
      setConsentState('idle')
      setPendingPreference(null)
      setPreference('system')
      applyTheme('system')
      return
    }

    applyTheme(pref)

    let hasStoredPref = false
    try { hasStoredPref = localStorage.getItem('sr-theme') !== null } catch { /* private browsing */ }

    if (hasStoredPref) {
      try { localStorage.setItem('sr-theme', pref) } catch { /* private browsing */ }
      setPreference(pref)
      setConsentState('idle')
      setPendingPreference(null)
    } else {
      setPreference(pref)
      setPendingPreference(pref)
      setConsentState('pending')
    }
  }

  function savePreference() {
    if (!pendingPreference || pendingPreference === 'system') return
    try { localStorage.setItem('sr-theme', pendingPreference) } catch { /* private browsing */ }
    setConsentState('idle')
    setPendingPreference(null)
  }

  function dismissConsent() {
    setConsentState('idle')
    setPendingPreference(null)
  }

  const options: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'light',  label: 'Light' },
    { key: 'dark',   label: 'Dark' },
  ]

  function toggleBtnStyle(key: ThemePreference): React.CSSProperties {
    const active = preference === key
    return {
      flex: 1,
      height: 34,
      border: active ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
      background: active ? 'var(--sr-accent-bg)' : 'var(--sr-surface-subtle)',
      color: active ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      fontFamily: 'inherit',
      cursor: 'pointer',
      borderRadius: 6,
      transition: 'background 0.12s, color 0.12s, border-color 0.12s',
    }
  }

  return (
    <div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sr-text)', marginBottom: 10 }}>
          Color scheme
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {options.map(({ key, label }) => (
            <button
              key={key}
              style={toggleBtnStyle(key)}
              onClick={() => selectTheme(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {consentState === 'pending' && (
        <div style={{
          margin: '0 16px 14px',
          padding: '12px 14px',
          background: 'var(--sr-accent-surface)',
          border: '1px solid var(--sr-accent-border)',
          borderRadius: 8,
        }}>
          <p style={{
            fontSize: 13,
            color: 'var(--sr-text-muted)',
            margin: '0 0 10px',
            lineHeight: 1.55,
          }}>
            Your preference will be saved in this browser's local storage — on this device only. Nothing is sent to the server.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={savePreference}
              style={{
                height: 30,
                padding: '0 12px',
                background: 'var(--sr-accent-bg)',
                color: 'var(--sr-accent)',
                border: '1.5px solid var(--sr-accent-border)',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Save preference
            </button>
            <button
              onClick={dismissConsent}
              style={{
                height: 30,
                padding: '0 12px',
                background: 'none',
                color: 'var(--sr-text-muted)',
                border: '1.5px solid var(--sr-border)',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              This session only
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- File rows ----

interface FileRowProps {
  label: string
  sublabel: string
  info: StoredFileInfo | null
  uploading: boolean
  error: string | null
  onUpload: (file: File) => void
  onDelete: () => void
}

function FileRow({ label, sublabel, info, uploading, error, onUpload, onDelete }: FileRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { onUpload(file); e.target.value = '' }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: info ? 'var(--sr-accent-bg)' : 'var(--sr-surface-subtle)',
        }}>
          {info
            ? <FileCheck size={18} strokeWidth={1.75} style={{ color: 'var(--sr-accent)' }} />
            : <FileQuestion size={18} strokeWidth={1.75} style={{ color: 'var(--sr-text-disabled)' }} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sr-text)' }}>{label}</div>
          {info ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0 }}>
              <span style={{
                fontSize: 13, fontWeight: 500, color: 'var(--sr-text)',
                maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={info.filename}>{info.filename}</span>
              <span style={{ fontSize: 12, color: 'var(--sr-text-disabled)', whiteSpace: 'nowrap' }}>
                · Saved {formatUploadDate(info.uploadedAt)}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--sr-text-disabled)', marginTop: 2 }}>{sublabel}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!info && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              height: 24, padding: '0 10px',
              background: 'var(--sr-surface-subtle)', borderRadius: 12,
              fontSize: 11, fontWeight: 500, color: 'var(--sr-text-disabled)',
            }}>
              No file saved
            </div>
          )}

          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              height: 32, padding: '0 12px',
              border: info ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
              background: info ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
              color: info ? 'var(--sr-accent)' : 'var(--sr-text)',
              borderRadius: 6, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center',
              opacity: uploading ? 0.65 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {uploading ? 'Uploading…' : info ? 'Upload new' : 'Upload file'}
          </button>

          <button
            onClick={onDelete}
            disabled={!info}
            style={{
              height: 32, padding: '0 12px',
              border: info ? '1.5px solid var(--sr-error-border)' : '1.5px solid var(--sr-border)',
              background: info ? 'var(--sr-surface)' : 'var(--sr-surface-subtle)',
              color: info ? 'var(--sr-error)' : 'var(--sr-text-disabled)',
              borderRadius: 6, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
              cursor: !info ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Clear
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>

      {error && (
        <div style={{
          margin: '0 16px 10px',
          padding: '7px 11px',
          background: 'var(--sr-error-bg)', borderRadius: 6,
          fontSize: 12, color: 'var(--sr-error)',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ---- Key rows ----

interface KeyRowProps {
  label: string
  sublabel: string
  value: string | null
  visible: boolean
  editing: boolean
  input: string
  saving: boolean
  error: string | null
  onToggleVisible: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onInputChange: (v: string) => void
  onSave: () => void
  onDelete: () => void
}

function KeyRow({
  label, sublabel, value, visible, editing, input, saving, error,
  onToggleVisible, onStartEdit, onCancelEdit, onInputChange, onSave, onDelete,
}: KeyRowProps) {
  const isSet = value !== null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', paddingBottom: editing ? 8 : 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isSet ? 'var(--sr-accent-bg)' : 'var(--sr-surface-subtle)',
        }}>
          <Lock size={18} strokeWidth={1.75} style={{ color: isSet ? 'var(--sr-accent)' : 'var(--sr-text-disabled)' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sr-text)' }}>{label}</div>
          {!editing && (
            isSet ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{
                  fontFamily: 'monospace', letterSpacing: visible ? 'normal' : 2,
                  fontSize: visible ? 12 : 13, color: 'var(--sr-text)',
                  maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {visible ? value : '••••••••••••••••'}
                </span>
                <button
                  onClick={onToggleVisible}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: 12, fontWeight: 500, color: 'var(--sr-accent)',
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                  }}
                >
                  {visible ? 'Hide' : 'Show'}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--sr-text-disabled)', marginTop: 2 }}>{sublabel}</div>
            )
          )}
        </div>

        {!editing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {!isSet && (
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                height: 24, padding: '0 10px',
                background: 'var(--sr-surface-subtle)', borderRadius: 12,
                fontSize: 11, fontWeight: 500, color: 'var(--sr-text-disabled)',
              }}>
                No key saved
              </div>
            )}
            <button
              onClick={onStartEdit}
              style={{
                height: 32, padding: '0 12px',
                border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text)',
                borderRadius: 6, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {isSet ? 'Update' : 'Add key'}
            </button>
            <button
              onClick={onDelete}
              disabled={!isSet}
              style={{
                height: 32, padding: '0 12px',
                border: isSet ? '1.5px solid var(--sr-error-border)' : '1.5px solid var(--sr-border)',
                background: isSet ? 'var(--sr-surface)' : 'var(--sr-surface-subtle)',
                color: isSet ? 'var(--sr-error)' : 'var(--sr-text-disabled)',
                borderRadius: 6, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                cursor: !isSet ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 14px' }}>
          <input
            type="text"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            placeholder={isSet ? 'Enter new key to replace' : 'Paste your API key'}
            autoFocus
            style={{
              flex: 1, height: 32, padding: '0 10px',
              border: '1.5px solid var(--sr-border)', borderRadius: 6,
              fontSize: 13, fontFamily: 'monospace', color: 'var(--sr-text)',
              background: 'var(--sr-surface)',
              outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--sr-accent)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--sr-border)' }}
            onKeyDown={e => { if (e.key === 'Enter' && input.trim()) onSave() }}
          />
          <button
            onClick={onSave}
            disabled={!input.trim() || saving}
            style={{
              height: 32, padding: '0 12px',
              border: '1.5px solid var(--sr-accent-border)',
              background: !input.trim() || saving ? 'var(--sr-surface-subtle)' : 'var(--sr-accent)',
              color: !input.trim() || saving ? 'var(--sr-text-disabled)' : '#fff',
              borderRadius: 6, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
              cursor: !input.trim() || saving ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onCancelEdit}
            style={{
              height: 32, padding: '0 12px',
              border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text)',
              borderRadius: 6, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div style={{
          margin: '0 16px 10px',
          padding: '7px 11px',
          background: 'var(--sr-error-bg)', borderRadius: 6,
          fontSize: 12, color: 'var(--sr-error)',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ---- Section header ----

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <span style={{
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.07em', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--sr-border)' }} />
    </div>
  )
}

// ---- Tab Layout section ----

interface TabLayoutSectionProps {
  tabOrder: ConfigurableTab[]
  tabHidden: Set<ConfigurableTab>
  onReorder: (newOrder: ConfigurableTab[]) => void
  onToggleVisibility: (tab: ConfigurableTab) => void
  onRestoreDefaults: () => void
}

function TabLayoutSection({ tabOrder, tabHidden, onReorder, onToggleVisibility, onRestoreDefaults }: TabLayoutSectionProps) {
  const dragSrcRef = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [showRestored, setShowRestored] = useState(false)
  const restoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const visibleCount = tabOrder.filter(t => !tabHidden.has(t)).length

  function handleDragStart(idx: number) {
    dragSrcRef.current = idx
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setDragOverIdx(null)
    const src = dragSrcRef.current
    if (src === null || src === idx) return
    const next = [...tabOrder]
    const [moved] = next.splice(src, 1)
    next.splice(idx, 0, moved)
    onReorder(next)
    dragSrcRef.current = null
  }

  function handleDragEnd() {
    dragSrcRef.current = null
    setDragOverIdx(null)
  }

  function handleRestore() {
    onRestoreDefaults()
    if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current)
    setShowRestored(true)
    restoredTimerRef.current = setTimeout(() => setShowRestored(false), 1500)
  }

  const isDefault =
    tabOrder.every((t, i) => t === DEFAULT_TAB_ORDER[i]) && tabHidden.size === 0

  const rowStyle = (idx: number, hidden: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderTop: '1px solid var(--sr-border-subtle)',
    background: dragOverIdx === idx
      ? 'var(--sr-accent-bg)'
      : hidden ? 'transparent' : 'transparent',
    transition: 'background 0.1s',
    cursor: 'default',
    userSelect: 'none',
  })

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap' }}>
          Tab Layout
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--sr-border)' }} />
      </div>

      <div style={{ border: '1px solid var(--sr-border)', borderRadius: 10, background: 'var(--sr-surface)', overflow: 'hidden' }}>
        <p style={{ padding: '11px 16px', fontSize: 12, color: 'var(--sr-text-muted)', lineHeight: 1.5, borderBottom: '1px solid var(--sr-border-subtle)' }}>
          Drag to reorder. Use the eye icon to show or hide individual tabs.
        </p>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {tabOrder.map((tab, idx) => {
            const hidden = tabHidden.has(tab)
            const isLastVisible = !hidden && visibleCount === 1
            return (
              <li
                key={tab}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={e => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onDragLeave={() => setDragOverIdx(null)}
                style={rowStyle(idx, hidden)}
              >
                {/* Drag handle */}
                <div
                  aria-label={`Drag to reorder ${TAB_LABELS[tab]} tab`}
                  style={{ cursor: 'grab', color: 'var(--sr-text-disabled)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <circle cx="5"  cy="3.5"  r="1.1"/><circle cx="11" cy="3.5"  r="1.1"/>
                    <circle cx="5"  cy="8"    r="1.1"/><circle cx="11" cy="8"    r="1.1"/>
                    <circle cx="5"  cy="12.5" r="1.1"/><circle cx="11" cy="12.5" r="1.1"/>
                  </svg>
                </div>

                {/* Tab name */}
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: hidden ? 'var(--sr-text-disabled)' : 'var(--sr-text)' }}>
                  {TAB_LABELS[tab]}
                </span>

                {/* Hidden badge */}
                {hidden && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--sr-text-disabled)', letterSpacing: '0.02em' }}>
                    hidden
                  </span>
                )}

                {/* Eye toggle */}
                <button
                  aria-label={(hidden ? 'Show ' : 'Hide ') + TAB_LABELS[tab] + ' tab'}
                  disabled={isLastVisible}
                  title={isLastVisible ? 'At least one tab must remain visible' : undefined}
                  onClick={() => onToggleVisibility(tab)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28,
                    border: 'none', borderRadius: 6, background: 'transparent',
                    cursor: isLastVisible ? 'not-allowed' : 'pointer',
                    color: hidden ? 'var(--sr-text-disabled)' : isLastVisible ? 'var(--sr-border)' : 'var(--sr-text-muted)',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (!isLastVisible) { e.currentTarget.style.background = 'var(--sr-surface-subtle)'; e.currentTarget.style.color = 'var(--sr-text)' } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = hidden ? 'var(--sr-text-disabled)' : isLastVisible ? 'var(--sr-border)' : 'var(--sr-text-muted)' }}
                >
                  {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </li>
            )
          })}
        </ul>

        {/* Locked Settings row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--sr-border-subtle)', background: 'var(--sr-surface-subtle)' }}>
          <div style={{ color: 'var(--sr-border)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="5"  cy="3.5"  r="1.1"/><circle cx="11" cy="3.5"  r="1.1"/>
              <circle cx="5"  cy="8"    r="1.1"/><circle cx="11" cy="8"    r="1.1"/>
              <circle cx="5"  cy="12.5" r="1.1"/><circle cx="11" cy="12.5" r="1.1"/>
            </svg>
          </div>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--sr-text-muted)' }}>Settings</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--sr-text-disabled)' }}>
            <Lock size={11} />
            always last
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, marginBottom: 8 }}>
        <button
          onClick={handleRestore}
          disabled={isDefault}
          style={{
            height: 30, padding: '0 12px',
            background: 'var(--sr-surface-subtle)',
            color: showRestored ? 'var(--sr-accent)' : isDefault ? 'var(--sr-text-disabled)' : 'var(--sr-text-muted)',
            border: `1px solid ${showRestored ? 'var(--sr-accent-border)' : 'var(--sr-border)'}`,
            borderRadius: 6, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
            cursor: isDefault ? 'not-allowed' : 'pointer',
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          {showRestored ? '✓ Restored' : 'Restore defaults'}
        </button>
      </div>
    </>
  )
}

// ---- Main Settings component ----

interface ApiKeyStatus {
  ebird: string | null
  openweather: string | null
}

// ---- Rebuild caches button ----

function RebuildCachesButton() {
  const [status, setStatus] = useState<'idle' | 'working'>('idle')

  async function handleRebuild() {
    setStatus('working')
    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('snowraven-taxonomy')
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
        req.onblocked = () => resolve()
      })
    } catch { /* best-effort */ }
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  }

  return (
    <button
      onClick={handleRebuild}
      disabled={status === 'working'}
      style={{
        height: 32, padding: '0 14px',
        background: status === 'working' ? 'var(--sr-surface-subtle)' : 'var(--sr-surface)',
        color: status === 'working' ? 'var(--sr-text-disabled)' : 'var(--sr-text)',
        border: '1px solid var(--sr-border)', borderRadius: 6,
        fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        cursor: status === 'working' ? 'not-allowed' : 'pointer',
      }}
    >
      {status === 'working' ? 'Restarting…' : 'Rebuild caches & restart'}
    </button>
  )
}

interface SettingsProps {
  onKeysSaved?: () => void
  onFilesSaved?: () => void
  tabOrder: ConfigurableTab[]
  tabHidden: Set<ConfigurableTab>
  onReorder: (newOrder: ConfigurableTab[]) => void
  onToggleVisibility: (tab: ConfigurableTab) => void
  onRestoreDefaults: () => void
}

export function Settings({ onKeysSaved, onFilesSaved, tabOrder, tabHidden, onReorder, onToggleVisibility, onRestoreDefaults }: SettingsProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [status, setStatus] = useState<StoredFilesStatus>({ ebird: null, ml: null })
  const [keys, setKeys] = useState<ApiKeyStatus>({ ebird: null, openweather: null })

  // File state
  const [ebirdUploading, setEbirdUploading] = useState(false)
  const [mlUploading, setMlUploading] = useState(false)
  const [ebirdError, setEbirdError] = useState<string | null>(null)
  const [mlError, setMlError] = useState<string | null>(null)

  // Key state
  const [ebirdKeyVisible, setEbirdKeyVisible] = useState(false)
  const [openweatherKeyVisible, setOpenweatherKeyVisible] = useState(false)
  const [ebirdKeyEditing, setEbirdKeyEditing] = useState(false)
  const [openweatherKeyEditing, setOpenweatherKeyEditing] = useState(false)
  const [ebirdKeyInput, setEbirdKeyInput] = useState('')
  const [openweatherKeyInput, setOpenweatherKeyInput] = useState('')
  const [ebirdKeySaving, setEbirdKeySaving] = useState(false)
  const [openweatherKeySaving, setOpenweatherKeySaving] = useState(false)
  const [ebirdKeyError, setEbirdKeyError] = useState<string | null>(null)
  const [openweatherKeyError, setOpenweatherKeyError] = useState<string | null>(null)

  // Map defaults state
  const [mapLat, setMapLat] = useState('')
  const [mapLng, setMapLng] = useState('')
  const [mapDist, setMapDist] = useState('')
  const [mapDefaultsStatus, setMapDefaultsStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [mapDefaultsHasSaved, setMapDefaultsHasSaved] = useState(false)
  const savedChipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    storage.getFilesStatus()
      .then(data => setStatus(data))
      .catch(() => {})

    Promise.all([storage.getApiKey('ebird'), storage.getApiKey('openweather')])
      .then(([ebird, openweather]) => setKeys({ ebird, openweather }))
      .catch(() => {})

    storage.getSetting<{ lat: number; lng: number; dist: number }>('map-defaults')
      .then(data => {
        if (data) {
          setMapLat(String(data.lat))
          setMapLng(String(data.lng))
          setMapDist(String(data.dist))
          setMapDefaultsHasSaved(true)
        }
      })
      .catch(() => {})
  }, [])

  // File handlers
  const handleUpload = async (slot: 'ebird' | 'ml', file: File) => {
    const setUploading = slot === 'ebird' ? setEbirdUploading : setMlUploading
    const setError = slot === 'ebird' ? setEbirdError : setMlError
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Only .csv files are accepted.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const content = await file.text()
      await storage.writeFile(slot, content, file.name)
      const updatedStatus = await storage.getFilesStatus()
      setStatus(updatedStatus)
      onFilesSaved?.()
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFile = async (slot: 'ebird' | 'ml') => {
    const setError = slot === 'ebird' ? setEbirdError : setMlError
    setError(null)
    try {
      await storage.deleteFile(slot)
      setStatus(prev => ({ ...prev, [slot]: null }))
    } catch {
      setError('Delete failed. Please try again.')
    }
  }

  // Key handlers
  const handleSaveKey = async (slot: 'ebird' | 'openweather') => {
    const input = slot === 'ebird' ? ebirdKeyInput : openweatherKeyInput
    const setSaving = slot === 'ebird' ? setEbirdKeySaving : setOpenweatherKeySaving
    const setError = slot === 'ebird' ? setEbirdKeyError : setOpenweatherKeyError
    const setEditing = slot === 'ebird' ? setEbirdKeyEditing : setOpenweatherKeyEditing
    const setInput = slot === 'ebird' ? setEbirdKeyInput : setOpenweatherKeyInput
    setSaving(true)
    setError(null)
    try {
      await storage.setApiKey(slot, input.trim())
      setKeys(prev => ({ ...prev, [slot]: input.trim() }))
      setEditing(false)
      setInput('')
      onKeysSaved?.()
    } catch {
      setError('Could not save key. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKey = async (slot: 'ebird' | 'openweather') => {
    const setError = slot === 'ebird' ? setEbirdKeyError : setOpenweatherKeyError
    const setVisible = slot === 'ebird' ? setEbirdKeyVisible : setOpenweatherKeyVisible
    setError(null)
    try {
      await storage.deleteApiKey(slot)
      setKeys(prev => ({ ...prev, [slot]: null }))
      setVisible(false)
      onKeysSaved?.()
    } catch {
      setError('Could not clear key.')
    }
  }

  const startEdit = (slot: 'ebird' | 'openweather') => {
    if (slot === 'ebird') { setEbirdKeyEditing(true); setEbirdKeyInput(''); setEbirdKeyError(null) }
    else { setOpenweatherKeyEditing(true); setOpenweatherKeyInput(''); setOpenweatherKeyError(null) }
  }

  const cancelEdit = (slot: 'ebird' | 'openweather') => {
    if (slot === 'ebird') { setEbirdKeyEditing(false); setEbirdKeyInput(''); setEbirdKeyError(null) }
    else { setOpenweatherKeyEditing(false); setOpenweatherKeyInput(''); setOpenweatherKeyError(null) }
  }

  const handleSaveMapDefaults = async () => {
    const lat = parseFloat(mapLat)
    const lng = parseFloat(mapLng)
    const dist = parseInt(mapDist, 10)
    if (isNaN(lat) || lat < -90 || lat > 90) { setMapDefaultsStatus('error'); return }
    if (isNaN(lng) || lng < -180 || lng > 180) { setMapDefaultsStatus('error'); return }
    if (isNaN(dist) || dist <= 0) { setMapDefaultsStatus('error'); return }
    setMapDefaultsStatus('saving')
    try {
      await storage.setSetting('map-defaults', { lat, lng, dist })
      setMapDefaultsHasSaved(true)
      if (savedChipTimerRef.current) clearTimeout(savedChipTimerRef.current)
      setMapDefaultsStatus('saved')
      savedChipTimerRef.current = setTimeout(() => setMapDefaultsStatus('idle'), 2500)
    } catch {
      setMapDefaultsStatus('error')
    }
  }

  const handleClearMapDefaults = async () => {
    await storage.deleteSetting('map-defaults').catch(() => {})
    setMapLat(''); setMapLng(''); setMapDist('')
    setMapDefaultsHasSaved(false)
    setMapDefaultsStatus('idle')
    if (savedChipTimerRef.current) clearTimeout(savedChipTimerRef.current)
  }

  return (
    <>
    <div style={{ width: '100%', maxWidth: 680, margin: '0 auto' }}>

      <SectionHeader label="Help &amp; Documentation" />

      <div style={{
        border: '1px solid var(--sr-border)', borderRadius: 10,
        background: 'var(--sr-surface)', overflow: 'hidden',
        marginBottom: 24, display: 'flex', alignItems: 'center',
        gap: 16, padding: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--sr-accent-bg)', border: '1px solid var(--sr-accent-border)',
          color: 'var(--sr-accent)',
        }}>
          <BookOpen size={18} strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sr-text)', marginBottom: 2 }}>
            SnowRaven Documentation
          </div>
          <div style={{ fontSize: 12, color: 'var(--sr-text-muted)', lineHeight: 1.5 }}>
            Setup guides, feature walkthroughs, and API key instructions. Available offline.
          </div>
        </div>
        <button
          onClick={() => setHelpOpen(true)}
          style={{
            height: 34, padding: '0 16px', flexShrink: 0,
            background: 'var(--sr-accent)', color: '#fff',
            border: 'none', borderRadius: 7,
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Open documentation
        </button>
      </div>

      <SectionHeader label="Appearance" />

      <div style={{ border: '1px solid var(--sr-border)', borderRadius: 10, background: 'var(--sr-surface)', overflow: 'hidden', marginBottom: 24 }}>
        <AppearanceRow />
      </div>

      <SectionHeader label="API Keys" />

      <div style={{ border: '1px solid var(--sr-border)', borderRadius: 10, background: 'var(--sr-surface)', overflow: 'hidden', marginBottom: 8 }}>
        <KeyRow
          label="eBird API Key"
          sublabel="Not configured"
          value={keys.ebird}
          visible={ebirdKeyVisible}
          editing={ebirdKeyEditing}
          input={ebirdKeyInput}
          saving={ebirdKeySaving}
          error={ebirdKeyError}
          onToggleVisible={() => setEbirdKeyVisible(v => !v)}
          onStartEdit={() => startEdit('ebird')}
          onCancelEdit={() => cancelEdit('ebird')}
          onInputChange={setEbirdKeyInput}
          onSave={() => handleSaveKey('ebird')}
          onDelete={() => handleDeleteKey('ebird')}
        />
        <div style={{ borderTop: '1px solid var(--sr-border-subtle)' }}>
          <KeyRow
            label="OpenWeather API Key"
            sublabel="Not configured"
            value={keys.openweather}
            visible={openweatherKeyVisible}
            editing={openweatherKeyEditing}
            input={openweatherKeyInput}
            saving={openweatherKeySaving}
            error={openweatherKeyError}
            onToggleVisible={() => setOpenweatherKeyVisible(v => !v)}
            onStartEdit={() => startEdit('openweather')}
            onCancelEdit={() => cancelEdit('openweather')}
            onInputChange={setOpenweatherKeyInput}
            onSave={() => handleSaveKey('openweather')}
            onDelete={() => handleDeleteKey('openweather')}
          />
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--sr-text-disabled)', marginTop: 10, lineHeight: 1.5, marginBottom: 24 }}>
        {isTauri()
          ? 'Keys are stored in this app\'s local data directory and take effect immediately — no restart needed.'
          : 'Keys are stored in the server\'s .env file and take effect immediately — no restart needed. They stay configured across app restarts.'}
      </p>

      <SectionHeader label="Default Files" />

      <div style={{ border: '1px solid var(--sr-border)', borderRadius: 10, background: 'var(--sr-surface)', overflow: 'hidden' }}>
        <FileRow
          label="eBird Backup"
          sublabel="Used by the Breeding Codes tab"
          info={status.ebird}
          uploading={ebirdUploading}
          error={ebirdError}
          onUpload={file => handleUpload('ebird', file)}
          onDelete={() => handleDeleteFile('ebird')}
        />
        <div style={{ borderTop: '1px solid var(--sr-border-subtle)' }}>
          <FileRow
            label="ML Export"
            sublabel="Used by the Media List tab"
            info={status.ml}
            uploading={mlUploading}
            error={mlError}
            onUpload={file => handleUpload('ml', file)}
            onDelete={() => handleDeleteFile('ml')}
          />
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--sr-text-disabled)', marginTop: 10, lineHeight: 1.5, marginBottom: 24 }}>
        {isTauri()
          ? 'Files are stored in this app\'s local data directory and load automatically when you open the relevant tab.'
          : 'Files are stored on this server and load automatically when you open the relevant tab.'}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap' }}>
          Default Location
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)', border: '1px solid var(--sr-accent-border)' }}>
          NEW
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--sr-border)' }} />
      </div>

      <div style={{ border: '1px solid var(--sr-border)', borderRadius: 10, background: 'var(--sr-surface)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px' }}>
          <p style={{ fontSize: 12, color: 'var(--sr-text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
            Set a home location for the Map Explorer. These coordinates load automatically every time you open the map tab.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 88px', gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sr-text-muted)', marginBottom: 4 }}>Latitude</div>
              <input
                type="number"
                placeholder="e.g. 37.8275"
                value={mapLat}
                onChange={e => setMapLat(e.target.value)}
                style={{ width: '100%', height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--sr-accent)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--sr-border)' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sr-text-muted)', marginBottom: 4 }}>Longitude</div>
              <input
                type="number"
                placeholder="e.g. -122.4238"
                value={mapLng}
                onChange={e => setMapLng(e.target.value)}
                style={{ width: '100%', height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--sr-accent)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--sr-border)' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sr-text-muted)', marginBottom: 4 }}>Radius (mi)</div>
              <input
                type="number"
                placeholder="5"
                value={mapDist}
                onChange={e => setMapDist(e.target.value)}
                style={{ width: '100%', height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--sr-accent)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--sr-border)' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleSaveMapDefaults}
              disabled={mapDefaultsStatus === 'saving'}
              style={{
                height: 32, padding: '0 14px',
                background: mapDefaultsStatus === 'saving' ? 'var(--sr-surface-subtle)' : 'var(--sr-accent)',
                color: mapDefaultsStatus === 'saving' ? 'var(--sr-text-disabled)' : '#fff',
                border: 'none', borderRadius: 6,
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                cursor: mapDefaultsStatus === 'saving' ? 'not-allowed' : 'pointer',
              }}
            >
              {mapDefaultsStatus === 'saving' ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleClearMapDefaults}
              disabled={!mapDefaultsHasSaved}
              style={{
                height: 32, padding: '0 14px',
                background: 'var(--sr-surface-subtle)',
                color: mapDefaultsHasSaved ? 'var(--sr-text)' : 'var(--sr-text-disabled)',
                border: '1px solid var(--sr-border)', borderRadius: 6,
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                cursor: mapDefaultsHasSaved ? 'pointer' : 'not-allowed',
              }}
            >
              Clear
            </button>
            {mapDefaultsStatus === 'saved' && (
              <span style={{ fontSize: 12, color: 'var(--sr-accent)', fontWeight: 500 }}>✓ Saved</span>
            )}
            {mapDefaultsStatus === 'error' && (
              <span style={{ fontSize: 12, color: 'var(--sr-error)' }}>Check your values and try again.</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <TabLayoutSection
          tabOrder={tabOrder}
          tabHidden={tabHidden}
          onReorder={onReorder}
          onToggleVisibility={onToggleVisibility}
          onRestoreDefaults={onRestoreDefaults}
        />
      </div>

      {isTauri() && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap' }}>
              Troubleshooting
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--sr-border)' }} />
          </div>
          <div style={{ border: '1px solid var(--sr-border)', borderRadius: 10, background: 'var(--sr-surface)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 12, color: 'var(--sr-text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                If the map or species lookups stop working, rebuilding the app's local caches usually fixes it. The app will restart.
              </p>
              <RebuildCachesButton />
            </div>
          </div>
        </div>
      )}

    </div>
    {helpOpen && <HelpDocs onClose={() => setHelpOpen(false)} />}
    </>
  )
}
