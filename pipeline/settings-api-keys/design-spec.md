# Design Spec — API Key Settings

## Layout

"API Keys" section appears above "Default Files" in the Settings tab. Both sections use the identical header pattern: uppercase label (11px, font-weight 600, letter-spacing 0.07em, color #71717A) + flex-1 horizontal rule (#E4E4E7).

Both key rows live inside a single card (same border/radius as the existing files card). A `borderTop: '1px solid #F4F4F5'` divider separates the two rows.

## Icon

Lock icon (lucide-react `Lock`, size 18, strokeWidth 1.75). Green (`#2D8653`) on green background (`#E8F5EE`) when set. Grey (`#A1A1AA`) on grey background (`#F4F4F5`) when not set. Icon container: 38×38px, border-radius 9px.

## Key Row — Not Set State

- Grey lock icon
- Label (13.5px, font-weight 600) + sublabel "Not configured" (13px, #A1A1AA)
- "No key saved" chip: height 24px, padding 0 10px, background #F4F4F5, border-radius 12px, 11px font, color #A1A1AA
- [Add key] button: height 32px, border 1.5px solid #E4E4E7, background #fff, color #0F1117

## Key Row — Set State (Masked)

- Green lock icon
- Label + masked value `••••••••••••••••` (monospace, letter-spacing 2px, 13px, color #0F1117) + [Show] text toggle
- [Update] button: height 32px, border 1.5px solid #E4E4E7, background #fff, color #0F1117
- [Clear] button: height 32px, border 1.5px solid #FECACA, background #fff, color #DC2626

## Key Row — Set State (Revealed)

Same as masked but value is displayed as actual text (12px monospace, color #0F1117, max-width truncated with ellipsis). Toggle reads "Hide".

## Show/Hide Toggle

Plain text button — no border, no background. Font-size 12px, font-weight 500, color #2D8653, cursor pointer. Positioned inline next to the masked/revealed value with gap 8px.

## Edit Mode (inline expansion)

When "Add key" or "Update" is clicked, the value display is replaced by an input row that appears below the label row, still inside the card:

```
[icon]  [Label]
        [input field ————————————————] [Save] [Cancel]
```

- Input: height 32px, padding 0 10px, border 1.5px solid #E4E4E7, border-radius 6px, font-size 13px, font-family monospace, color #0F1117. Focus: border-color #2D8653.
- Placeholder: "Paste your API key" (new) or "Enter new key to replace" (update). 12px, color #A1A1AA, non-monospace.
- [Save]: height 32px. Disabled (background #F4F4F5, border #E4E4E7, color #A1A1AA, cursor not-allowed) when input is blank. Active (background #2D8653, border rgba(45,134,83,0.25), color #fff) when input has content.
- [Cancel]: height 32px, border 1.5px solid #E4E4E7, background #fff, color #0F1117.

## Error State

Error message appears below the input row (same position as FileRow errors): margin 0 16px 10px, padding 7px 11px, background #FEF2F2, border-radius 6px, font-size 12px, color #DC2626.

## Footnote

Below the API Keys card: "Keys are stored in the server's .env file and take effect immediately — no restart needed. They stay configured across app restarts." 12px, color #A1A1AA, line-height 1.5, margin-top 10px.

## Interaction Model

- Clicking "Add key" or "Update": sets `editing = true`, clears input to ''
- Clicking "Cancel": sets `editing = false`, clears input, clears error
- Clicking "Save" with content: calls save handler; on success sets `editing = false`, updates `keys` state
- Clicking "Show": sets `visible = true`
- Clicking "Hide": sets `visible = false`
- Clicking "Clear": calls delete handler; on success sets `keys[slot] = null`, `visible = false`
- Switching away from edit mode (Cancel) does not change the saved key

## Reference File

`pipeline/settings-api-keys/design.html` — interactive mockup showing full Settings tab and all six key row states.
