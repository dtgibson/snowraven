# Bug Brief — ML Lookup Timeouts

## What is broken
The Media Life List lookup frequently slows to a crawl mid-batch or fails entirely
with "Couldn't reach the Macaulay Library." The symptom is fast early batches then
progressive slowdown. The root cause: for each 25-ID batch the backend fires 75
concurrent HEAD requests to the Cornell CDN (25 IDs × 3 URLs each, all gathered
simultaneously). The CDN rate-limits after the initial burst, causing the subsequent
requests to time out or receive throttled responses that trip the `httpx.HTTPError`
handler and return 503.

## Steps to reproduce
1. Load a large eBird CSV (300+ species with catalog IDs) into the Media Life List tab
2. Watch the batch progress bar — first 1–3 batches complete quickly
3. Observe subsequent batches slow down dramatically or stall
4. "Couldn't reach the Macaulay Library" banner appears

## Expected behavior
All batches complete at consistent speed. The error banner does not appear for users
with a working internet connection who can reach the Macaulay Library in a browser.

## Blast radius
Isolated to `backend/routers/ml.py`. No frontend, schema, or other backend changes needed.

## What done looks like
- A 300+ species CSV processes all batches without the error banner
- Batch progress moves at a consistent pace throughout
- No "Couldn't reach the Macaulay Library" error for users with working connectivity
