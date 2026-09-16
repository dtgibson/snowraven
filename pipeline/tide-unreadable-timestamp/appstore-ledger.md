# App Store version-record reconciliation — 1.0.32 ship (2026-09-16)

Queried live at the ship, per CLAUDE.md: a version that ends with a VALID
TestFlight build and no version record of its own is a SKIP unless a written
sentence says otherwise, because the query cannot distinguish a deliberate
rollup from a silent omission.

## Version records present (newest first)

1.0.31, 1.0.30, 1.0.28, 1.0.27, 1.0.24, 1.0.23, 1.0.21, 1.0.19, 1.0.17,
1.0.14, 1.0.13, 1.0.4 — all `READY_FOR_SALE`.

## Versions with a VALID build and no record, each accounted for IN WRITING

| Version | Build | Disposition | Where recorded |
|---|---|---|---|
| 1.0.29 | 1.0.29.1 VALID | **Rollup** into 1.0.30 — record `930ed55a` withdrawn while WAITING_FOR_REVIEW, retargeted, repointed at build 1.0.30.1, resubmitted as `c2b858fc` (2026-09-13) | CLAUDE.md |
| 1.0.26 | 1.0.26.1 VALID | **Rollup** into 1.0.27 | CLAUDE.md, DECISIONS.md at v1.0.27 |
| 1.0.25 | 1.0.25.1 VALID | **Deferred**, not rolled up — 1.0.24 was IN_REVIEW on `6900bf93` and the user chose to leave that review undisturbed; resolved at 1.0.26, whose review notes carry the 1.0.25 fixes | CLAUDE.md |
| 1.0.22 | 1.0.22.1 VALID | **Rollup** into 1.0.23 — record `bd0af66a` withdrawn, retargeted, repointed at build 1.0.23.1, resubmitted as `ac7619d0` (2026-09-07) | CLAUDE.md |
| 1.0.20 | 1.0.20.1 | **Rollup** into 1.0.21 (2026-09-06) | CLAUDE.md |

**No unaccounted gap.** The three genuine historical skips (1.0.15, 1.0.16,
1.0.18) are older than this window and already recorded. Nothing new to add to
the CLAUDE.md list from this ship.

## Route decision for 1.0.32

**1.0.31 is `READY_FOR_SALE`**, so its train is closed to every new build,
TestFlight included (altool 90186 + 90062). There is therefore no TestFlight-only
path against it, and the full version bump this ship already carries is the only
available route — which is what we are doing. Checked BEFORE building the
archive, per the skill.

**1.0.32 owes its own version record and submission**, and per the v1.0.31
post-mortem the uploaded build is installed on a real device and opened BEFORE
anything is submitted.
