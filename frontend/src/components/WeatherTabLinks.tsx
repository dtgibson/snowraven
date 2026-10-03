// The two new-tab links the Weather tab draws itself: "Edit checklist comment on
// eBird" above a successful lookup, and the SnowRaven Mini link under the tab.
//
// Lifted out of App.tsx (sortable-list-links-own-dispatch) so a test can click them
// without rendering the whole app: for every id a lookup can produce, the rendered
// markup is byte-identical to the inline anchors they replace. The one change is
// EditCommentLink's id guard, noted at the function. Each sends its own URL to the opener in the
// Tauri apps (lib/openExternal.ts) and is an ordinary anchor on web and Pi.
import { ExternalLink } from 'lucide-react'
import { Link } from './ui/Link'
import { openNewTabLink } from '../lib/openExternal'
import { SUBMISSION_ID_RE } from './speciesDetail/ui'

const SNOWRAVEN_MINI_URL = 'https://github.com/dtgibson/snowraven-mini'

/**
 * The eBird comment/edit page for the checklist a lookup just answered. The id is
 * shape-checked and encoded like every other eBird id that becomes an href
 * (`EDIT_URL` in WeatherBacklog.tsx is the twin); a malformed one renders nothing.
 * For an id that passes, `encodeURIComponent` changes nothing, so the markup is
 * what App.tsx rendered inline.
 */
export function EditCommentLink({ checklistId }: { checklistId: string }) {
  if (!SUBMISSION_ID_RE.test(checklistId)) return null
  const href = `https://ebird.org/edit/effort?subID=${encodeURIComponent(checklistId)}`
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={e => openNewTabLink(e, href)}
      aria-label="Edit checklist comment on eBird (opens in a new tab)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.75rem',
        fontWeight: 500,
        color: 'var(--sr-accent)',
        textDecoration: 'none',
        marginBottom: 6,
      }}
      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
    >
      Edit checklist comment on eBird
      <ExternalLink size={11} strokeWidth={2.5} />
    </Link>
  )
}

/** The browser extension's repository, in the Weather tab's closing line. */
export function SnowRavenMiniLink() {
  return (
    <Link href={SNOWRAVEN_MINI_URL} target="_blank" rel="noreferrer" onClick={e => openNewTabLink(e, SNOWRAVEN_MINI_URL)} aria-label="SnowRaven Mini on GitHub (opens in a new tab)" style={{ color: 'inherit', textDecoration: 'underline' }}>SnowRaven Mini</Link>
  )
}
