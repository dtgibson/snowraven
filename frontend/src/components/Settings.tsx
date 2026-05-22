import { useEffect, useRef, useState } from 'react'
import { FileCheck, FileQuestion, Lock } from 'lucide-react'
import type { StoredFileInfo, StoredFilesStatus } from '../types'
import { applyTheme, readStoredPreference } from '../lib/theme'
import type { ThemePreference } from '../lib/theme'

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
          Colour scheme
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

// ---- Main Settings component ----

interface ApiKeyStatus {
  ebird: string | null
  openweather: string | null
}

export function Settings({ onKeysSaved }: { onKeysSaved?: () => void }) {
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

  useEffect(() => {
    fetch('/settings/files')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStatus(data) })
      .catch(() => {})

    fetch('/settings/keys')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setKeys(data) })
      .catch(() => {})
  }, [])

  // File handlers
  const handleUpload = async (slot: 'ebird' | 'ml', file: File) => {
    const setUploading = slot === 'ebird' ? setEbirdUploading : setMlUploading
    const setError = slot === 'ebird' ? setEbirdError : setMlError
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/settings/files/${slot}`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.detail ?? 'Upload failed. Please try again.'); return }
      setStatus(prev => ({ ...prev, [slot]: { filename: data.filename, uploadedAt: data.uploadedAt } }))
    } catch {
      setError('Could not reach the server. Is the backend running?')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFile = async (slot: 'ebird' | 'ml') => {
    const setError = slot === 'ebird' ? setEbirdError : setMlError
    setError(null)
    try {
      const res = await fetch(`/settings/files/${slot}`, { method: 'DELETE' })
      if (!res.ok) { const data = await res.json(); setError(data.detail ?? 'Delete failed.'); return }
      setStatus(prev => ({ ...prev, [slot]: null }))
    } catch {
      setError('Could not reach the server. Is the backend running?')
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
      const res = await fetch(`/settings/keys/${slot}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: input.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail ?? 'Could not save key. Please try again.')
        return
      }
      setKeys(prev => ({ ...prev, [slot]: input.trim() }))
      setEditing(false)
      setInput('')
      onKeysSaved?.()
    } catch {
      setError('Could not reach the server. Is the backend running?')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKey = async (slot: 'ebird' | 'openweather') => {
    const setError = slot === 'ebird' ? setEbirdKeyError : setOpenweatherKeyError
    const setVisible = slot === 'ebird' ? setEbirdKeyVisible : setOpenweatherKeyVisible
    setError(null)
    try {
      const res = await fetch(`/settings/keys/${slot}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail ?? 'Could not clear key.')
        return
      }
      setKeys(prev => ({ ...prev, [slot]: null }))
      setVisible(false)
      onKeysSaved?.()
    } catch {
      setError('Could not reach the server. Is the backend running?')
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

  return (
    <div style={{ width: '100%', maxWidth: 680, margin: '0 auto' }}>

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
        Keys are stored in the server's .env file and take effect immediately — no restart needed. They stay configured across app restarts.
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

      <p style={{ fontSize: 12, color: 'var(--sr-text-disabled)', marginTop: 10, lineHeight: 1.5 }}>
        Files are stored on this server and load automatically when you open the relevant tab. Uploading a different file within a tab is session-only and won't replace your saved default.
      </p>
    </div>
  )
}
