# Decisions: iCloud API Key Sync

## 2026-09-01: fix the security review's three Lows before the ship

The Auditor passed the feature with notes: no Critical or High, three Lows and
one Informational. Following the 1.0.11 precedent (its Medium and Lows were
fixed and re-checked before the ship), the Guide routed the three Lows to The
Engineer as a targeted revision, then re-runs The Tester and The Auditor before
the deploy gate.

- Finding 1: the write chokepoint now applies the reader's time plausibility
  window on both sides, so a clock more than a day ahead cannot push a record
  every peer rejects.
- Finding 2: every carried peer slot passes the same chokepoint as an authored
  one; a slot with a non-ASCII or implausible time is omitted from the write
  rather than refusing the whole record.
- Finding 3: the shared record read returns an empty record for a non-regular
  file or non-UTF-8 bytes so it heals by overwrite, and Remove can clear a
  directory at a fixed record name. This is the 1.0.11 review's open Low
  (Finding 9), saved in the idea inbox as "iCloud sync hardening"; the key
  record inherits it and adds an indefinitely pending removal, so it is closed
  here rather than in its own Fix run. The idea is marked building and will be
  marked built at closeout.
- The Informational note (clock skew inside the one-day allowance, OQ-7) stays
  accepted, as for file sync.

## 2026-09-01: fix round outcome and two carry-forwards

- The fix round added one user-facing reason string, "The date and time on
  this device are too far off to sync this key.", shown inside the existing
  Could not sync row with Retry; the design spec's Content Notes now list it
  (a small factual update, no builder re-run).
- Carry-forward for the roadmap (Informational, out of this feature's scope):
  the file path's `pushLocal` passes `uploadedAt` unchecked, the file-record
  twin of Finding 1; the key path now refuses an implausible time at both
  write chokepoints and the file path should adopt the same predicate in a
  later touch.
- The user directed at the Auditor stage: "finish this run on autopilot and
  ship unless you have a question." The Guide treats that as the production
  sign-off for 1.0.12 on every available platform, with the App Store leg held
  under the standing replacement rule while the 1.0.4 submission remains
  WAITING_FOR_REVIEW (queried 2026-09-01 via the App Store Connect API).

## 2026-09-01: Auditor re-check outcome

PASSED WITH NOTES, nothing blocking. Findings 2 and 3 Resolved (Finding 3 also
closes 1.0.11 Finding 9). Finding 1 narrowed and left Open at Low: the fix
closes the stamped-time cases but cannot close a device whose clock is live
more than a day ahead, because that device stamps and checks with the same
clock; the lever is reader-side (a peer declining to push over a slot it
rejected as future-dated) and applies to both record families, so it goes to
the roadmap with the new Informational Finding 5 (the file path's `pushLocal`
passes `uploadedAt` unchecked). Finding 4 stays Accepted.
