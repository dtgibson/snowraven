import { useEffect, useRef, useState } from 'react'
import { FileCheck, FileQuestion } from 'lucide-react'
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

export function Settings() {
  const [status, setStatus] = useState<StoredFilesStatus>({ ebird: null, ml: null })
  const [ebirdUploading, setEbirdUploading] = useState(false)
  const [mlUploading, setMlUploading] = useState(false)
  const [ebirdError, setEbirdError] = useState<string | null>(null)
  const [mlError, setMlError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/settings/files')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStatus(data) })
      .catch(() => {})
  }, [])

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
      if (!res.ok) {
        setError(data.detail ?? 'Upload failed. Please try again.')
        return
      }
      setStatus(prev => ({ ...prev, [slot]: { filename: data.filename, uploadedAt: data.uploadedAt } }))
    } catch {
      setError('Could not reach the server. Is the backend running?')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (slot: 'ebird' | 'ml') => {
    const setError = slot === 'ebird' ? setEbirdError : setMlError
    setError(null)
    try {
      const res = await fetch(`/settings/files/${slot}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail ?? 'Delete failed.')
        return
      }
      setStatus(prev => ({ ...prev, [slot]: null }))
    } catch {
      setError('Could not reach the server. Is the backend running?')
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: '#71717A', whiteSpace: 'nowrap',
        }}>
          Default Files
        </span>
        <div style={{ flex: 1, height: 1, background: '#E4E4E7' }} />
      </div>

      <div style={{ border: '1px solid #E4E4E7', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
        <FileRow
          label="eBird Backup"
          sublabel="Used by the Breeding Codes tab"
          info={status.ebird}
          uploading={ebirdUploading}
          error={ebirdError}
          onUpload={file => handleUpload('ebird', file)}
          onDelete={() => handleDelete('ebird')}
        />
        <div style={{ borderTop: '1px solid #F4F4F5' }}>
          <FileRow
            label="ML Export"
            sublabel="Used by the Media List tab"
            info={status.ml}
            uploading={mlUploading}
            error={mlError}
            onUpload={file => handleUpload('ml', file)}
            onDelete={() => handleDelete('ml')}
          />
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#A1A1AA', marginTop: 10, lineHeight: 1.5 }}>
        Files are stored on this server and load automatically when you open the relevant tab. Uploading a different file within a tab is session-only and won't replace your saved default.
      </p>
    </div>
  )
}
