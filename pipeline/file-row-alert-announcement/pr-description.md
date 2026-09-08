## File Row Alert Announcement

### What this does
Settings now mounts an empty alert region for each upload row before an error occurs, then inserts the refusal message into that stable region. Repeating the same refusal replaces a sequence-keyed child so assistive technology receives a fresh DOM mutation each time.

### How to test
1. Run `npm test -- --run src/components/Settings.test.tsx src/components/Settings.upload.test.tsx` from `frontend`.
2. Open Settings and inspect either Default Files row before uploading; its alert region should exist with no text or visible footprint.
3. Choose a non-CSV file twice; the same refusal should remain visible, the region node should stay stable, and its message child should be replaced on each attempt.

### Notes for reviewer
The upload guards, refusal copy, storage behavior, and visible error styling are unchanged. The three broad alert assertions in `Settings.test.tsx` now distinguish empty persistent regions from populated errors, while `Settings.upload.test.tsx` directly guards region identity and repeat-message mutation for both rows.
