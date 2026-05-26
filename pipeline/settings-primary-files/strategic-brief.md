# Strategic Brief — Settings-First File Model

## What We're Building

A unified data model where the files stored in Settings (eBird backup and ML export) are the single source of data for all tabs. Per-tab file uploads are removed from Breeding Codes, Media List, and Species Detail. Life List Comparison gains a "My List" shortcut that uses the stored eBird backup as List A. When required files or API keys are missing, each affected surface shows clear, actionable guidance pointing directly to Settings.

## Why Now

Settings was built to eliminate repeated uploads, but three tabs still show their own drop zones, creating a confusing split path: upload here, or go to Settings. Every new user hits this ambiguity. As the feature set grows, the inconsistency compounds — a user who configured Settings for Breeding Codes still has to upload manually for Species Detail. Closing this gap now makes the product coherent before more tabs accumulate the same problem.

## The User Problem

The user has to upload the same files in multiple tabs or discover Settings separately on their own. When a file isn't stored or an API key isn't configured, tabs either show a generic upload zone or fail silently — neither explains what's wrong or what to do. Life List Comparison forces a re-upload of a file the app already has.

## Success Criteria

- After uploading files to Settings once, every tab works automatically — no additional uploads anywhere
- When a file is missing from Settings, the tab explains exactly what to upload and where
- When a required API key isn't configured, the affected tab says so and points to Settings
- Life List Comparison users can compare their stored list against any new list in one step, with both lists clearly labelled
- The ML export filename warning (for userId parsing) is preserved and surfaced proactively

## Scope

- Remove drop zone UI from Breeding Codes, Media List, and Species Detail; these tabs become read-only consumers of Settings
- Each tab gets a "setup required" state shown when its stored file is missing — with instructions specific to that tab's file type
- ML filename format warning shown proactively when an ML file is stored but the filename can't be parsed for userId
- Life List Comparison: List A offers "My List" (uses stored eBird backup if available) or "Upload a file"; List B is always a fresh upload; lists labelled "My List" and "Other List" throughout
- Weather tab: proactively check API key status on mount and show a setup prompt if either key is missing, before the user attempts a lookup
- "Load different file" / "Load new file" buttons removed from tabs that no longer accept uploads

## Out of Scope

- Changing what files Settings stores (still eBird backup and ML export only)
- Changing the Settings tab's file management or API key UI
- Auto-detecting whether a missing file is intentional vs. accidental
- Any change to the Life List Comparison's comparison logic or output

## Key Decisions

- Tabs that had drop zones become Settings consumers only — they never accept direct uploads
- Life List Comparison is the deliberate exception: comparing lists is inherently about two files, one of which is often someone else's
- List A defaults to the stored eBird backup if available; List B is always a fresh upload
- Guidance messages name the specific Settings section: "Go to Settings → Default Files → eBird Backup"
- API key guidance is proactive (checked on mount), not reactive (triggered by a failed lookup)
