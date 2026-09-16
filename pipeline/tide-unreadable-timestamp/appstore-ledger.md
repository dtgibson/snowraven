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

---

## Outcome — 1.0.32 SUBMITTED (2026-09-16)

The device install was done by the user, who confirmed the iOS build works.
That was the blocking precondition from the v1.0.31 launch-crash post-mortem
and it is the only step of this ship that could not be automated.

Submitted through the ASC API with the metadata key `QJA25M7XHM`, using the
flow the v1.0.4 correction records (`appStoreVersionSubmissions` no longer
allows CREATE):

| Step | Result |
|---|---|
| Version record created | `34a97cc3-c028-4894-907b-72cd7a988bab`, `releaseType: AFTER_APPROVAL` |
| Build attached | `1.0.32.1` (`f94ec2ed-...`), `VALID` |
| Release notes written | 1,022 chars, en-US |
| Age-rating declaration | Already complete on the new editable `appInfo` (`965e84da-...`) and matching every answer in `appstore/LISTING.md`. `socialMediaAgeRestricted` was `false` -- the field the 1.0.30 ship found unanswerable while the record was `READY_FOR_SALE` had already been recorded at `bb383d1` and carried forward. `developerAgeRatingInfoUrl` and `kidsAgeBand` null, expected on a non-Kids app. **No PATCH was needed.** |
| Review notes | Inherited, and verified against `appstore/REVIEW_NOTES.md` rather than assumed: 3,977 characters on both sides, whitespace-normalised match exact |
| Screenshots | 12 carried over (6 iPad Pro 12.9, 6 iPhone 6.7), all `COMPLETE`. **No recapture owed:** the photographed surfaces are Map Explorer, Statistics, Weather/tide, Calendar, Species Detail and Breeding Codes. Settings is not photographed, so the reorder is invisible to the listing; the sort-control change was attribute-only with byte-identical built CSS; and the weather and tide repairs change only the malformed-input paths, which synthetic demo data with valid timestamps never enters. |
| `POST /v1/reviewSubmissions` | `e18ac88d-8406-4b17-9325-68f09fc76d61` |
| `POST /v1/reviewSubmissionItems` | added |
| `PATCH submitted: true` | **`WAITING_FOR_REVIEW`**, submitted 2026-09-16T18:05:56Z |

Version record state confirmed by re-query: `1.0.32` / `WAITING_FOR_REVIEW` /
`AFTER_APPROVAL` / build `1.0.32.1 VALID`.

**So 1.0.32 has a version record of its own and needs no sentence in
CLAUDE.md's rollup/deferral/skip list.** It shipped to every platform:
macOS, Windows, web, TestFlight, and the App Store.

