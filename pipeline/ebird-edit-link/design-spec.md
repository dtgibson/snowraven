# Design Spec — eBird Edit Link
**Feature:** ebird-edit-link
**Date:** 2026-05-08
**Stage:** 4 — The Designer
**Source:** prd.md, strategic-brief.md (approved)

---

## Placement

Inside the `{hasResult && (...)}` block in `App.tsx`, the existing confirmation `<div>` is converted to a flex row:

- **Left:** confirmation text (`S… / location / date`) in monospace, muted (`#71717A`), 12px
- **Right:** "Edit on eBird" link with external-link icon

This mirrors the "Weather output" label + "Copy" button pattern directly below it.

---

## Link Element

```tsx
<a
  href={`https://ebird.org/edit/effort?subID=${state.checklistId}`}
  target="_blank"
  rel="noreferrer"
  aria-label="Edit this checklist on eBird (opens in new tab)"
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    fontWeight: 500,
    color: '#2D8653',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }}
  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
>
  Edit on eBird
  <ExternalLink size={11} strokeWidth={2.5} />
</a>
```

**Icon:** `ExternalLink` from `lucide-react` (already a dependency), size 11, strokeWidth 2.5.

---

## Confirmation Row Wrapper

```tsx
<div style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 14,
}}>
  <span style={{
    fontSize: 12,
    color: '#71717A',
    fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace',
    letterSpacing: '0.01em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  }}>
    {`${state.checklistId} / ${state.locName} / ${state.obsDt}`}
  </span>
  {/* Edit link here */}
</div>
```

The confirmation text gets `minWidth: 0` + `overflow: hidden` + `textOverflow: ellipsis` so it truncates gracefully on narrow widths rather than pushing the link off-screen.

---

## Import Addition

Add `ExternalLink` to the existing lucide-react import line.

---

## Token Reference

| Token | Value |
|---|---|
| Link color | `#2D8653` (SnowRaven green) |
| Font size | `12px` |
| Font weight | `500` |
| Icon size | `11px` |
| Gap (icon) | `4px` |
| Row gap | `12px` |
| Row margin-bottom | `14px` (unchanged from current confirmation div) |
