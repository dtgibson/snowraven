// Pure formatting helpers + const tables for the Map Explorer (extracted from
// MapExplorer.tsx in a behavior-preserving split).

import type React from 'react'
import { TEARDROP } from './mapPins'
import type { RecencyTier, HotspotPin } from './mapExplorerTypes'

function teardropHtml(colorVar: string, glyphSvg: string): string {
  return `<svg viewBox="0 0 28 40" width="28" height="40" xmlns="http://www.w3.org/2000/svg"><path d="${TEARDROP}" style="fill:${colorVar}"/>${glyphSvg}</svg>`
}

// Teardrop SVGs for the sidebar legend (CSS vars resolve at paint time). The
// on-map teardrops are canvas sprites baked from the same TEARDROP path in
// lib/mapPins.ts (teardropImageData) — keep the glyphs visually in sync.
export const TEARDROP_HTML: Record<HotspotPin['kind'], string> = {
  visited: teardropHtml('var(--sr-map-visited)', '<polyline points="8,15 12,19 20,11" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'),
  unvisited: teardropHtml('var(--sr-map-unvisited)', '<circle cx="10" cy="13" r="3.5" fill="white"/><circle cx="18" cy="13" r="3.5" fill="white"/>'),
  personal: teardropHtml('var(--sr-map-personal)', '<polygon points="14,6 15.5,11 20.5,11 16.5,14.2 18,19 14,16 10,19 11.5,14.2 7.5,11 12.5,11" fill="white"/>'),
}

export const SELECT_STYLE: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 28px 0 10px',
  // --sr-border-input gives the form control a ≥3:1 non-text boundary (F104).
  // No inline outline:'none' — the global :focus-visible ring must render (F105).
  border: '1.5px solid var(--sr-border-input)', borderRadius: 6,
  fontSize: '0.8125rem', fontFamily: 'inherit', color: 'var(--sr-text)',
  background: `var(--sr-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 8px center`,
  appearance: 'none', WebkitAppearance: 'none',
  cursor: 'pointer', boxSizing: 'border-box',
}

// aria-hidden so browse-mode screen readers don't hit unnamed images on the
// on-map chips; the missing-media types ride alongside as text (F045).
export const MEDIA_ICONS: Record<'Photo' | 'Audio' | 'Video', string> = {
  Photo: `<svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  Audio: `<svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
  Video: `<svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>`,
}

export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function recencyTier(recentDate: string): RecencyTier {
  const dateStr = recentDate.split(' ')[0]
  const [y, m, d] = dateStr.split('-').map(Number)
  const obsDate = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.floor((today.getTime() - obsDate.getTime()) / 86400000)
  if (days <= 7) return 'fresh'
  if (days <= 15) return 'mid'
  return 'old'
}

export function tierColors(tier: RecencyTier): { bg: string; text: string } {
  // Text tokens (not literal 'white') — the dark-theme fills lighten enough that
  // white text fails AA; each tier has a theme-adaptive text token (F018).
  if (tier === 'fresh') return { bg: 'var(--sr-map-target-fresh)', text: 'var(--sr-map-target-fresh-text)' }
  if (tier === 'mid')   return { bg: 'var(--sr-map-target-mid)',   text: 'var(--sr-map-target-mid-text)' }
  return                       { bg: 'var(--sr-map-target-old)',   text: 'var(--sr-map-target-old-text)' }
}

export function radiusToZoom(distMiles: number): number {
  if (distMiles <= 5) return 12
  if (distMiles <= 10) return 11
  if (distMiles <= 25) return 10
  return 9
}
