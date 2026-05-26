# Design Spec — ML Export Upload

## Visual Direction
Consistent with the existing SnowRaven brand — quiet utility, Irish clover green (#2D8653) as the primary action color, clean Inter typography, generous whitespace. The upload screen uses visual hierarchy rather than labels to communicate preference: the ML export zone dominates through size and color, the eBird zone recedes through a lighter treatment.

## Screens / Views

### Upload Screen (idle state)

**Primary zone — ML export:**
- Full-width, flex-grow drop zone with a 2px dashed green (#2D8653) border and 12px border radius
- "Recommended" badge: top-right, small caps, green tint (#E8F5EE background, #2D8653 text)
- Icon: 48×48px rounded square with #E8F5EE background, download-arrow SVG in green
- Headline: "Upload your Macaulay Library export" — 15px, weight 600
- Subline: "Instant results — no network lookups" — 12px, #2D8653 (green reinforces the positive message)
- Instruction row: info icon + "Sign in to Macaulay Library → My Media → Save Spreadsheet" — 12px, #71717A
- Browse hint: "Drop file here, or click to browse" — 12px, #71717A
- Hover state: background shifts to #F0FAF4

**Divider:**
- Horizontal rule with centered label "or use your eBird backup" — 11px, #A1A1AA

**Secondary zone — eBird CSV:**
- Single compact row with 1.5px dashed #E4E4E7 border, 10px border radius
- Left: 36×36px rounded icon in #F4F4F5, upload-arrow SVG in #71717A
- Label: "MyEBirdData.csv" — 13px, weight 500
- Sub-label: "Looks up media coverage online — may take a moment for large lists" — 11px, #71717A
- Right: chevron arrow in #D4D4D8
- Hover: background #FAFAFA, border #D4D4D8

### Results Screen

**Filter pill row (left side):**
- 7 pills total in this order: All · [separator] · No photo · No audio · No video · [separator] · Has photo · Has audio · Has video
- Thin 1px vertical separators (#E4E4E7) visually group negative and positive filters
- Default active: All — green tint (#E8F5EE bg, #2D8653 text, rgba(45,134,83,0.25) border)
- Active negative (No photo/audio/video): red tint (#FEF2F2 bg, #DC2626 text, rgba(239,68,68,0.3) border)
- Active positive (Has photo/audio/video): green tint — same as All active
- Each pill includes the relevant icon (camera, mic, video) at 11px

**Right controls (unchanged from current):**
- Count label: "312 species" or "47 of 312 species"
- Sort control: A-Z only shown for ML export results; both Taxonomic and A-Z shown for eBird results
- Show all / Collapse ghost button
- Load new file ghost button

**Species table:**
- Unchanged from current implementation
- Seen column always ✓ (green checkmark in #E8F5EE pill)
- Photo/Audio/Video: ✓ in #2D8653 or — in #D4D4D8

## Component Usage
- All custom inline styles matching existing SnowRaven component patterns (no shadcn components used in this tab currently — maintain consistency)
- Pill pattern: same as existing filter pills in LifeList.tsx
- Ghost button pattern: same as existing controls
- Sort segmented control: same as existing sort control

## Design Tokens Applied
- Primary: #2D8653 (drop zone border, badge, subline, active pill, table checks)
- Accent: #E8F5EE (primary zone hover, badge bg, positive active pill bg, seen cell bg)
- Secondary surface: #F0FAF4 (primary zone hover background)
- Muted: #F4F4F5 (secondary icon bg, table header bg, active sort btn)
- Muted foreground: #71717A (secondary labels, instruction text, pill default text)
- Border: #E4E4E7 (secondary zone border, pill borders, divider lines, table)
- Destructive tint: #FEF2F2 / #DC2626 (active negative filter pill)

## Interaction Notes
- Primary upload zone: entire area is a drop target and click target; hover shifts background to #F0FAF4
- Secondary upload zone: entire row is clickable; hover shifts background to #FAFAFA
- File type auto-detected from CSV header — no explicit type selection UI required
- Filter pills: single-select; clicking any pill deactivates previous active pill
- "Load new file" resets to upload screen, clears all state
- Sort control for ML export results: only A-Z button rendered (Taxonomic hidden, not disabled)

## Content Notes
- Instruction text is literal and step-by-step: "Sign in to Macaulay Library → My Media → Save Spreadsheet"
- Error copy (not shown in mockup) for unrecognized file: "This doesn't look like a Macaulay Library export or an eBird backup. Check you're uploading the right file."
- No lorem ipsum anywhere — all species names and data in the mockup are real eBird species
