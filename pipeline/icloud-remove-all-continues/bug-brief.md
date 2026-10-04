# Bug Brief: iCloud remove-all stops at the first stuck file

## What is broken
Remove synced files from iCloud ends the whole pass at the first item it cannot delete, because every delete in `icloud_remove_all` (`src-tauri/src/icloud.rs:1774`) is followed by `?`. The pass order is: eBird csv and record (:1779, :1782), ML csv and record, then the bar-chart kind (:1789), the day-snapshot kind (:1790), then the `.tmp` staging sweep (:1795).
Inside each kind, `remove_items_in_with` (:3010) does the same for the kind's folder placeholder (:3016) or planted file (:3018), each item's record and file in sorted id order (:3038, :3041), each set-aside twin (:3047), each duplicate folder (:3069) and duplicate placeholder (:3074).
So a stuck eBird backup leaves the ML export, every bar-chart file, every day snapshot and every staging copy in iCloud. A stuck county leaves every county after it alphabetically, plus the twins, the duplicates, the day snapshots and the staging copies.
Confirmed from the code. The four existing remove tests pass on HEAD (`cargo test --lib -- icloud::tests::remove`, 4 passed) and pin only that a failure returns `Err`, never what is left behind.

## Steps to reproduce
1. In a temp folder standing in for the container, plant `barcharts/.US-AK-001.txt.icloud`. Outside a real container, Foundation cannot delete a placeholder through its logical URL, which is the mechanism `remove_that_cannot_take_a_placeholder_directory_reports_unavailable` already relies on. Also plant `barcharts/US-WY-001.txt` with its record, a `barcharts 2/` folder, a bar-chart staging entry under `.tmp/`, and `day-obs/<device>.json` with its record.
2. Run `remove_items_in(&docs, ItemKind::Barchart)`. This is the only way in today, because `icloud_remove_all` resolves the real container itself. It returns `Err("unavailable")` at US-AK-001, and US-WY-001, `barcharts 2` and the staging entry remain. Through the `?` at :1789, the day snapshot and `.tmp` are never reached.
3. For the hermetic regression test, use a wrapper double over `FakeIo` (the `Stuck` / `ClaimsGone` shape) whose `delete` refuses one named item. Drive it through a docs-parameterized `remove_all_with<I: ContainerIo>(io, docs)`.

## Expected behavior
One press tries every item once, in today's order, and removes everything it can. Within one item, today's order and its stop stay as they are: record then file for counties and day snapshots, csv then record for the two data files. So a failure never leaves a new half-pair, and the pass moves on to the next item, kind and sweep.
If anything stayed, the command still returns the failure, never success: `unavailable`, or `timeout` past the 8 s budget, after which the background work now runs the whole list. Settings keeps its line "Some synced files may still be in iCloud. Try again."
What it could not do is named where it can be read: Copy iCloud details lists each item left, by names this app writes (validated county codes, device ids, the fixed file and folder names). The three staging sweeps count their failures instead of dropping them. The only consumer shows one sentence that is true for any partial pass, so no new result field is needed.
No retries, no new copy, and the key record is still never touched (FR-35). This does not contradict DECISIONS.md v1.0.40: twins, duplicates and placeholder folders are still taken, one coordinated delete each.

## Blast radius
Rust: the command's body moves into `remove_all_with`, following the `push_items_cleared_at` / `_with` precedent. Its per-item deletes, and the ones in `remove_items_in_with`, go through `io.delete`. Today only the placeholder-folder delete does, and in production `io.delete` is `coordinated_delete`. `icloud_remove_items` (the shared day-answer teardown after clearing the backup) gains the same continuation. `remove_item_at` and `icloud_remove_keys` are unchanged.
The result shape is unchanged (`RemoveResult { removed }` or `Err`). Nothing changes in the TS twin (`removeAll(): Promise<{ removed: number }>`, which has no runtime validator), in `removeFromICloud` (it rejects and leaves the shared set and preference as they were, and the next check rebuilds them), in Settings' failure line and announcer, or in any TS test. No pending marker for files exists in `settings.json`. The one there is the key removal's, and it is untouched.
Copy: no in-app or Help text changes, and `docs/HELP.md:759` stays true. One source comment goes stale and is corrected (`lib/icloud/icloudCopy.ts:165-175`, "stops at the first item"). `PRIVACY_POLICY.md:73` and `website/privacy.html:177` say Remove deletes the copies, which this makes truer. README, website and the App Store listing do not describe it. No published sentence changes, so there is no HELD proposal.

## What done looks like
A new Rust test, red on HEAD: the double refuses one item mid-pass (the eBird csv, then a county in the middle of the sorted list). Every other data file, county, twin, duplicate folder, day snapshot and staging entry is gone, each attempted exactly once, and the result is `Err("unavailable")`. A real-Foundation row with a planted per-item placeholder shows the same.
The four existing remove tests and every TS suite stay green unedited. For the user, one press clears everything it can, and the same failure line shows only when something truly stayed.
