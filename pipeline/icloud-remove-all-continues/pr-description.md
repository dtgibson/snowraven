## icloud-remove-all-continues

### What this does

Remove synced files from iCloud no longer gives up at the first file iCloud will not delete. Before this fix, every delete in the native removal ended in `?`. So one stuck eBird backup left the Macaulay Library export, every bar-chart file, every day-by-day snapshot and every staging copy in iCloud. One stuck county left every county after it alphabetically, and everything after that too. Now one press tries every item once, in the same order as before, and removes everything it can. If anything stays, the command still reports the failure, so Settings shows its existing line "Some synced files may still be in iCloud. Try again." Copy iCloud details now lists each item that stayed, by the names this app writes.

### How to test

This can only be seen on a signed-in Apple device holding a file iCloud refuses to delete, which no agent may touch. The Rust tests are the practical check:

1. `cd src-tauri && cargo test --lib -- icloud` (64 pass: the 56 existing rows unedited, plus 8 new ones).
2. `cargo test --lib -- icloud::tests::remove` (11 pass: the 4 existing remove rows unedited, plus 7 new ones whose names start with `remove`).
3. `cd frontend && npm run typecheck`, then `npx vitest run src/lib/icloud src/lib/icloudPaths.parity.test.ts src/lib/icloudBarChartPublishedClaims.test.ts`.

The new rows, all in `src-tauri/src/icloud.rs`'s test module:

- **Row C, `remove_all_takes_everything_when_nothing_is_stuck`** (the control): everything goes, with each target deleted exactly once in today's order, `Ok(RemoveResult { removed: 19 })`.
- **Row A, `remove_all_with_a_stuck_ebird_backup_still_takes_everything_else`**: the eBird csv is refused. Its record is kept with it and never tried. Every other data file, county, twin, duplicate folder, day-obs snapshot and staging entry is gone, each attempted exactly once. The result is `Err("unavailable")` with `removed` = 17.
- **Row B, `remove_all_with_a_stuck_county_takes_everything_after_it_and_leaves_no_half_pair`**: US-CA-001's record (2nd of 4 sorted counties) is refused. Its file is never tried and both halves are still there. US-NY-005, US-WY-001, the twin, the duplicate folder, day-obs and staging all go. `Err("unavailable")`, `removed` = 17.
- **`remove_all_names_in_copy_icloud_details_only_what_stayed`**: the operation log gets `remove barcharts/US-CA-001.record.json: unavailable` and `remove barcharts/US-CA-001.txt: not tried (kept with its record)`, and nothing at all when everything went.
- **`remove_all_counts_a_staging_entry_it_could_not_remove`**: a staging entry made undeletable with `chmod 0555`. Everything else goes and the result is `Err`, not `Ok`. The log says `1 staging entry could not be removed`.
- **`a_remove_pass_returns_its_first_failure_and_bounds_what_it_names`**: the first failure is the one returned. At most 8 items are named, and the rest are counted in one entry.
- **`remove_all_over_foundation_takes_everything_past_a_placeholder_it_cannot_delete`**: the real-Foundation row from the brief. A planted `barcharts/.US-AK-001.txt.icloud` that Foundation cannot delete in a temporary directory stays, named. Everything else goes and the key record stays.
- **`remove_items_takes_every_county_after_one_it_cannot_take`**: the same through `remove_items_in` (the `icloud_remove_items` path), over Foundation.

Every row compares the delete log against the full target list in order, and checks that what is still on disk is exactly what the pass names.

### Notes for reviewer

**Red-first.** `git stash` is off limits here, so HEAD's `icloud.rs` was copied to the scratchpad and swapped in place, then swapped back (sha256 verified, `68c689d8...` final).
- **Against HEAD's real code:** the one new row that compiles there (`remove_items_takes_every_county_after_one_it_cannot_take`) is **red: 1 of 1** ("barcharts/US-WY-001.txt left behind").
- **The other seven rows use the new `remove_all_with` API, so they were run against a mutant with HEAD's behavior put back** (stop at the first failure, drop staging failures). **7 of 8 new rows go red.** The 8th is Row C, the all-clear control, which is green by design. All 56 existing icloud rows stay green under that mutant, so none of them pinned continuation, which is the gap the brief named.
- Six more mutants each go red on their own guard:
  - staging failures dropped: 1 row
  - pair stop removed: 3 rows
  - Copy iCloud details names nothing: 3 rows
  - last failure wins instead of first: 1 row
  - the left list unbounded: 1 row
  - county deletes bypassing `io`: 5 rows

