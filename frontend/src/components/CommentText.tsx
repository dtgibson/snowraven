import { Link } from './ui/Link'
import { Fragment } from 'react'
import { commentSegments, linkify } from '../lib/commentText'
import { openNewTabLink } from '../lib/openExternal'

// Renders an eBird comment safely: HTML entities decoded (no innerHTML), http(s)
// URLs as validated links, and \r\n as line breaks. Text is rendered as escaped
// React children — only validated http/https URLs ever become <a> elements.
// Shared by the Checklist Comparer and the Checklists tab (lifted from the
// comparer rather than copied a third time — see checklists-tab design-spec).
//
// Input contract: pass `raw` entity-ENCODED text (the comparer's API data) and
// it decodes once. If the caller's data layer has ALREADY decoded (the
// Checklists tab — stripWeatherTideBlocks operates on decoded text), set
// `decoded` so entities are not decoded a second time: a double decode would
// render text differently than written and break the display==search
// invariant (security review, 2026-06-10).
//
// In the Tauri apps a link's click sends its own `href` to the opener
// (lib/openExternal.ts), resolved exactly as the anchor resolves it, so a
// user-written URL reaches the browser as the same string it did before.
export function CommentText({ raw, decoded = false }: { raw: string; decoded?: boolean }) {
  const segs = decoded ? linkify(raw) : commentSegments(raw)
  return (
    <>
      {segs.map((seg, i) => {
        const href = seg.href
        // Belt-and-suspenders: only ever emit an <a> for an http(s) href, even though
        // linkify already guarantees that — so a future change there can't widen it.
        return href && /^https?:\/\//i.test(href) ? (
          <Link key={i} href={href} target="_blank" rel="noopener noreferrer"
            onClick={event => openNewTabLink(event, href)}
            style={{ color: 'var(--sr-accent)', textDecoration: 'underline', wordBreak: 'break-word' }}>
            {seg.text}
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        ) : (
          <span key={i} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            {seg.text.split(/\r\n|\r|\n/).map((line, j) => (
              <Fragment key={j}>{j > 0 && <br />}{line}</Fragment>
            ))}
          </span>
        )
      })}
    </>
  )
}
