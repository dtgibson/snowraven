# Design Spec — Update Script + In-App Update Check

## Visual Direction
Minimal and unobtrusive — the update check lives entirely in the footer, inline with existing text, and never draws attention to itself unless there's something worth seeing. All states use the same 12px muted type as the rest of the footer.

## Screens / Views

### Footer — All States

The footer reads: `SnowRaven · Self-hosted Birding Tools · Check For Updates`

The "Check For Updates" element is a button styled to look like plain text (no border, no background). All states replace only that element — the rest of the footer is unchanged.

**Default state:**
- Text: `Check For Updates`
- Color: `#71717A` (muted-foreground)
- Cursor: pointer; underline on hover
- No interaction while a check is in progress

**Checking state:**
- Text: `Checking…`
- Color: `#71717A` (muted-foreground)
- Non-interactive

**Up to date state:**
- Text: `Up to date (v{current})`
- Color: `#2D8653` (primary green)
- Reverts to default after 4 seconds

**Update available state:**
- Text: `v{latest} available — run ./update.sh` (with `./update.sh` in monospace)
- Color: `#92400e` (amber — catches the eye without alarming)
- Reverts to default after 8 seconds (longer, to give time to read and act)

**Error state:**
- Text: `Could not check for updates`
- Color: `#b91c1c` (muted red)
- Reverts to default after 4 seconds

## Component Usage
No new components. The update check is a plain `<button>` styled to match footer link appearance, with an inline `<span>` swap for result states. Consistent with the existing footer `<a>` element.

## Design Tokens Applied
- `#71717A` — muted-foreground, for default and checking states
- `#2D8653` — primary, for up-to-date state
- `#92400e` — amber, for update-available state
- `#b91c1c` — muted red, for error state
- `ui-monospace` font stack — for `./update.sh` in the update-available message

## Interaction Notes
- Clicking while a check is in progress has no effect
- Result states revert to the default link automatically (4s for most states, 8s for update-available)
- The footer text is updated to title case: `Self-hosted Birding Tools · Check For Updates`

## Content Notes
- "Check For Updates" uses title case per user preference
- The update-available message is deliberately brief: version number + the exact command to run
- No modal, no toast, no overlay — everything stays inline in the footer
