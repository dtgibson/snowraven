# Design Spec — Desktop App Phase 1: Weather Formatter

## Visual Direction
This feature has no user-facing UI. The design artifact is a developer reference document — a visual representation of the formatter's contract, expected behavior, and key behavioral rules for use during Stage 5 implementation. Styled in the SnowRaven brand for consistency.

## Screens / Views

### Formatter Reference Document (design.html)
A single-page developer reference with five sections:
1. **Function contract** — TypeScript interface definitions and the exported function signature
2. **Live example** — the production fixture from `test_weather_router.py` rendered as inputs on the left and expected formatted output on the right
3. **Reference tables** — Beaufort scale (all 9 levels with mph thresholds), cardinal directions (all 8 with degree ranges), OWM condition emoji (all mapped ranges)
4. **Behavioral rules** — four annotated cards covering banker's rounding, wind description sort order, wind direction insertion order, and capitalize semantics

## Component Usage
Static HTML/CSS — no React. SnowRaven brand tokens applied as CSS custom properties in `:root`.

## Design Tokens Applied
- `--primary: #2D8653` — section headings, badges, accent borders
- `--foreground: #0F1117` — body text
- `--muted: #F4F4F5` — code block and pre-formatted output backgrounds
- `--border: #E4E4E7` — table borders and card outlines
- `--radius: 0.5rem` — card and table border radius

## Interaction Notes
No interactions required. The design.html is a static reference document opened by The Engineer during implementation.

## Content Notes
All content is technical specification. Monospace font for all code, function signatures, type definitions, and formatted output examples. All example values are drawn from the production mock fixture in `backend/tests/test_weather_router.py`.
