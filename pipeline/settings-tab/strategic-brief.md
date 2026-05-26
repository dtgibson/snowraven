# Strategic Brief — Settings Tab

## What We're Building
A Settings tab (rightmost in the tab bar) where users can upload and persistently store their eBird backup CSV and Macaulay Library export file on the server's filesystem. Stored files are automatically loaded by default in the Breeding Codes and Media List tabs, eliminating re-uploads between sessions.

## Why Now
SnowRaven's tools are mature enough to be used regularly rather than occasionally. Users who check the app weekly — a common pattern for active eBird contributors — are re-uploading the same files every visit. Persistent defaults make SnowRaven feel like a personal tool rather than a one-off lookup, and the self-hosted architecture makes server-side file storage a natural fit.

## The User Problem
The user runs their own SnowRaven instance and uses the Breeding Codes and Media List tabs consistently. Re-uploading the same CSV on every visit is friction that compounds over time. Since SnowRaven is self-hosted, there's an obvious and appropriate place to solve this: the server's own filesystem.

## Success Criteria
- Upload an eBird backup once on Settings → Breeding Codes auto-loads it on subsequent visits
- Upload an ML export once → Media List auto-loads it
- Stored filename and upload date visible on the Settings tab for each file
- Clear buttons remove stored files from the server
- Existing upload UIs on each tab remain fully functional for one-off or alternate files

## Scope
- Settings tab in rightmost position in the tab bar
- Two upload areas on Settings: one for eBird backup, one for ML export
- Backend: file storage in a `data/` subdirectory at the project root, gitignored
- Backend endpoints: upload, fetch, and delete for each file type, plus a status check
- On tab open: frontend checks for a stored file via API and auto-loads it if present
- Stored filename shown in each relevant tab's toolbar when a default is active

## Out of Scope
- Any settings beyond file management (theme, preferences, API keys, etc.)
- Server-side CSV parsing — the frontend still parses file content as it does today
- File syncing across devices or multiple instances
- Authentication or access control
- Storing any files other than eBird backup and ML export CSVs

## Key Decisions
- Files stored on server filesystem, not browser storage — consistent with the self-hosted, no-cloud founding vision
- Storage directory is `data/` at the project root, added to `.gitignore`
- Backend serves file content back to the frontend; frontend parses it using existing parser logic
- File validation: `.csv` only, reasonable size limit (configurable, default 50 MB)
- Existing per-tab upload UIs remain intact — Settings provides defaults, not replacements
- Stored file metadata (name, upload date) persisted in a small JSON sidecar alongside each file
