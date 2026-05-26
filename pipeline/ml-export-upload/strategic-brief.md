# Strategic Brief — ML Export Upload

## What We're Building
A second input path on the Media Life List tab that accepts a Macaulay Library export CSV and generates the full media life list instantly, client-side, with no network requests. The existing eBird-CSV-plus-CDN-lookup path remains available as a fallback. Six new filter pills are also added: "has photo", "has audio", "has video" alongside the existing "no photo", "no audio", "no video".

## Why Now
The CDN lookup path — even after the rate-limit fix — is inherently fragile: it depends on the Cornell CDN being reachable, responds at CDN speed across potentially hundreds of IDs, and can show partial results if any batch fails. The Macaulay Library export CSV is a first-party data source that contains exactly the fields needed (`Catalog Number`, `Common Name`, `Scientific Name`, `Format`) — using it locally is faster, more reliable, and removes the CDN entirely for users who have an ML account. Adding the positive filters rounds out the filter set so users can find species they *have* documented, not only those they're missing.

## The User Problem
A birder with a large life list (300+ species) experiences inconsistent Media Life List results — occasionally fast, occasionally stalled, occasionally showing the error banner — even with the rate-limit fix in place. They have a Macaulay Library account and can export their media, but SnowRaven gives them no way to use that data directly. They also want to quickly see which species they *have* photographed, not only what they're missing.

## Success Criteria
- A user can upload a Macaulay Library export CSV and see their full media list in under a second, with no network requests made
- The tab presents the ML export path clearly as the preferred option and the eBird path as the alternative
- Uploading either file type produces an identical-looking results table
- All six filter pills work correctly: no photo, no audio, no video, has photo, has audio, has video
- The existing eBird-based lookup continues to work exactly as before

## Scope
- New client-side parser for the Macaulay Library export CSV format (`Catalog Number`, `Common Name`, `Scientific Name`, `Format`)
- Updated drop zone UI on the Media Life List tab presenting two input options
- Six filter pills (three new positive filters added to the existing three negative filters)
- No backend changes required — the ML export path is entirely client-side

## Out of Scope
- Any changes to the eBird-based lookup path or `POST /ml/media-types` endpoint
- Merging data from both sources simultaneously
- Persisting the uploaded file between sessions
- Changes to any other tab

## Key Decisions
- ML export is the preferred path — the UI should present it first and signal that it is the faster, more reliable option
- Both paths produce identical output — the results table, filters, and sort controls are shared
- Positive filters ("has photo" etc.) are added to the existing tab, not as a separate view
- Client-side only — no backend involvement for the ML export path
