import { useState, useRef } from 'react'
import type { DragEvent, KeyboardEvent, ChangeEvent } from 'react'
import type { FileData } from '../types'

interface DropZoneProps {
  label: string
  file: FileData | null
  error: string | null
  onFile: (filename: string, file: File) => void
}

export function DropZone({ label, file, error, onFile }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) onFile(dropped.name, dropped)
  }
  const handleClick = () => inputRef.current?.click()
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() }
  }
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) onFile(selected.name, selected)
    e.target.value = ''
  }

  const isLoaded = file !== null && error === null
  const hasError = error !== null
  const isActive = isLoaded || isDragging || (isHovered && !hasError)

  const borderColor = hasError
    ? 'var(--sr-error)'
    : isActive
      ? 'var(--sr-accent)'
      : 'var(--sr-border)'

  const background = hasError
    ? 'var(--sr-error-bg)'
    : isLoaded || isDragging
      ? 'var(--sr-accent-bg)'
      : isHovered
        ? 'var(--sr-accent-surface)'
        : 'var(--sr-surface-subtle)'

  return (
    <div
      style={{
        position: 'relative',
        minHeight: 192,
        borderRadius: 10,
        border: `2px ${hasError || isLoaded || isDragging ? 'solid' : 'dashed'} ${borderColor}`,
        background,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '40px 24px 28px',
        textAlign: 'center',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={0}
      role="button"
      aria-label={`Upload ${label} — click or drag and drop a CSV file`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleInputChange}
        aria-hidden="true"
      />

      <span style={{
        position: 'absolute',
        top: 14,
        left: 18,
        fontSize: '0.625rem',
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        color: isLoaded ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
      }}>
        {label}
      </span>

      {isLoaded ? (
        <CheckIcon />
      ) : hasError ? (
        <UploadIcon color="var(--sr-error)" />
      ) : (
        <UploadIcon color={isHovered || isDragging ? 'var(--sr-accent)' : 'var(--sr-border-medium)'} />
      )}

      {isLoaded && (
        <>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-accent)', wordBreak: 'break-all' }}>
            {file.filename}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--sr-accent-border-strong)' }}>
            {file.species.size} species found
          </span>
        </>
      )}

      {!isLoaded && !hasError && (
        <>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--sr-text)' }}>Drop file here</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>or click to browse</span>
        </>
      )}

      {hasError && (
        <p role="alert" aria-live="assertive" style={{ fontSize: '0.75rem', color: 'var(--sr-error)', maxWidth: 220, margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  )
}

function UploadIcon({ color }: { color: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--sr-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