**Shape.** The command body moved into `remove_all_with<I: ContainerIo>(io, docs) -> RemovePass`, following the `push_items_cleared_at` / `_with` precedent. `remove_items_in_with` keeps its signature and now runs `remove_kind_with` into a `RemovePass`, so `icloud_remove_items` (the shared day-answer teardown) gains the same continuation with its command body unchanged. Every per-item delete now goes through `io.delete`, and duplicate folders through a new `io.delete_dir`. That is a trait method whose default is the production `coordinated_delete_dir`, so the existing test doubles (`Stuck`, `ClaimsGone`, `FlipOnRead`, `NotingIo`) needed no edit. In production both still resolve to the same coordinated deletes as before. `remove_item_at` and `icloud_remove_keys` are unchanged. The result shape is unchanged, and so is every TS type.

**First failure wins.** When several items fail, the command returns the first failure the pass met (`RemovePass::failure`, `get_or_insert`). Every delete reports the closed union's `unavailable` today, so this changes no word the user reads. The rule is stated in the source and pinned by a test so a second reason added later cannot reorder silently. No retries.

**Pair stop kept.** Within one item, today's order and its stop are unchanged: record then file for counties and day snapshots, csv then record for the two data files. A failure on the first half means the second half is never tried, so no new half-pair is made. The untried half is named in Copy iCloud details as `not tried (kept with its record)` or `(kept with its file)`, and only when something is actually there.

**Copy iCloud details.** What stayed goes into the existing operation log, which the report already prints generically under "Native bar-chart operations". There is one `remove <name>: <result> (<codes>)` entry per item, before the existing `remove all synced files` summary. Names are only fixed names, names rebuilt from a validated county code or device id, a validated twin shape, a duplicate-folder shape, or `.tmp` with a count. A raw directory entry is never named. The list is bounded at `DIAG_LEFT_MAX` (8, below the log's 20) under admission control, and the rest are counted in one entry. Day-obs names (which contain a device id) are named here too. The report already carries device ids, and the push and listing paths still log the bar-chart kind only. No TS change: the report renders ops without knowing their contents, and `icloud_diagnostics` has no runtime validator for op targets beyond its existing bounds.

**Staging sweeps (kept).** The three sweeps now share one loop, `sweep_staging`, which counts what it could not remove. `clear_staging_kind` and the remove-all sweep act on that count, so a pass that leaves a staging copy fails rather than reporting success. `clear_staging` and `clear_staging_for` keep their `u32` signatures for the callers the brief leaves unchanged (`remove_item_at`, `icloud_remove_keys`, the pre-write cleanup), and those still discard the failure count. A staging entry that a kind's sweep cannot take is tried again by the final all-of-`.tmp` sweep, as on HEAD. It is counted once, because the last sweep's count replaces the earlier one.

**Two TS guards edited (a deviation from the brief, which expected no TS test to change).** `icloudPaths.parity.test.ts` ("the seven item commands...") and `icloudBarChartPublishedClaims.test.ts` (item 39, "the native Remove clears both kinds") each asserted the literal string `remove_items_in(&docs, ItemKind::Barchart)?` inside `icloud_remove_all`. That is the exact early return this fix removes. Each now asserts the same intent against the new shape: the command calls `remove_all_with(&Foundation, &docs)`, and that function runs `remove_kind_with` for both kinds. Rust `//` comments are stripped first, so a mention cannot satisfy them. `remove_all_with` was placed between the command and the key-record section header, so the existing FR-35 checks (`not.toContain('KEYS_RECORD_NAME')` over that span) now cover its body too. Both guards were mutation-checked:
- green with the code as it stands
- red with the day-obs kind dropped
- red with the day-obs kind commented out
- red with the command no longer calling `remove_all_with`
- red with a key-record mention added
- parity guard red with `remove_all_with` moved out of the FR-35 span

A third guard ("every native error string is a member of the closed frontend union") scans every `Err("...")` literal in the file, tests included. The new first-failure row therefore uses `unknown`, `unavailable` and `mismatch` rather than made-up strings.

**Deliberately unchanged (flagged by the Evaluator).**
- The data-file loop still deletes the csv before its record. If the csv goes and the record does not, a record without its csv is left, as on HEAD.
- The final `.tmp` sweep still takes everything there, including a key-record staging leftover (`<deviceId>-keys.record.json`), as on HEAD. With failures now counted, a key staging entry that cannot be removed also makes Remove synced files report its failure.

**Bundle.** `icloudCopy.ts` changed only in a comment (the "stops at the first item" sentence corrected), and the two test files changed only in test code. Per testing.md's Tailwind source-scan rule this was measured, not assumed. A build with the three files swapped back to HEAD content, and two builds with these edits, produced byte-identical `dist/assets/*.css` and entry `index-*.js` (determinism control included).

**Not covered.** The 8 s timeout path. After the budget the background work now runs the whole list and names what it left once it finishes. That is the same `blocking` mechanism as before and was not exercised by a test.
