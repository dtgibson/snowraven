# Decisions — settings-acknowledgments

## Stage 4 — The Designer (2026-08-31)

- **Deliberate deviation from FR-01's row shape, at the user's direction.**
  FR-01 specified the "Help & Documentation" shape (icon tile, row title,
  one-line description, trailing button). The user asked for the section to be
  more subtle ("no heart, no 'behind SnowRaven' language, a bit more basic"),
  so the shipped shape is the tab's quietest register instead: SectionHeader
  plus a card holding a single quiet bordered "View acknowledgments" button —
  no icon tile, no row title, no description. Precedent: four shipped sections
  are already icon-less, and Troubleshooting ships exactly this card-plus-one-
  quiet-button shape. FR-02's button label and accessible name are unchanged,
  so findability and the PRD's accessibility requirements are intact.
- **Reveal mechanism: inline disclosure** (PRD Open Question 1) — two short
  entries do not earn an overlay; the panel expands inside the section's card
  using the app's shipped grid-collapse mechanism, inert while closed.
- **Placement: last section of the tab** (Open Question 2) — after the
  Tauri-gated Troubleshooting block, so it is last on every platform and no
  existing section moves.
- **Links: none** (Open Question 3) — the section stays strictly zero-network;
  QA-15 passes vacuously. The Deven Simonson entry never links in any case.
- **Copy** (Open Question 4): both entries ship the PRD's substance verbatim;
  the row title and description are dropped entirely with the subtler shape.

## Stage 5 — The Engineer (2026-08-31)

- **User-directed scope addition after the live preview:** drastically shorten
  and clean up README.md and the website prose so a reader can quickly judge
  whether the app is useful to them ("the current descriptions are way too long
  and bury the helpful info"). Rides this same change; docs/HELP.md,
  PRIVACY_POLICY.md, and ACCESSIBILITY.md are explicitly untouched by it.
  Accuracy and no-em-dash rules per `.claude/rules/docs-and-website.md` govern
  the rewrite.
- **Execution mode change, user-directed:** Studio Style (Designer) through the
  live preview, then Autopilot for the remainder ("Lets finish the rest on
  autopilot and ship"). The deploy sign-off remains gated as always.
