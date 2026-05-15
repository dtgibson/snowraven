import { useEffect, useRef, useState } from 'react'
import { FileCheck, FileQuestion, Lock } from 'lucide-react'
import type { StoredFileInfo, StoredFilesStatus } from '../types'

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

// ---- File rows (unchanged) ----

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
          background: info ? '#E8F5EE' : '#F4F4F5',
        }}>
          {info
            ? <FileCheck size={18} strokeWidth={1.75} style={{ color: '#2D8653' }} />
            : <FileQuestion size={18} strokeWidth={1.75} style={{ color: '#A1A1AA' }} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F1117' }}>{label}</div>
          {info ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0 }}>
              <span style={{
                fontSize: 13, fontWeight: 500, color: '#0F1117',
                maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={info.filename}>{info.filename}</span>
              <span style={{ fontSize: 12, color: '#A1A1AA', whiteSpace: 'nowrap' }}>
                · Saved {formatUploadDate(info.uploadedAt)}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#A1A1AA', marginTop: 2 }}>{sublabel}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!info && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              height: 24, padding: '0 10px',
              background: '#F4F4F5', borderRadius: 12,
              fontSize: 11, fontWeight: 500, color: '#A1A1AA',
            }}>
              No file saved
            </div>
          )}

          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              height: 32, padding: '0 12px',
              border: info ? '1.5px solid rgba(45,134,83,0.25)' : '1.5px solid #E4E4E7',
              background: info ? '#E8F5EE' : '#fff',
              color: info ? '#2D8653' : '#0F1117',
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
              border: info ? '1.5px solid #FECACA' : '1.5px solid #E4E4E7',
              background: info ? '#fff' : '#F4F4F5',
              color: info ? '#DC2626' : '#A1A1AA',
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
          background: '#FEF2F2', borderRadius: 6,
          fontSize: 12, color: '#DC2626',
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
          background: isSet ? '#E8F5EE' : '#F4F4F5',
        }}>
          <Lock size={18} strokeWidth={1.75} style={{ color: isSet ? '#2D8653' : '#A1A1AA' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F1117' }}>{label}</div>
          {!editing && (
            isSet ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{
                  fontFamily: 'monospace', letterSpacing: visible ? 'normal' : 2,
                  fontSize: visible ? 12 : 13, color: '#0F1117',
                  maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {visible ? value : '••••••••••••••••'}
                </span>
                <button
                  onClick={onToggleVisible}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: 12, fontWeight: 500, color: '#2D8653',
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                  }}
                >
                  {visible ? 'Hide' : 'Show'}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#A1A1AA', marginTop: 2 }}>{sublabel}</div>
            )
          )}
        </div>

        {!editing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {!isSet && (
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                height: 24, padding: '0 10px',
                background: '#F4F4F5', borderRadius: 12,
                fontSize: 11, fontWeight: 500, color: '#A1A1AA',
              }}>
                No key saved
              </div>
            )}
            <button
              onClick={onStartEdit}
              style={{
                height: 32, padding: '0 12px',
                border: '1.5px solid #E4E4E7', background: '#fff', color: '#0F1117',
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
                border: isSet ? '1.5px solid #FECACA' : '1.5px solid #E4E4E7',
                background: isSet ? '#fff' : '#F4F4F5',
                color: isSet ? '#DC2626' : '#A1A1AA',
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
              border: '1.5px solid #E4E4E7', borderRadius: 6,
              fontSize: 13, fontFamily: 'monospace', color: '#0F1117',
              outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#2D8653' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7' }}
            onKeyDown={e => { if (e.key === 'Enter' && input.trim()) onSave() }}
          />
          <button
            onClick={onSave}
            disabled={!input.trim() || saving}
            style={{
              height: 32, padding: '0 12px',
              border: '1.5px solid rgba(45,134,83,0.25)',
              background: !input.trim() || saving ? '#F4F4F5' : '#2D8653',
              color: !input.trim() || saving ? '#A1A1AA' : '#fff',
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
              border: '1.5px solid #E4E4E7', background: '#fff', color: '#0F1117',
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
          background: '#FEF2F2', borderRadius: 6,
          fontSize: 12, color: '#DC2626',
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
        letterSpacing: '0.07em', color: '#71717A', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: '#E4E4E7' }} />
    </div>
  )
}

// ---- Main Settings component ----

interface ApiKeyStatus {
  ebird: string | null
  openweather: string | null
}

export function Settings() {
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

      <SectionHeader label="API Keys" />

      <div style={{ border: '1px solid #E4E4E7', borderRadius: 10, background: '#fff', overflow: 'hidden', marginBottom: 8 }}>
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
        <div style={{ borderTop: '1px solid #F4F4F5' }}>
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

      <p style={{ fontSize: 12, color: '#A1A1AA', marginTop: 10, lineHeight: 1.5, marginBottom: 24 }}>
        Keys are stored in the server's .env file and take effect immediately — no restart needed. They stay configured across app restarts.
      </p>

      <SectionHeader label="Default Files" />

      <div style={{ border: '1px solid #E4E4E7', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
        <FileRow
          label="eBird Backup"
          sublabel="Used by the Breeding Codes tab"
          info={status.ebird}
          uploading={ebirdUploading}
          error={ebirdError}
          onUpload={file => handleUpload('ebird', file)}
          onDelete={() => handleDeleteFile('ebird')}
        />
        <div style={{ borderTop: '1px solid #F4F4F5' }}>
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

      <p style={{ fontSize: 12, color: '#A1A1AA', marginTop: 10, lineHeight: 1.5 }}>
        Files are stored on this server and load automatically when you open the relevant tab. Uploading a different file within a tab is session-only and won't replace your saved default.
      </p>
    </div>
  )
}
