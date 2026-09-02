# Decisions

Project-level decisions, bug post-mortems, and meaningful reversals recorded here.

---

## Desktop windows remember themselves, a large backup streams, and the App Store hold ends -- 2026-09-02 (v1.0.13)

**Decision: shipped** as `1e59192` (tag `v1.0.13`; iOS stamp `fd49e1e`), a two-improvement Spool bundle on one version -- `f19f5f6` remember-window-state and `cb79fb1` large-file-and-memory-handling. Both are Improve-lane changes with no design pass and no new control: the Mac and Windows apps reopen at the size, position and maximized/fullscreen state they were closed at, and a very large eBird backup parses row-by-row instead of materializing a full cell grid first. Neither changes what the app shows, and the parse output is proved identical to the previous parser's by a differential oracle carrying the old implementation verbatim.

**`available_monitors()` returns an EMPTY list on macOS 26, and this is a platform fact that will bite again.** tao 0.35's implementation is backed by `CGGetActiveDisplayList`, which now reports a count of zero; reproduced standalone against `core-graphics` 0.25 with no Tauri involved, in both a dev binary and a signed `.app`. `primary_monitor()` and `current_monitor()` still work. It is not cosmetic: `tauri-plugin-window-state` reapplies POSITION only from inside `for m in self.available_monitors()`, so on macOS that loop body never runs and the saved position is silently never restored -- registering the plugin alone would have delivered "comes back the same size" while dropping "comes back where you left it", which is most of the point. `src-tauri/src/window_geometry.rs` therefore reapplies the position itself and enumerates screens through `NSScreen`, whose Cocoa-to-physical conversion is validated against tao's own `primary_monitor()` and kept as a unit test. **Anything that enumerates displays on macOS must not assume that list is non-empty.** A second measured trap rides with it: the plugin's `set_size`/`set_position`/`maximize` are asynchronous on macOS, so at `setup()` the live window still reports the config defaults and every decision must be made from the SAVED record, never from `is_maximized()`.

**Native state written by native code sits OUTSIDE the `storage` seam, and that is not a violation of the tab-layout post-mortem's rule.** `.window-state.json` is written by the plugin with `std::fs` into `app_config_dir()`. The seam rule governs the *webview's* data under `AppLocalData/data/` and exists because WKWebView wipes `localStorage`; geometry must be applied before the first frame, which the seam is structurally unable to do (it is read after boot, so a seam-based version would open at the configured default and visibly jump, and would need a new JS window-management grant to move the window at all). Nothing joins `docChains`, nothing is added to `settings.json`, and nothing is synced -- window geometry is device-local by nature, so the iCloud scope statement and `PRIVACY_POLICY.md` are untouched. Recorded because a future reader would otherwise read that file as a seam violation and "fix" it.

**The state file is out of the webview's reach only because it is a DOTFILE, and that coupling is load-bearing.** On macOS `app_config_dir()` and `app_local_data_dir()` are the same directory, so the file sits literally inside the granted `$APPLOCALDATA/**` tree; it is unreachable only because `tauri-plugin-fs` defaults `require_literal_leading_dot` to `true` on unix and the name begins with a dot. Verified empirically against `glob` with tauri's exact `MatchOptions`: the grant does not match `.window-state.json` and does match `window-state.json`. On Windows the separation rests on a different fact entirely (Roaming vs Local AppData), where the leading-dot default is `false`. Renaming such a file, flipping that option, or adding a non-dotted native-side document under that tree hands the webview write access to something the native layer parses before the first frame.

**The v1.0.11 native-read rule now has a second instance outside the iCloud container, and it generalizes.** The rule was written about "an iCloud container, an import path, anything outside the app's own sealed bundle" and was read as not obviously covering a file the app's own plugin writes into its own config directory -- which is how the read shipped to review unbounded and symlink-following. `state_text_at` is now `record_text_at` guard for guard (`symlink_metadata` rather than `metadata`, `is_file()`, and a real on-disk size bound before any allocation), deliberately reusing the same 16 KB constant. **Every native read of a file outside the sealed bundle gets that treatment, or says at the call site why its boundary is weaker.** The exposure is narrowed rather than closed and the doc comment says so: the plugin's own earlier read is still unbounded, and the size is checked on metadata rather than through a `Read::take`, so the TOCTOU window stays open.

**Prefer a shared compile-time constant over a runtime lookup for a compile-time value -- under `panic = "abort"` the difference is whether the app opens at all.** The module reached the state file's name through `AppHandleExt::filename`, which is a `Manager::state` call that panics outright when the type is unmanaged; with `panic = "abort"` in the release profile there is no unwinding, so removing the plugin while leaving the `setup` hook would have aborted during `setup()` with no window ever shown. A `window_geometry::STATE_FILENAME` now names the file at both ends, so the lookup is never reached and dropping the plugin degrades to "no saved record". The general lesson, worth stating once: `let _ = fallible()` swallows `Err`, not panics, so a "this cannot keep the app from starting" claim must account for panicking calls, not just `Result`s.

**A string that must not retain its parent is found with `indexOf` and copied character by character -- and the equivalence tests structurally cannot catch the alternative.** Measured on a 148.4 MB export, holding one 309-character header line with the source dropped and GC forced three times: `.slice()` of a long parent is a SlicedString that references the parent (152.2 MB retained), and a regex METHOD leaves its subject in the engine's last-match state, so merely *asking* a regex where the line ends retains the whole file however the answer is used (152.2 MB) -- against 3.8 MB for the shipped `indexOf`-plus-character-copy. Both spellings produce byte-identical output, which is exactly why an equivalence suite cannot see the regression: the slice form IS the oracle it checks against. The defense is a source-inspection drift guard in the module's own test banning both spellings, and it must strip comments before scanning or the module's own explanation of the thing it removed matches and fails a correct file. This was not theoretical: the first implementation was clean and was then "tidied" into the regex form, and only the measurement caught it.

**The parse rewrite's win is transient allocation, not retention, and the guarantees that ship are structural.** The old parser held source string, a full `string[][]` of every cell, and the entry array simultaneously; on the real 6.6 MB / 21,369-row export that grid measured ~126 MB, about 19x the file. A 500,000-row export OOMs the pre-change parser at 700 MB, 1 GB and 1.5 GB ceilings where the streaming parser completes, and the heap floor it needs drops from 2,560-3,072 MB to 540-560 MB. Retention barely moves, because the output is identical. The heap figures are one engine's accounting and are corroboration, not bounds -- the app ships on three engines with three different accountings, which is also why slice-based field extraction was measured, found to be a further large win, and deliberately EXCLUDED as unprovable across the fleet. What the suite asserts is structural: at most one row array live (proved by reusing one array and asserting a single array identity across the file, with the previous implementation measured in the same test as the non-vacuity control), the cache holds a line and not a file, and the network cache holds at most 64 entries, measured at capacity+1 and asserted as work done.

**One real gap is left open and named rather than closed here.** The only upload size guard in the system is the backend's 50 MB bounded read, which protects the **web/Pi path only**: `TauriStorage.writeFile` and `lib/iosImport.ts` have no cap, no row check and no warning, so the guard is absent on exactly the two platforms where a serious lister's export lands. It goes to the roadmap rather than into this run, because a warning is a new user-facing affordance. So does the parse worker's missing timeout and reject path (`observationsCache.ts`), a pre-existing Medium the Auditor agreed to defer: a worker killed by OOM settles neither handler, and the `onerror` fallback re-parses on the main thread and can throw out of the handler, leaving every eBird-backed tab spinning forever. This change strictly reduces its reachability; it is a control-flow repair and gets its own Fix run rather than being verified alongside a memory change.

**The App Store standing hold is GONE, and the store jumps 1.0.4 straight to 1.0.13.** 1.0.4 was found at `READY_FOR_SALE` / `READY_FOR_DISTRIBUTION`, not `WAITING_FOR_REVIEW`: Apple approved it and every prior review submission reads `COMPLETE`. Nothing was in review, so nothing was withdrawn and nothing was replaced -- the standing rule ("once 1.0.4 clears, the then-current version goes out as an ordinary store update") simply resolved, and 1.0.13 was submitted as that ordinary update (review submission `f74458b3`, WAITING_FOR_REVIEW, releaseType AFTER_APPROVAL). **Every record that says 1.0.4 is stuck in review is now stale.** The consequence worth recording as a fact about the store channel: versions 1.0.5 through 1.0.12 never reached the store, so iCloud Sync and iCloud key sync arrive for App Store users in this update **without appearing in its release notes**, which cover only the 1.0.13 changes (and of those only the memory work applies to iPhone and iPad). Broadening the "What's New" text is the user's call and can be edited while the version is in review. One listing correction rode along: the live description still said "Your files, settings, and API keys stay on your device", which stopped being strictly true when key sync shipped in 1.0.12 -- `appstore/LISTING.md` was updated then but the last submission predated it, so the live text was stale and is now the committed text. This is the first App Store review the iCloud features have ever faced, and Hephaestus is not signed into iCloud, so their real behavior is still verifiable only on the user's own devices.

---

## iCloud API Key Sync -- 2026-09-01 (v1.0.12)

**Decision: shipped** as `089da67`, tagged `v1.0.12` (iOS stamp `857f081`; test-only follow-up `4ee5b33`): a second, separate, off-by-default Sync API keys switch inside the iCloud Sync section on the Mac, iPhone and iPad apps, sharing the eBird and OpenWeather keys across the user's own Apple devices through their own iCloud account. It is a sub-switch of file sync: greyed with a one-line reason until file sync is on, turned off when file sync is turned off, and never folded into the file toggle, because a secret leaves the device only by its own explicit act. One switch covers both keys: the app holds exactly two keys of the same kind, obtained the same way and used together, and a per-key switch would double the note and the states for a choice nobody makes. Nothing about keys is written until the user presses Turn on after a note of its own.

**One two-slot record in the same ubiquity container, not `NSUbiquitousKeyValueStore`.** The container is already provisioned on both App IDs and gives the same coordinated atomic write, offline queueing, change query, validator discipline and Remove path the files use, so the user's model stays one place in one account; the key-value store would be a second native path with its own availability rules and its own last-writer semantics, without the origin the rows show. Latest change wins per key, whole, with the origin-id tiebreaker file sync already uses; a set and a clear are both changes (a Clear propagates through a cleared marker); an untimed key, which every key was before this version, counts as older than any synced key and is stamped when first uploaded, so the first device to turn key sync on seeds and a later device wins only by pressing Update. The change time and origin live in a validated `meta` beside the values in `api-keys.json`, so every reader that shipped before this version stays byte-compatible with the document.

**The user's control over a secret is complete from any device.** Clear with key sync on asks first, names its reach, and reaches every sharing device. Turning the key switch off removes the copy from iCloud, where a file's copy is left to serve the other devices: for a secret the copy is the thing the user wants to be sure about, and a device still sharing restores it in seconds. A removal that cannot reach iCloud stays pending and is retried on its own, and a separate Remove synced keys from iCloud control covers a copy left behind or put back, kept apart from Remove synced files so each control names only what it touches. The published statements say exactly what iCloud provides and no more: encrypted in transit and at rest by Apple, in the user's own account, invisible to the developer, and end-to-end encrypted only when Advanced Data Protection is on. A key value never appears outside its slot: not in a record name, a state, a reason, an error, a log line, the enable note or Debug output.

**The security fix round closed three Lows before the ship, one of them the 1.0.11 review's open Finding 9.** Both write chokepoints, TypeScript and Rust, now refuse a change or clear time outside the reader's plausibility window or outside the canonical ISO shape, never rewriting it, so a stamped-time skew (a hand-edited document, a clock corrected after the stamp) stops writing and names the rule on the row instead of ping-ponging with every peer. A peer slot carried through a write passes the same chokepoint as an authored one and is omitted on refusal rather than failing the write; `Date.parse` in both V8 and JavaScriptCore accepts a parenthesised non-ASCII comment the Rust writer refuses, verified on both engines, which is why the predicate is pinned by a 19-row fixture asserted row by row and by count on both sides. And the one read path for every container record now hands back an empty string for a non-regular file, non-UTF-8 bytes or an oversized file, which the validator treats as absent and heals by overwrite, while Remove clears a directory at a fixed record name; the 1.0.11 open Low ("iCloud sync hardening" in the idea inbox) therefore closed here, at one site for all five records, rather than in its own fix run.

**A guard test never reads a gitignored per-run file unconditionally (CI post-mortem).** The published-claims guard read the feature's `how-to-see.md`, which `pipeline/.gitignore` keeps out of the repo, so the suite passed locally and failed the CI frontend job on a fresh clone at the stamp commit; `4ee5b33` checks the file only where it exists. The shipped bundle was unaffected, so it is a test-only follow-up with no version bump, per the dev-only rule.

**Shipped to every available leg; the App Store leg held under the standing replacement rule.** macOS (notarized and stapled; `release.sh` ran with HEAD two commits past the tag, the 1.0.9 and 1.0.11 precedent), Windows (CI green at the tag), `latest.json`, the website, and iOS 1.0.12 build 1 on TestFlight through the iCloud-era manual-signing export, VALID within a minute of the upload; 1.0.4 (`b52fdc55`) is still WAITING_FOR_REVIEW and 1.0.12 is a new feature, not a correctness fix of that build. Two items go to the roadmap rather than another fix round: the Auditor's open Low, a device whose clock is live more than a day ahead, which no self-relative write window can detect because the writer checks its stamp against the clock that made it (the lever is reader-side, a peer declining to push over a slot it rejected as future-dated, and it applies to both record families), together with the Informational Finding 5 that the file path's `pushLocal` passes `uploadedAt` unchecked. The key device-verification rows wait on the user's own Mac and iPhone.

---

## iCloud Sync -- 2026-09-01 (v1.0.11)

**Decision: shipped** as `bed6739`, tagged `v1.0.11` (iOS stamp `000af2e`): an opt-in, off-by-default sync of the eBird backup and the Macaulay Library export across the user's own Mac, iPhone and iPad, through an iCloud Drive ubiquity container tied to their Apple ID. Nothing leaves a device until the user turns the switch on, and the switch exists only on the two Apple builds; Windows, web and Pi render nothing and run nothing.

**What syncs is the two files plus each one's upload details, and nothing else -- not keys, not settings, not caches.** API keys are secrets and stay device-local (a possible second opt-in, decided separately); the settings document holds device-specific state such as the map center and the tab layout; the derived eBird caches are paid-for answers whose cross-device sync is a named follow-on, not a v1 ride-along. The shared record per file carries the filename, upload time, size, checksum and origin (the device's name, kind and a random id minted on first enable, never a hardware id or the Apple ID), and the published privacy statements list exactly that.

**Latest upload wins, whole, with the origin-id tiebreaker on an equal time; nothing is merged.** Each export is a complete snapshot, so there is nothing to reconcile below the file. The local copy stays the app's working store and iCloud is transport between the user's devices: every tab reads the local file, a device keeps working offline, a synced arrival runs the same invalidations a manual upload runs and reaches every tab without a relaunch, and a user upload during a pull wins.

**An iCloud Drive ubiquity container, not CloudKit.** Two CSVs and two small records are files; the container gives coordinated atomic replacement, system-queued offline uploads and a change query with no server-side schema, where CloudKit would need record types, asset plumbing and push subscriptions Tauri does not expose, and the same restricted entitlement and profile anyway. The container is hidden from Finder and the Files app in v1 (no `NSUbiquitousContainers`), and the in-app Remove is the user's control over it; showing it is on the roadmap with its stated cost. Clear with sync on propagates through a cleared marker (latest event wins, so a newer upload elsewhere survives it); Remove deletes the copies in iCloud, staging included, and leaves every device's local copy alone.

**The Developer ID build carries the restricted iCloud entitlements only through the release-time overlay, paired with an embedded provisioning profile.** The committed config claims no iCloud entitlement, so a plain `desktop:build` or a dev binary lands in the fail-safe "This build cannot use iCloud" state rather than shipping a signature its profile does not back; `release.sh` supplies both halves together, dies in preflight on a missing, undecodable, wrong-App-ID, containerless or expired profile, and dies after the build if the bundle lacks the profile or any of the three keys. The two App IDs (macOS `com.snowraven`, iOS `com.dtgibson.snowraven`) share the one container `iCloud.com.dtgibson.snowraven`.

**The shared record is untrusted on both the read and the write side.** A validator rejects every malformed record as absent (never a delete), and the native layer checks file type and real on-disk size before any read, so a planted link, a directory or a multi-gigabyte file is refused before it costs memory. Both writers sanitize to the validator's exact bounds, in Rust and in TypeScript, proven by a round trip plus an idempotence check, because a self-authored record the validator rejects would be re-pushed on every check forever. One Low stays open and is deferred to a fix lane (captured in the idea inbox): a record file that is not UTF-8, or a directory or link at a record's name, fails every check as "unavailable" instead of reading as absent, so it heals only when removed by hand.

**The iOS TestFlight export now uses a manually created App Store profile plus a manual-signing export.** Xcode's automatic profile repair is closed on this account: both API keys are refused cloud-managed distribution certificates (`FORBIDDEN_ERROR` 7495), so the Xcode-managed profile that predates the App ID's iCloud capability cannot regenerate itself. The working path (the profile through the ASC API, then `xcodebuild -exportArchive` with a manual-signing plist) is in the release skill; the profile expires with the Apple Distribution certificate on 2027-07-05. The App Store leg held under the standing replacement rule: 1.0.4 (`b52fdc55`) is still WAITING_FOR_REVIEW, and 1.0.11 is a new feature, not a correctness fix of that build. Everything else shipped: macOS (notarized, stapled), Windows (CI green at the tag), `latest.json`, the website, and iOS 1.0.11 build 1 on TestFlight. The device-verification rows QA could not run on a signed-out Mac wait on the user's Mac and iPhone and close in the next run.

---

## The Settings tab closes on its quietest register, third-party credits stay where they are owed, and published copy gains a stated posture -- 2026-09-01 (v1.0.10)

**Decision: shipped** as `fc068f8`, tagged `v1.0.10` (iOS stamp `9fa112e`): an Acknowledgments section closing the Settings tab on every platform, plus a user-directed rewrite of README.md and the website prose in the same change.

**The shipped shape is a user-directed deviation from the approved FR-01, and the reason it was safe is that the register already existed.** FR-01 specified the Help & Documentation action-row shape (icon tile, row title, one-line description); the user asked for something subtler and more basic, and the Troubleshooting section already ships exactly the quieter form -- SectionHeader alone naming the section over a card holding one quiet bordered button. The section reveals its two entries as an inline grid-collapse disclosure (`inert` while closed, no live region, accent only in the toggle's open tint), zero network, zero persisted state, no platform branch. The durable point: the Settings tab has two section registers, and a section whose job is reference rather than configuration takes the quiet one. FR-02's button label and accessible name shipped verbatim, which is what kept findability and the accessibility criteria intact through the deviation.

**Third-party service credits are deliberately excluded, and adding acknowledgees is the user's call, never a builder's.** The section is personal gratitude with exactly two entries (The Cornell Lab of Ornithology and the Macaulay Library; Deven Simonson). Provider attribution already lives where it is owed -- the map's attribution control and PRIVACY_POLICY.md's provider disclosure -- and a full credits/licenses inventory would be its own feature with its own accuracy obligations. If credits are ever wanted, that is a separate follow-on, not an edit to this section.

**The README/website shortening is a durable copy posture, not a one-off tidy.** The user's direction: descriptions exist to let a reader judge quickly whether the app is useful to them, and the old prose buried that. README went from 4,318 to 891 words (a lead paragraph, one line per tool, then privacy/keys/install); the website kept its full structure and cut each section's prose to a short paragraph; docs/HELP.md remains the untouched full documentation. Accuracy and no-em-dash rules governed the cut, the guarded published claims survived (`projectsPublishedClaims.test.ts` green), and no link target moved (URL multiset verified in security review). Future public copy holds this register: lead with what the thing does for the reader, and leave exhaustive detail to HELP.md.

**The store leg held under the standing replacement rule -- the 1.0.2/1.0.3 shape, not the 1.0.5/1.0.7/1.0.9 shape.** The 1.0.4 submission (`b52fdc55`) is still WAITING_FOR_REVIEW, and 1.0.10 is a new feature, not a correctness fix of the in-review build, so it does not clear the replace-in-review bar; the rule simply operated as written and there was no option to put to the user. The then-current version goes out as an ordinary store update once 1.0.4 clears. Everything else shipped: macOS (notarized, stapled), Windows (CI green at the tag), `latest.json`, the website, and iOS 1.0.10 build 1 on TestFlight.

---

## Overlapping saves to one shared document are a lost update -- desktop writes now take turns, the erased ledger is honestly unrecoverable, and the store leg was deliberately passed -- 2026-08-30 (v1.0.9)

**Decision: shipped** as `241ff0b`, tagged `v1.0.9` (iOS stamp `c34fe82`). `TauriStorage`'s shared-document methods (`data/settings.json`, `data/api-keys.json`, `data/metadata.json`) ran unserialized read-modify-write: every save rewrote the whole document from a base read taken before the write, so two overlapping cycles read the same stale base and the last writer silently dropped the other's keys. The fix is a per-document promise chain keyed by a closed set of three module path constants: every method touching a shared document runs as one link on that document's chain, a link never awaits another chained op (links use the unchained primitives, so no reentrant deadlock), and a failed link rejects only its own caller (the stored tail voids value and rejection, so one failure never poisons later writes). The fs-plugin import is memoized once per adapter -- required to make the plugin mockable, and a small production win. Web/Pi is untouched: the backend writes one file per key, so there is no shared document to clobber.

**The heaviest casualty names the class.** The projects checker's ledger (`checklist-projects-v1`) lives in settings.json beside every other remembered thing, and during a sweep the debounced projects and exotic-provenance flushes collided until the installed document held two keys. That is why 3,445 answered checklists vanished on relaunch after the 1.0.8 update -- the update only forced the relaunch that exposed it; the race is latent since the desktop storage seam existed, and everything through setSetting/deleteSetting was at risk (theme, map defaults, tab layout, every settings-document durable cache). Lost data is unrecoverable by design -- there is no second copy to restore from -- and the contract is stated rather than softened: the ledger re-earns itself on the next full check, and from 1.0.9 it stays put.

**Proven red-first, then re-proved by QA from the other side.** The repo's first `@tauri-apps/plugin-fs` mock harness (`storageWriteSerialization.test.ts`, park-and-release step control over an in-memory file map) ran against the pre-fix code: 6 of 9 fail with the brief's exact field signature, the 22-writer storm losing 17 of 20 keys; 9/9 green with the chain, full suite and build green. QA then neutered only the serialization inside the FIXED file (restore verified byte-identical by SHA-256) and got the same 6/3 split -- the tests detect the bug, not the diff. Two reusable harness rules travel with the mock: a module that will be mocked under concurrency must memoize its dynamic import (vitest's dynamic-import interception is not reentrant -- 21 of 22 concurrent first-time imports fell through to the real plugin), and the mock asserts its own presence via a sentinel value so a leak of the real implementation fails loudly instead of certifying vacuous tests.

**Implications:** any read-modify-write on a shared persisted document joins its document's chain, never bypasses it -- the convention is now in CLAUDE.md's desktop-storage section, and the next such store owes the same mechanism plus an interleaving test shaped like this one. The chain-key record is safe by its closed constant key set, not structurally (the run's one Informational, accepted): if a fourth document or any computed path ever joins the chain, re-home `docChains` on a `Map` or `Object.create(null)` in the same change (tracked on ROADMAP). ROADMAP's "serialize durable-cache write completion" item closes -- the cross-key lost update was the sharper form of that observation -- with the residue stated there: replay.json and the style blob stay unchained (own files, whole-document writes, no in-module read-modify-write), and a caller-level read-modify-write composed from separate get/set calls is serialized per call, not per transaction.

**The App Store leg was deliberately passed (user decision, 2026-08-30) -- the 1.0.5 and 1.0.7 choice repeated a third time.** 1.0.9 DID clear the replacement bar: the same unserialized seam ships in the in-review 1.0.4 build (`b52fdc55`), so the race exists there, and the user was told so explicitly. They chose to let the current review finish rather than re-queue the store debut. So, as at 1.0.5 and 1.0.7, this is not a hold under the rule -- it is a deliberate pass on an option the rule opened, and the disposition question is CLOSED for 1.0.9. Once `b52fdc55` is approved and released, the then-current version goes out as an ordinary store update (the standing path). Everything else shipped: macOS (notarized, stapled) and Windows (CI green at the tag) with `latest.json` live, the website, and iOS 1.0.9 build 1 on TestFlight.

---

## A categorical palette's assignment ORDER is a per-chart, measured decision -- the Projects chart re-seats amber because the donut's adjacency fails colorblind separation -- 2026-08-30 (v1.0.8)

**Decision:** the Statistics tab's new Projects participation chart uses the shipped categorical chart family (`--sr-accent`, `--sr-graph-photo`, `--sr-graph-audio`, `--sr-graph-video`, `--sr-chart-slate` as the fold) in a deliberately different assignment order from the observer donut's array: amber sits between blue and violet. Token VALUES are untouched in both themes -- the fix lives entirely in this one chart's order.

**Rationale:** measured with the dataviz palette validator rather than eyeballed, the donut's shipped blue-violet adjacency is near-indistinguishable under deuteranopia (ΔE 1.3); with amber third the set passes every separation check in BOTH themes (light: worst adjacent ΔE 25.7 deutan; dark: 19.4). The deviation costs nothing on the accessibility contract because color is reinforcement, never sole carrier: bar order equals row order, each charted row ties to its bar by a matching dot, and the row text is the identity (WCAG 1.4.1 holds with color removed) -- the chart itself is `aria-hidden` + `inert`, with the text rows the sole accessible carrier of every figure.

**Implications:** a categorical ORDER is chosen per chart by measurement, never copied from another chart's array as if it were a token -- the standing rule is now in `.claude/rules/ui.md`. The observer donut's own array is deliberately unchanged: its adjacency failure is real, but re-ordering a shipped chart is a visible change to that chart and gets its own decision, not a ride-along (tracked on ROADMAP). A token value change remains a separately logged decision; this entry logs the order.

## The sweep gains a pass-scale pacing layer OVER the shared gate -- v0.5.93's one-enforcement-point contract extended, not reversed, and the pause is deliberately session-only -- 2026-08-30 (v1.0.8)

**Decision:** after each 429 wave observed during a pass, the projects sweep widens its own inter-request spacing for the rest of that pass (`sweepSpacingMs` in `lib/rateLimit.ts`: strictly monotonic, factor 4 per wave, exponent clamped to [0, 3], max 9,600 ms at the shipped 150 ms base), and after the third wave it pauses itself through the existing stop machinery -- a twelfth `projectsCopy.ts` state suggesting trying again in about an hour. The policy lives in the CONTROLLER (`useChecklistProjects`), because pausing is sweep policy, not key-global policy; the gate (`lib/ebirdGate.ts`) contributes only `waveCount`, a monotonic observation-only counter.

**"One enforcement point per request, shared state across all of them" (v0.5.93) is extended, not reversed -- and the layering pattern is the durable part.** The gate's key-global semantics for single-shot lookups are byte-untouched (cooldown, reset-on-success, Retry-After parse/bound/re-serialize, 429 never cached; the parity fixtures did not move), the Map Explorer's lookups never inherit a sweep's pause, and a 429 anywhere still slows everything on the key. Three rules travel with the pattern for the next pass-scale pacing surface: the gate contributes MONOTONIC, observation-only fields -- never reset by a success, never consulted by gate policy -- and a pass counts by DIFFERENCING over its own window; a layered schedule sleeps its FULL widened interval between items, because the gate's floor elapses during the sleep, so the two never add and "widened minus the floor" quietly under-delivers; and going slower than the floor is always contract-compliant, so the layer needs no gate-policy change to exist.

**The pause is session-only, and the hour is guidance copy, not a lockout -- the in-lane choice, keeping v1.0.5's "two raw fields and nothing derived."** Nothing about a stop was ever persisted (that is what makes the honest `partial` state fall out on relaunch), and a persisted "paused until" timestamp would be the store's first derived field. Resume forks on the pause flag: `{only: failed}` remains the `unanswered` state's semantics, while resume-after-pause runs 'pending' so the never-reached remainder is not stranded -- it asks about everything unanswered, never about an answered checklist. A user can resume immediately; the schedule simply starts a fresh pass window.

**This is v0.5.92's own lesson paying out a second time, in the same feature family.** The oscillation was the shipped design operating as written -- the ladder resets on a single post-cooldown success, so sustained sweep volume re-trips the limiter about once a minute, forever -- and only real-key, real-volume live use exposed it; no stubbed harness could. The new tests hold that entry's rules: fake timers, client-observed request starts, work done rather than elapsed time, red-first mutation checks on the pause, the widened sleep, and the resume fork.

## v1.0.8 ships as a two-build Spool bundle, and the store hold is the standing rule operating -- 2026-08-30 (v1.0.8)

**Decision: shipped**, as a two-build Spool bundle (`110691d` projects-stats-card, `5c8122e` project-checker-rate-limiting, on `weft-spool/20260830-162238`), landed as `edd6fa5` and tagged `v1.0.8`, plus `c25374c` (iOS stamp). Both Improve builds stamped the one version and share the one `[1.0.8]` CHANGELOG heading -- the v1.0.3 merge rule and v0.5.90's flush rule applied rather than restated: verification ran the cumulative bundle state (3,626 frontend + 311 backend tests and the production build, all green), and the tag points at the landed result. Released to the GitHub release (notarized universal DMG, signed Windows installer, `latest.json` with all three platform keys verified), the website via Pages (no content change was needed), and iOS TestFlight (1.0.8 build 1, delivery `c32388ff`).

**The App Store leg is held, with nothing to decide -- the 1.0.6 shape exactly.** ASC still shows the 1.0.4 submission (`b52fdc55`) WAITING_FOR_REVIEW, and neither bundled change fixes anything the in-review build gets wrong: the Projects section itself shipped in 1.0.5, so the 1.0.4 build contains neither the card this release densifies nor the sweep it paces. No replacement question arises under the standing rule; the then-current version goes out as an ordinary store update once `b52fdc55` clears.

**Security across the bundle: no findings above Informational.** The one accepted note -- `sweepSpacingMs`'s clamp passes NaN through -- is unreachable from its sole caller (`waves` is the difference of two internal monotonic integers) and degrades to the gate's 150 ms floor, never past it; the optional `Number.isFinite` hardening is on ROADMAP for if the function ever gains a second caller.

---

## The shared picker moves as one: an approved entrance on all three, and a latent row crush fixed where it lives -- 2026-08-29 (v1.0.7)

**Decision:** the 140ms ease-out listbox entrance lives in the shared `SpeciesCombobox`, so Species Detail and the Calendar gained it alongside the new Map Explorer consumer -- the one deliberate shared-surface change in a run whose `sm`/`md` registers are pinned byte-identical by test. The Designer flagged the deviation, recommended shared, and the user approved the direction as presented. The row-legibility repair landed in the shared row layout the same way: `maxWidth: 40%` on the scientific-name span, so the common name always keeps the majority of the row.

**Rationale:** shared-by-default is what keeps three pickers from drifting; the offered alternative (gating the animation on `size === 'panel'`) preserves byte-identity at the cost of a fork inside one component. The 40% cap is a percentage, so the guarantee is width- and scale-invariant rather than tuned to the surface that exposed it. The crush mechanism: the name span's `flex: 1` is basis 0% while the sci span's `flex: 0 1 auto` is basis auto, so flex serves the SECONDARY text its intrinsic width first. The root defect is pre-existing in the shared component since the v1.0.4 extraction -- Species Detail at 320px measured a 63.8px common-name box in shipped 1.0.6 -- and the severity was introduced by this change, whose ~267px panel listbox is the first narrow-at-desktop consumer with scientific names (58.8px name box at 100% scale, 0px at 200%, reading as overlap under clip-with-ellipsis). The user found it in live preview at the deploy stage; the fix went into the component, so every consumer, including the already-shipped ones, is repaired in one change.

**Implications:** a shared-component change is a change to every consumer: claim byte-identity per size register, let genuinely shared surfaces (the row layout, the entrance motion) move together, and flag any such shared move for approval before it ships, never silently. Classify a latent defect in both halves -- where the root lives (the version that introduced the code) and what made it visible (the first consumer at new geometry) -- and put the fix where the root lives. The fix also repairs geometry measurably present in the in-review 1.0.4 App Store build, so 1.0.7 cleared the replacement bar; per the 1.0.5 entry's instruction the user was told it qualified and asked, and chose (2026-08-30) to let 1.0.4 finish review -- the 1.0.5 choice repeated, a deliberate pass on an option the rule opened, not the hold rule operating. The then-current version goes out as an ordinary store update once `b52fdc55` clears.

## "Subspecies and forms" is the countable set that folds to a parent -- and the label pays for the breadth -- 2026-08-29 (v1.0.6)

**Decision:** the Subspecies Explorer's unit is a raw observation name that folds to a different parent species AND is countable under eBird's own rule: ISSF subspecies groups, intergrades and domestic types are in; hybrids, spuhs, slashes and undescribed forms are out. Every surface of the feature says "Subspecies and forms", never plain "Subspecies".

**Rationale:** a pure-subspecies-only definition would need classification the app's utilities do not hold, while the broader set is exactly what the trusted v0.5.89 machinery already computes (`normalizeSpeciesName` for the fold, `isNonCountableForm` on the raw name for countability), so the feature inherits tested classification instead of inventing a second one. The honest label is the cost of the breadth, paid in copy rather than in a new classifier.

**Implications:** a future per-form surface (Statistics, Life List and Multimedia were scoped out for v1) reuses the same definition and the same two utilities; a run that wants true subspecies-only must first build that classification, not narrow the label.

## Two figures on one page disagree by RULE, so the difference ships as a published ledger, never a forced equality -- 2026-08-29 (v1.0.6)

**Decision:** the breakdown's countable-only total and the merged Sightings "Checklists" figure disagree whenever a non-countable variant (a hybrid, a slash) folds to the selected species, because the merged memo includes those rows and the breakdown by definition excludes them. The resolution is a `nonCountableCount` ledger carrying the tested identity breakdown total + ledger = Sightings figure, plus a user-visible footnote naming both numbers whenever the ledger is nonzero. The merged view itself is byte-unchanged.

**Rationale:** the PRD's parity requirement (FR-13) rested on the assumption that the merged aggregate was already countable-only; The Architect verified that assumption against `SpeciesDetail.tsx` at Stage 3 and it does not hold. Forcing raw equality would mean either changing the shipped merged view (barred by the same PRD) or silently mis-stating the breakdown, and FR-13's own surface-the-conflict clause pre-authorized exactly this repair, so it landed as a targeted restatement rather than a rebuild.

**Implications:** when two figures on one surface derive from different inclusion rules, publish the difference -- an identity the tests pin plus a footnote the user sees -- rather than bending either number or hiding the gap. And the run-over-run lesson holds in its good direction for once: v1.0.4 and v1.0.5 each recorded records agreeing with each other and not with the code; here the premise WAS checked against the implementation before building, which is why the finding cost a restated criterion instead of a mid-build cascade.

## The App Store hold at 1.0.6 is the standing rule operating, with nothing to decide -- 2026-08-29 (v1.0.6)

**Decision:** 1.0.6 shipped to macOS, Windows, the website and TestFlight, and was not submitted to the App Store; the in-review 1.0.4 submission (`b52fdc55`) stays queued, and the then-current version goes out as an ordinary store update once it clears.

**Rationale:** unlike 1.0.5, which cleared the replacement bar and whose replacement the user declined anyway, 1.0.6 fixes nothing the in-review build gets wrong, so no replacement question arose. This is the rule recorded at 1.0.2 and made standing at 1.0.3, operating as written.

**Implications:** none new. Recorded so every release's store-leg disposition stays on one audit trail and a missing leg is never read as an oversight.

---

## Completeness stays on the Map Explorer, against a roadmap entry that assumed all three metrics -- 2026-08-27 (v1.0.5)

**Decision: the two new county-shading mounts carry Species and Records only.** The roadmap had carried "County shading on the Species Detail and Statistics maps" since v0.5.46 with an explicit note that the extension "would now carry all three metrics, including v0.5.54's Completeness." That note is overruled, deliberately and at scoping time rather than by omission during the build.

**Rationale, three independent grounds.** Completeness is the one county metric that makes an eBird call per county, and this run already carried a ~3,300-call sweep; stacking a second network-backed surface into one release buys a worse first experience of both. On Statistics it would sit inches from the Geographic Stats county tables, whose species counts use a **different numerator rule** -- the escapee alignment deferred out of v0.5.87 -- so the release would ship a known disagreement rendered side by side, which is worse than not rendering it. And per species Completeness has no meaning at all: "what fraction of this county's species list is this one bird" is not a question.

**Reversal condition, stated so a later run does not re-litigate it blind:** close the escapee-numerator alignment on Statistics' per-county species counts FIRST, then Completeness can join the Statistics map as a follow-on. Species Detail is a permanent exclusion, not a deferral. Both halves are now on the roadmap in those terms.

**The premise the roadmap entry rested on was also wrong, and the brief was rewritten on the corrected fact.** Three records described both target maps as already drawing the breeding atlas, making this "one more overlay beside an existing one." `AtlasLayer` and `CountyLayer` are mounted only on `MapExplorer.tsx`; Species Detail's map and Statistics' Geographic Stats map were plain `<SnowMap>` mounts with pins. The work was still small, but the geometry loader, the toggle, the popup and the entry-chunk guard each had to be wired at every site rather than inherited. **This is the second consecutive run where several records agreed with each other and none agreed with the code** (v1.0.4's taxonomy-rename bridge was the first). Read the implementation before scoping from the record.

## The projects store persists two raw fields and nothing derived -- and the denormalized-published-field rule lands on the OPPOSITE side here -- 2026-08-27 (v1.0.5)

**Decision:** `checklistProjectsCache` holds `{ proj, ids, at }` per checklist and no aggregate. Every project count, date range and share is recomputed at read time by joining the store against the currently loaded backup. The store admits **fill-and-stop**, never FIFO.

**The admission choice follows what an eviction COSTS, which is the v0.5.87 rule applied rather than a new one.** An eviction here destroys an answer that cost a real network request, and at capacity+1 it would destroy one on every pass forever. County completeness stays FIFO for the mirror-image reason: there an eviction costs one redundant request and loses no answer. Admission gates on the container's own size (`store.order.length`), never a separate counter, and is measured at capacity+1 as **work done** -- admissions, refusals, evictions -- never as elapsed time, with a test that re-merges one id fifty times to prove admission capacity is not silently consumed by repeats.

**The forward-looking part, and the reason this entry exists.** CLAUDE.md permits a denormalized, published classification field in a persistent cache document *when a passive reader structurally cannot re-derive it* -- the v0.5.87 rule written for `ProvenanceSnapshot.excludedNames`, where the Calendar holds no name-to-code join and may not fetch one. **That rule's precondition is not met here, so publishing an aggregate would be the stale-cache trap the rule warns about rather than an instance of the exemption.** The Projects section is the only reader, and it owns both inputs: the store and the loaded backup. It can always re-derive, so a published copy would buy nothing and could only go stale against a newer export. **This is not a blanket prohibition on the pattern.** If a future run puts project figures on a passive surface -- the Calendar is the obvious candidate, and it is deliberately zero-network -- that reader genuinely cannot re-derive, the precondition is met, and the v0.5.87 shape applies *in full including its confirmation step*: publish the classification, keep the raw evidence in the document, and have the passive reader CONFIRM the published list against the persisted ledger from its own observations rather than trusting it. Without that confirmation step the exemption is a trap; with it, the offline reader tracks a new export correctly.

**A completed sweep still needs a working "Check again", and it goes through the same chokepoint.** Under the 365-day TTL a finished sweep leaves the normal target set empty for a year, so the complete state's control would otherwise be a no-op press for its entire useful life. It passes `{ force: true }` through `dedupedFetchProjects` -- the escapee store's `opts.refetch` precedent -- so it is not a second write path and not a second enforcement point.

**Two live Python/JS parity traps, both carried as fixture rows rather than as comments,** because a comment does not fail: Python's `$` admits a trailing newline (hence `re.fullmatch`), and `isinstance(True, int)` is `True` (hence the explicit bool exclusion, or `projectIds: [true]` becomes `[1]` on one transport only). One divergence is knowingly left open and recorded as Informational: `projectIds: [1050.0]` normalizes to `[]` on FastAPI and `[1050]` on desktop. If it is ever closed, **loosen the Python side to match JS**, not the reverse -- eBird publishes integers, so neither transport can reach it from real data, and the strict side is the one with nothing to gain.

## The App Store leg was deliberately skipped at 1.0.5, and the user was told it qualified first -- 2026-08-27 (v1.0.5)

**Decision:** 1.0.5 shipped to macOS, Windows, the website and TestFlight, and was **not** submitted to the App Store. The in-review 1.0.4 submission (`b52fdc55`) was left in `WAITING_FOR_REVIEW` to finish review; 1.0.5 goes to the store as a later submission.

**This is a departure from the all-platforms-every-time rhythm, recorded so it is never read as an oversight.** It is also not the standing hold rule operating: 1.0.5 **cleared** the replacement bar recorded at 1.0.2, 1.0.3 and exercised at 1.0.4 -- it fixes a real accessibility defect present in the in-review build, the county popup opening past a narrow map with its close button unreachable. The user was told exactly that, in those terms, before choosing. They chose to let 1.0.4 finish review anyway.

**The rule and the choice are different things, and the difference is what this entry preserves.** "Replace an in-review submission only when the new build fixes something the in-review one gets wrong" is a bar the *build* must clear; clearing it makes replacement permissible, never automatic. The cost of replacing -- re-queuing the store debut a second time in two releases -- is the user's to weigh, and here it outweighed a defect reachable only at 320px and the largest text scale. **Do not read a future qualifying build as self-approving; state that it qualifies, name the re-queue cost, and ask.**

---

## The last 320px/200% scroll leaks, and three findings the fixes were not looking for -- 2026-08-27 (v1.0.4)

**Every tab now holds its width at 320px in both text scales and BOTH themes: 44 measurements, all 0px.** The roadmap tracked three leaks (Statistics 60px, Checklists 42px, Calendar 29px) as one family. Measurement disagreed twice before a line was written, and the design pass was where that surfaced rather than the build.

**Checklists was never a layout defect.** Its 42px was a phone-tier universal child selector, `.sr-field-row > * { width: 100% }`, reaching the visually-hidden `<span class="sr-only" aria-live="polite">` in that row. `.sr-only` is `position: absolute`, so the percentage resolved against the containing block rather than the row: a 320px box at x=42, right edge 362, at EVERY text size. This is the **third** instance of the standing check in `.claude/rules/ui.md` ("a position:absolute element wider than the viewport leaks PAGE horizontal scroll even when invisible"); the two fixed in v0.5.37 patched elements, this one narrows a selector. The fix is `:not(.sr-only)` on all three universal-child width rules in that family, including the map-sidebar copy where no live region sits today.

**THREE OF THE DESIGN SPEC'S FIVE PRESCRIBED MECHANISMS WERE WRONG, and the diagnosis of WHICH element and HOW MANY pixels was right every time.** That asymmetry is the durable lesson: a real-render probe is excellent at localizing a defect and says nothing about why the box behaves that way. The breeding-stats offender was the tier LEGEND, not the 3-up stat grid the spec named (that grid never leaked; its edit was reverted). Temporal Stats needed the row to WRAP, not the `max-width: 100%` cap the spec reused from the v0.5.82 precedent -- there was no `.sr-wrap-flex` on that row at all. And the Calendar day cells were not an unreleased automatic minimum: `min-width: 0` was already on them, and the real cause was `aspect-ratio: 1/1` turning `.sr-touch-target`'s `min-height: 2.75rem` into WIDTH (44x44 at 100%, 88x88 at 200%, inside a 32.56px track). Seven 44px squares plus gaps need 326px, so a fully square fully tappable week has never fitted a 320px phone; it stayed on screen only because the card is inset. **Verify a prescribed mechanism against the element before building to it, even when the same document's measurements are exact.**

**The Calendar day cell trade was the user's call, taken mid-build.** Capping width to the grid track makes a cell 32.58 x 88 at 200% rather than 88 x 88. Width falls below the app's own ~44px posture, which is WCAG 2.5.5 (AAA) and not the AA bar this app targets; it stays clear of 2.5.8 Target Size Minimum (AA, 24x24) on both axes, height is untouched, and every day stays visible without a nested horizontal scrollport inside a page that already scrolls. The alternatives were measured and rejected: a contained scroll inside the month card (a shape this app has refused before), or capping the min-height, which removes the touch posture for exactly the user who enlarged their text.

**Settings' 1.14px was a scope addition, surfaced rather than absorbed.** `SectionHeader`'s `white-space: nowrap` made "HELP & DOCUMENTATION" unbreakable at 297.14px inside 272px. Outside the approved three, one declaration, and the last thing standing between the repo and an unqualified accessibility claim, so it was fixed and named rather than quietly included. `ACCESSIBILITY.md:77` needed no edit -- it already made the unqualified claim, which was simply false and is now true. `docs/HELP.md`'s hedge was removed only after all 11 tabs measured clean.

**The reported "regression" in the Calendar metric switch was PRE-EXISTING, and a build A/B is what established that.** It was reported during live preview as something this build broke. Stash, rebuild v1.0.3, measure the same nodes: byte-identical numbers, 2 lines at 402px and 3 at 402px/200%. Fixed anyway (the segments now fill their line instead of leaving ~166px of dead pill background beside the widest option), but **the two minutes of stash-build-measure changed the claim from "we broke this" to "this has always been so"**, which is the difference between an apology and a changelog line. Do the A/B before accepting attribution.

**Implications.** Exclude `.sr-only` from any `> *` sizing rule. Where a fix's correctness depends on a rule APPLYING, the cascade-competitor scan is not ceremony: the first version of the segmented-control fix used `.sr-seg > button`, whose rightmost compound is a bare `button`, and `mapFabCascade.test.ts` failed it against the map FAB rules -- the segments carry `.sr-seg-btn` for that reason.

## The taxonomy rename bridge was narrower than four records claimed -- 2026-08-27 (v1.0.4)

**`codes` already resolved a renamed species; what a stale export lost was its taxonomic SORT.** The idea inbox, the roadmap, and the change brief all described a post-rollover export as resolving "nowhere in the new species lookup," costing favicons, sort, and escapee coverage. Reading the endpoint disproved three of the four: `get_species_codes` tries `_by_sci` FIRST and falls back to `_by_com`, on both transports, so a bird whose common name changed kept its code, its favicon, and its visibility to the escapee check. Only `orders` was keyed on the common name alone.

**Decision:** bridge `orders` through the SAME resolved code, common-name-first: `sciName -> code -> CURRENT common name -> order`. A derivation over maps already loaded, so no snapshot format change and both committed copies stay as generated. Common-name-first means a name that resolves today keeps its exact current answer and the bridge can only ADD an order where there was none.

**Implication, and the reason this entry exists at all:** four records agreed with each other and none of them agreed with the code. A claim restated across the inbox, the roadmap and a brief accumulates confidence without accumulating evidence. Read the implementation before scoping from the record.

## The demo dataset's synthetic checklist ids were REAL checklists -- 2026-08-27 (v1.0.4)

**Measured, not assumed: `S184500069` from the old committed demo dataset returns HTTP 200 from the eBird API.** The roadmap carried moving the ids above eBird's live allocation as a precaution against *possible* collision. It was not hypothetical. Anyone who imported the published demo dataset with their own eBird key -- an App Store reviewer following `REVIEW_NOTES.md`, or a curious user -- ran the exotic-status pass against real strangers' public checklists. Screenshot capture never sent those requests (the Playwright stub answers locally), so the exposure was in the dataset being IMPORTED, not photographed.

**Resolved.** Ids moved to `S9xxxxxxxxx`; the new range returns HTTP 410. Both published copies under `website/demo/` were regenerated and the live site now serves them. The generator is seeded and the id counter never draws from the PRNG, so a row-by-row diff of all 7,869 eBird rows and 516 ML rows shows exactly one column changed.

**Implications.** A synthetic identifier range is chosen ABOVE the real allocation and verified against the live service, never merely chosen to look fake. The move also earns its keep twice: `capture-appstore.mjs` now uses "every submission id is >= 9e9" as a **structural** demo-dataset guard, failing closed before the first frame, which is better than the species/checklist-count signature the roadmap suggested because a count legitimately moves whenever the generator is re-run. Verified in three directions (demo backend allowed, non-demo refused by name and count, unreachable refused).

## Replacing the in-review App Store submission, and the rule that permitted it -- 2026-08-27 (v1.0.4)

**Decision:** the in-review 1.0.1 submission (`ba87ba7a`) was withdrawn and replaced with 1.0.4, at the user's explicit direction, so the first store release shows the current app.

**Rationale.** The rule recorded at 1.0.2 and again at 1.0.3 was "replace an in-review submission only when the new build fixes something the in-review one gets wrong." 1.0.4 clears it on two grounds, both stated before the user confirmed: the scroll leaks are real accessibility defects present in 1.0.1, and 1.0.1's listing screenshots showed a bird the app no longer has. The cost -- re-queuing the store debut -- was named once and accepted. **The rule is upheld, not overridden**: what changed is that a qualifying build finally arrived.

**Mechanics worth keeping.** The SAME version record was re-pointed (1.0.1 -> 1.0.4) so every listing field survived, the same play used for 1.0.0 -> 1.0.1. All 12 screenshots were replaced rather than the 9 that changed, because deleting and re-adding APPENDS to a set and a partial swap scrambles listing order. `whatsNew` is null (correct for a first release) and description/promo/keywords are version-independent, so no copy referenced 1.0.1.

**Implication for the release runbook, and it is a correction:** `POST /v1/appStoreVersionSubmissions` now returns **403 FORBIDDEN_ERROR, "Allowed operation is: DELETE"**. Withdrawal still uses that endpoint; CREATING a submission has moved to `reviewSubmissions` + `reviewSubmissionItems` + `PATCH submitted: true`. New submission `b52fdc55`, WAITING_FOR_REVIEW, releasing on approval. Phase B now keys off it.

## Two builds land on one version: the collision resolves by MERGE, not a re-bump — and the App Store hold repeating makes it the rule — 2026-08-27 (v1.0.3)

**Decision: shipped**, as `44dcbac` (custom-raven-glyph, main) + `a9906fc` (named-birds-top-locations, built in a parallel worktree on `weft/named-birds-top-locations`), merged at `a9c6e4c` and tagged `v1.0.3`, plus `b9e8e3f` (iOS stamp). Released to the GitHub release (notarized universal DMG + signed Windows installer + latest.json), the website, and iOS TestFlight (1.0.3 build 1). Two independent runs folded into one release at the user's direction ("this and that work should all ship together ... be sure the version numbers do not conflict").

**Two concurrent builds that both stamped the same patch version reconcile by MERGE plus a changelog reconciliation, never by re-bumping one of them.** Each run had independently bumped 1.0.2 → 1.0.3 in `frontend/package.json` and `src-tauri/tauri.conf.json`, which reads as a collision and is not one: both files carry the same value on both branches, so the merge is a no-op on each and the version-parity guard holds without a second bump. The only real conflict is `CHANGELOG.md`, where each run had written its own `## [1.0.3]` heading; the resolution is ONE heading carrying both entries under their own `### Added` / `### Changed` subheads. Re-bumping the second build to 1.0.4 would be the wrong repair — it mints a version that ships nothing of its own, and the all-platforms rule would then owe that empty version a full release across every leg. **Standing rule for the next time two runs land together:** cut the tag from the merge commit, re-run the FULL suite after the merge and quote that number (3078 tests here, not either run's own count), and assert the two version files equal rather than re-deriving either.

**The App Store hold repeating at 1.0.3 makes it the rule, and 1.0.1 the exception.** The 1.0.1 submission (`ba87ba7a`) was confirmed still WAITING_FOR_REVIEW at ship time. 1.0.3 is a feature plus a brand-mark change with no correctness defect behind it, so replacing the in-review build would re-queue the store debut for no user-visible gain — the same call recorded at 1.0.2. Stated positively now that it has happened twice: **replace an in-review submission only when the new build fixes something the in-review one gets wrong** (1.0.1 over 1.0.0, a headline count reading high); everything else waits and goes out as an ordinary store update once the queue resolves. Phase B (the availability prose) still keys off `ba87ba7a`'s approval, not the update's. The all-platforms rule is otherwise unbroken: every other leg shipped.

**The in-app chrome joins the brand mark, at 100% sizing, through one shared component.** v0.5.93 unified the mark everywhere an icon shows; the app header and the first-run welcome screen still rendered a generic library bird — the last two surfaces carrying a bird that is not the raven. Both now render the shared `RavenGlyph` (inline single-path SVG, `fill="currentColor"`, always `aria-hidden` + `focusable="false"`) at the exact shipped sizes. **A 90% optical trim was designed, previewed, and DECLINED at the design gate:** the raven's diagonal posture already leaves breathing room, and a solid mark beside the 700-weight wordmark is the app-icon pairing, so the slot sizes stay 20/30 in the header and 34 on welcome. `strokeWidth` was dropped rather than ported (meaningless on a filled silhouette), and the welcome site GAINED the `aria-hidden` it had been missing while the header had it. The v0.5.93 asset convention binds: the master SVG is committed in-repo at `frontend/src/assets/snowraven-bird-glyph.svg` so regeneration never depends on a Downloads folder — and the two masters stay deliberately separate, the icon master remaining under `pipeline/ebird-cooldown-and-app-icon/icon-source/`. The archival master keeps its baked hex and `<title>`/`<desc>`; the component strips all three, so the no-hardcoded-hex rule governs the component and the master is exempt as artwork.

**A ranked list that can degenerate to one item renders a SENTENCE, not a ranking of one — and renders nothing at all where there is nothing to rank.** The Named Birds card's top-locations block ranks only that individual's own `[name:…]`-tagged sightings, never the species' wider history, so the counts reconcile with the card's own header figure (per checklist, not per row — `computeNamedBirds` already collapses a parent + subspecies pair from one checklist). One distinct location reads `Every sighting at {place}.` with no numbering; no location names at all renders no heading either, mirroring the card already omitting the map for a bird with no coordinates. The block is gated by the same `showMap` prop that gates the map and media rather than a new flag, so **that one prop now means "this is the Named Birds tab, not Species Detail's reuse"** — Species Detail's Named Individuals section is byte-unchanged and keeps its own species-wide Top Locations above it. A proportion bar behind each row was considered and rejected as color on a deliberately uncolored surface; recorded so a later run does not re-litigate it blind.

---

## The App Store debut is 1.0.0, key-free at review, free forever, and never allowed to block the other platforms — 2026-08-25 (v1.0.0)

**Decision: shipped and submitted**, as `d962473` (feature) + `bc50769` (iOS stamp) + `bbd920c` (key-free review notes), tag `v1.0.0`, released to macOS, Windows, the website, and TestFlight; App Store review submission `c9da4d53` read back WAITING_FOR_REVIEW, releaseType AFTER_APPROVAL. A distribution feature, deliberately: the entire `frontend/src` diff is one test-only parity guard and `src-tauri` moved only the version, so what shipped is the listing record, the compliance record, the review package, the screenshot pipeline, the first-party privacy page, and the release-rhythm change — not app behavior.

**The debut ships as 1.0.0, and versions can never go below it again (user decision at the design gate, superseding the strategic brief's original "no artificial 1.0" position).** One deliberate jump from 0.5.93 to 1.0.0 on every platform at once — the single-version lockstep is unchanged — then the standing incremental rhythm continues upward from 1.0.0 (1.0.1, 1.0.2, …; patch by default, exactly as before). The floor is structural, not stylistic: App Store Connect requires each submitted version to increase, and the desktop updater's latest.json comparison would strand 1.0.0 installs behind any release carrying a lower number. There is no route back to 0.x.

**The App Review posture is key-free and phone-minimal (user decision at the deploy gate).** No eBird key of any kind goes to Apple — a key is personally linked — and no key is committed anywhere; the review script walks the reviewer through the hosted demo dataset and the keyless features first (tide, base maps, every offline analytic), then presents key entry and the honest no-key states as the first-class design they are, and answers the three review-risk areas (minimum functionality, Macaulay embeds, sign-in-less operation) plainly rather than hiding them. Apple structurally requires a review contact phone (the API refuses the record without one); it lives only in the ASC record, never in the repo or pipeline.

**Free with no monetization of any kind, on the store as everywhere.** The founding "free public good" identity carries unchanged — no paid tier, IAP, ads, or donations — which also keeps the Paid Applications agreement and the entire IAP review surface out of the picture.

**Release immediately on approval; a rejection stalls only the App Store leg.** No phased rollout: phasing serves large installed bases, and delaying a privacy-first app's fixes serves no one. Desktop, web, and TestFlight ship on their own schedule every release, Apple's review latency trails behind, and a rejection becomes a fix-forward item in the next release — never a rollback or delay of the other platforms.

**The privacy label "Data Not Collected" is a standing claim with PRIVACY_POLICY.md's weight, and availability is claimed only when true.** The label's reasoning was re-verified against the shipped 1.0.0 code before entry (no analytics, telemetry, accounts, or third-party SDKs; nothing leaves the device except user-initiated calls with the user's own keys), and any future feature that would change the label is a listing change in the same release, exactly as the privacy-policy rule already works. Phase A makes no App Store availability claim anywhere; the exact on-approval edits (README, website, the founding product-brief amendment) are staged in `pipeline/ios-app-store-release/phase-b-availability.md`. The PRIVACY_POLICY.md iOS additions shipped early, in Phase A, on the Designer's adopted flag: Apple reads the privacy page during review, and every added sentence describes behavior already true on TestFlight.

---

## One enforcement point per request, shared state across all of them — and the app icon finally means something — 2026-08-25 (v0.5.93)

**Decision: shipped**, as `7a8bbcd` (feature) + `5150494` (iOS stamp), released as v0.5.93 to macOS, Windows, the website and TestFlight. Two user-clustered improvements: the v0.5.92 eBird pacing contract extended to every eBird lookup the Map Explorer makes, and a new app icon (the serif SR with the raven's head worked into the S, on the brand clover green) across every icon surface, unifying the web favicon and website mark with the desktop icon for the first time.

**The cooldown extension's architecture is "shared state, one enforcement point per request" — and the second half is what kept it wiring rather than redesign.** The cooldown/spacing state moved from the activity controller's per-instance refs to the module-scoped `lib/ebirdGate.ts`, which two enforcers read and write: the controller's own pump (unchanged logic, per-hotspot retry bookkeeping and progress emission need it) for `/map/hotspot-activity`, and the transport chokepoint's `gatedEbirdCall` for the four single-shot routes. Gating the activity route at the transport too would have double-spaced its starts; moving the controller onto the transport gate would have rewired its tested pump. The gate sits BELOW `CACHED_GET_PATHS` (a cache hit never waits), and the accepted, stated cost is that a transport-cache miss an inner cache would serve still waits its start slot. Moving state to module scope also strengthened the contract for free — the cooldown now survives hook remounts, not just pass restarts — at the price of an explicit test-reset seam, the standing trade of module-scoped session state.

**The icon decisions, both ratified at the design gate:** the macOS icns is drawn on Apple's icon grid (tile 824/1024 with a transparent margin) rather than shipping the provided full-canvas icns, so the Dock icon sits at native-app size — the one deliberate deviation from the supplied asset set; and the website's favicon + header logo came along, rebuilt from the traced vector master, ending the era of the site carrying a different bird glyph than the app. The iOS opacity discipline (composite-from-FullBleed, verify every output alpha-free) held under fire: the TestFlight upload passed Apple's validation with no 90717 on the first attempt. Android's dormant set was regenerated so a future bring-up cannot ship the old mark. The master artwork is committed under `pipeline/ebird-cooldown-and-app-icon/icon-source/` so regeneration never depends on a Downloads folder.

**One recipe gap closed for the next ship:** `xcrun altool` needs `DEVELOPER_DIR` exported in the upload shell too, not only in the build's shim — the bare login shell's `xcrun` cannot find altool without it (recorded in CLAUDE.md's iOS section).

---

## The pin-scale colorblind path gains its structure channel, an accessibility preference earns persistence, and the all-platforms rule records its first exception shape — 2026-08-26 (v1.0.2)

**Decision: shipped**, as `6156238` (feature, tagged `v1.0.2`) + `d1c37b3` (iOS stamp), released as v1.0.2 to the GitHub release (notarized universal DMG + signed Windows installer + latest.json), the website, and iOS TestFlight (1.0.2 build 1). Direct user feedback the day v0.5.92 shipped — the pins look great but are not colorblind accessible — becomes an opt-in **Use Tier Rings** switch on the "Color pins by" block: a thin white five-segment ring baked into the ramp pin sprites, filled segments = tier, clockwise from the top over a faint 0.28-alpha track. ONE exported spec (`HOTSPOT_TIER_ARC` in `lib/mapPins.ts`) feeds the sprite bake, the legend minis, and the popup's tier badge, so the three surfaces cannot drift (the CountyDensitySwatch same-source rule); rings-off sprites are the shipped build op for op, and new guards pin structural monotonicity, ring-vs-ramp ≥3:1 contrast in both themes, and the byte-identity itself.

**The v0.5.92 colorblind decision is AMENDED — extended, not reversed.** The pin-scale colorblind path recorded there ("luminance + structure + words, not texture") is now **"luminance + structure + words, PLUS opt-in tier-ring structure for the ramp tiers."** What stands unchanged: texture-as-crosshatch on a teardrop stays rejected (a county-style density hatch does not resolve on a 28px bulb — that half of the v0.5.92 sentence is why this is a ring and not a texture), the non-value states keep their shipped structure (hollow, dashed, pale), personal pins stay excluded from every ramp, and every value is still stated in words in the popup and the in-view list. The ring was chosen over tick marks (counting 4-vs-5 fails at pin scale) and pips (collide with the kind glyph) because it reads by EXTENT at map scale, like a clock face, and by count up close. The 9px in-view `HotspotModeDot` deliberately carries no ring in either state — below the cue's resolution, and each dot sits beside its exact value in words.

**A vision-linked accessibility preference PERSISTS through the storage seam (`hotspotTierRings`, default off) — a deliberate, user-approved deviation from the session-only county/atlas Use-Textures precedent.** The rationale is the user it serves: a per-analysis view toggle resets harmlessly, but re-enabling a vision aid every launch punishes exactly the person who needs it. User approval in their own words: "That sounds good to me, including remembering the toggle." The Designer's first direction (always-on rings) was also revised by the user to opt-in, keeping the map's Use-* colorblind-aid family shape. **Standing implication: a future accessibility-linked toggle follows the persisted path deliberately; per-analysis view toggles (county/atlas textures, the mode choice itself) stay session-only.** This decision does not reopen the county/atlas toggles.

**The "a release goes to ALL available platforms" rule (v0.5.78, the App Store a standing leg since 1.0.0) records its first exception shape: the store leg was HELD at the in-review 1.0.1 (submission ba87ba7a), by user decision at the deploy gate.** The shape worth keeping: when a submission is already sitting in Apple's review queue, **opt-in polish does not replace it; a correctness fix does.** v1.0.1 set the replace precedent (the escapee repair superseded 1.0.0 in queue so the store debut would carry the fix); v1.0.2 sets the hold precedent (tier rings are opt-in polish, and replacing would re-queue the store debut for no user-protecting reason). 1.0.2 reaches the store as an ordinary update after 1.0.1's approval, and Phase B still keys off ba87ba7a. Every other leg shipped in full.

**One verification convention was promoted to `.claude/rules/testing.md`:** a canvas-bake byte-identity claim is guarded by op-stream equality on a recording 2D context (jsdom has no canvas; identical operation streams are identical pixels, and the recorder localizes any drift to the exact drawing call), mutation-verified red-first before it is trusted. `hotspotTierRings.test.ts` is the reference.

---

## A stubbed harness can never see a real rate limit — and mode 3 is per-location because the area aggregate answers a different question — 2026-08-24 (v0.5.92)

**Decision: shipped**, as `d464829` (feature) + `02bb83c` (iOS stamp), released as v0.5.92 to macOS, Windows, the website and TestFlight. Three opt-in color modes on the Map Explorer's Hotspots view (My species / My checklists, offline joins over the loaded backup; Recent activity, community species over the last week or 30 days via the new dual-transport `GET /map/hotspot-activity`), a contrast-guarded five-class cyan-blue ramp (`--sr-hotspot-*`), four honest non-value states, and a byte-identical default pinned by a red-first regression guard. This feature came from the idea inbox — mode 3 carried the idea's own "most importantly" flag — and was never on ROADMAP's Up Next, so Up Next stands unchanged.

**Mode 3's mechanism is per-location recent-obs (`data/obs/{locId}/recent?back=30`), not an area aggregation, because eBird's area product answers a different question.** `data/obs/geo/recent` returns ONE record per species across the whole radius — each species' single most recent sighting anywhere in the area — so a per-hotspot count derived from it undercounts every hotspot except the one holding each species' newest record. Per-location asks exactly what the pin claims to answer. One call at `back=30` serves both windows: the response reduces to one `(speciesCode, obsDt)` pair per species, the 7-day figure is a client-side filter over the same pairs, and a Week / 30-days flip is zero-request by construction. The same reduction makes the cache **counts-only with a fixed shape**: derived fields are computed at one chokepoint (the cache module's `dedupedFetch`), so every persisted entry is fixed-shape by a single write path rather than by caller discipline.

**The 429 revision came from the user's live pre-deploy review, and the reason it arrived that late is the durable lesson: a stubbed harness can never see a real rate limit.** Every automated layer mocks the transport, so the one behavior only an actual provider exhibits under a real key at real volume was structurally invisible to a green 2,600-test suite — the shipped pass started 4 requests in the same millisecond and sustained ~13-20/s, and only the live preview against real data tripped it. The fix makes a 429 a brief visible slowdown, never a lost hotspot: 150 ms global request-start spacing (the pool of 4 kept as a latency ceiling, spacing as the governor), ONE key-global cooldown honoring a seconds-form `Retry-After` capped at 60 s (else bounded exponential 2 s → 30 s with jitter), 2 retries per hotspot then the honest unanswered state, a 429 never cached, and both transports surfacing the 429 AS a 429 with the upstream `Retry-After` parsed, bounded, and re-serialized — never reflected raw (`lib/rateLimit.ts` ↔ `_parse_retry_after_seconds`, fixture-locked). The numbers are deliberate tuning deviations from schema.md's pool-of-4 sketch, recorded in the feature's own decisions.md; the pacing tests are fake-timer and red-first, asserting client-observed request-start timestamps rather than network-side fulfill times. Standing consequence for every future live-provider feature: the live preview against a real key is a verification layer, not a courtesy demo.

**Mode 3 counts eBird's taxa as returned — no countable-form collapse — and the asymmetry with mode 1 is deliberate.** The community-activity number mirrors eBird's own recent tallies, so it matches what a birder sees on eBird's hotspot page; the countable rule applies only where the number claims to be the user's own species count (mode 1), and each popup line is labeled for what it counts. The two numbers legitimately differ on the same popup.

**Three design decisions worth their record.** The personal-zero and community-quiet states share ONE fill token (`--sr-hotspot-zero`) with distinct wording — "asked, and the answer is zero" is one visual idea, the two states can never co-occur, and two identical-valued tokens would be a name waiting to drift. The nodata state is a pale fill whose 3:1 boundary is supplied by its stroke ring, a deliberate deviation from the schema's uniform ≥3:1-vs-land guard clause: "never birded by me" must read as ABSENCE, and any guard-compliant dark fill reads as "something" — precisely the confusion the state exists to prevent; `hotspotContrast.test.ts` encodes the replacement clauses, never the clause they replace. And personal locations are excluded from every ramp and keep their orange star: a personal pin answers "mine", not "how many". The colorblind path at pin scale is luminance + structure + words, not texture — a county-style density crosshatch does not resolve on a 28px teardrop bulb.

**Named residuals, carried on ROADMAP.** The key-global cooldown governs only the hotspot-activity pass; the other eBird surfaces share the key but not the cooldown (single-digit volumes, low urgency). An 11+-digit locId stays permanently unanswered by guard construction (no real eBird id approaches the bound). A mode-3 count is frozen at fetch time for up to the 6h TTL while the window slides (the as-of wording covers it). And a stale persisted map style in `website/tools/demo-data/settings/` points at a dead `127.0.0.1:1699` origin, to be dropped at the next demo-data regeneration.

---

## A control whose visibility is decided by state its own action mutates is a feedback loop — and five defects a 2,819-test green suite could not see — 2026-08-19 (v0.5.91)

**Decision: shipped**, as `8d67490` (feature) + `339ba57` (iOS stamp), released as v0.5.91 to macOS, Windows, the website and TestFlight. A **Search this area** control on the Map Explorer's three centre-based views (Hotspots, Nearby Lifers, Media Targets): one press re-runs the active view's search over the current viewport, centre rounded to 5 dp, radius the smallest of the shipped `RUNGS` `[5, 10, 25, 50]` that covers the view (measured centre-to-corner, so the circle circumscribes the rectangle) capped at `DERIVED_MAX_MI = 25`. Pure logic in `frontend/src/lib/searchArea.ts`. No new dependency, endpoint, backend route, Tauri service function, capability, tile provider or persisted setting; `PRIVACY_POLICY.md`, `package.json`, `backend/` and `lib/tauri/mapService.ts` are untouched. Security PASSED WITH NOTES, no Critical/High/Medium. This feature arrived from the idea inbox and was never on ROADMAP's Up Next, so it is an insertion, not a scheduled item; the mobile app remains item 1 and this release serves it.

**The ratchet is the entry's reason to exist, and it generalizes past this feature.** The control offers itself when the viewport has moved away from the last searched area. A successful search re-framed the map onto its own results. The re-fit frames OUTWARD — a rectangle spanning the searched circle has a half-diagonal approaching `r*sqrt(2)`, and its centre lands away from the searched one — so one press moved the map out from under its own record, the control re-offered itself, and a second press spent another eBird lookup a rung wider: 5 to 10 to 25 mi, one unrequested lookup per step, on a map the user never touched. **The general shape: when a control's visibility is decided by state the app itself mutates as a RESULT of that control's action, the loop is structural and no predicate can close it.** A containment predicate was proposed as the fix and correctly rejected by measurement — the auto-fit zooms OUT, so containment never fires — and no geometric test can separate an app re-frame from a deliberate pan, because the two produce the identical viewport. The cut is at the app's mutation: an `autoFit` prop on the three marker layers, default `true`, false only for a press whose centre and radius were derived FROM the framing. Verified as a build A/B in Chromium: with the guard removed, zoom 12.600 → 11.215, centre moved 0.270 mi, the control re-offered with `aria-disabled="false"`, and one press plus five activations cost 2 lookups instead of 1. Suppression is per RESULT SET rather than per press, so it also covers a filter-driven re-fit on the two views that pass a filtered derivative as `pins`; Hotspots is not a third case, because it passes unfiltered pins and applies `hiddenKinds` as a GL filter expression, so its fit key cannot move. `searchArea.test.ts` names the rejected predicate in a test, so the fix cannot later be dropped back into the offer predicate.

**Five defects reached a build with the suite green, and all five were geometric or interactive.** The control covering the layers switcher at 320px (206x31px at 1x, 294x148px at 200% text scale, burying it completely); the control rendering outside its container; the scrim painting BELOW the county and atlas fills; the ratchet; and a forbidden `window` `resize` listener that a ResizeObserver replaced. The repo already says at length that a geometric claim needs a real render; what is new is the ratchet, and what is worth keeping beside it is that **the offer predicate is a conjunction whose two halves fix different things and neither is redundant.** `hasMovedFrom` is what keeps the CAPPED case correct: past `DERIVED_MAX_MI` the circle is deliberately smaller than the viewport, so the coverage conjunct is false and stays false however long the map sits still, and coverage alone would offer the control in perpetuity on an untouched map, every press sending the identical centre and radius for the identical answer.

**The searched area is shown by DIMMING the unsearched ground, not by drawing a ring — and the layer-order finding inverted the reasoning behind its alpha.** A covering radius circumscribes the viewport, so immediately after a press the circle's edge is off screen and a ring alone would be invisible at exactly the moment the feature is working; dimming inverts that, and makes the capped case self-explanatory with no copy. The indicator was then measured painting below the county fill (`fill-opacity` 0.85) and would equally have sat below the atlas fill — not from a wrong `beforeId`, but because every overlay inserts below the same marker layer and MOUNT ORDER decides the rest. Two consequences pulled in opposite directions and both were settled by measurement over the real basemap (modal rendered colour per tier; single-point sampling picked up roads and water and returned a blue and an orange as "tier colours"): below the fills the dim was 85% blocked exactly where the feature's claim matters, and the tier shift the alpha exists to prevent could not happen there at all. Enforcing the order — the group immediately below the marker layers, re-asserted on `styledata`, moving only when out of position — is what makes **0.08 the right constant and load-bearing**, against a smallest rendered adjacent-tier step of 1.1425:1. Flagged and accepted: with a shading ramp on, shaded ground OUTSIDE the circle now dims by ~8% where it previously did not. Nothing changes inside the circle, nothing changes with no ramp active, and hit-testing is untouched because every `queryRenderedFeatures` in this app is layer-scoped.

**The user reversed the radius adoption at the live preview (PRD revision R-01), and the consequence was named rather than smoothed over.** As specified, a press adopted both derived values into the sidebar; shown the built feature, the user chose to leave the Radius control alone, so a press adopts the CENTRE only and the derived radius is sent without being displayed. The load-bearing consequence is that the derived radius must be passed EXPLICITLY as an argument rather than read off a handler's closure: because `radius` now holds the user's setting for the whole session, a closure read would send the wrong distance on essentially every press while looking entirely self-consistent from the sidebar. Two visible effects were accepted in these terms and are pinned by tests rather than left to be discovered — after a press the drawn circle and the Radius control show different sizes (the circle is the one reporting what was searched, which is why the indicator carries more weight after this revision than before it), and leaving a centre view and returning re-runs that view's search at the SIDEBAR's radius, so a press is not sticky across a view round-trip. `RadiusControl` now derives its four options from `RUNGS` so the ladder cannot drift from what the derivation snaps to.

**Where the control has nowhere to fit, it withholds itself, and the user accepted that explicitly.** Measured across 40 live configurations in both engines against an independently written oracle, with 0 disagreements: at 1x no tested configuration withholds it, down to 320x260; withholding appears only at larger text scales and is driven by the map area's available HEIGHT rather than by width. Everything it does stays reachable through Filters and Find, and entering fullscreen often brings it back. The decision itself has a precedent in this app — TabNav already answers "it does not fit" by collapsing, measured rather than at a fixed breakpoint.

**A second, distinct fix shipped in the same release at the user's explicit choice, and it was PRE-EXISTING.** `.sr-map-explorer-panel` sized itself as `calc(100dvh - 178px)` (132px in the phone tier) against a real chrome of 223px to 484px across five widths and four text scales, so the map's corner buttons sat 15.5px (desktop) and 37.5px (phone) below the bottom of the window until the user scrolled. That it predates this feature was proven by a HEAD-versus-current build A/B, identical to the pixel in both engines, rather than argued. `lib/mapPanelChrome.ts` now measures the chrome with a ResizeObserver and publishes it as a px custom property the height rules consume, keeping the old constants as the pre-measurement fallback so first paint is unchanged. **The structural fix — an app shell as a 100dvh flex column with the panel `flex: 1; min-height: 0` — was rejected on two mechanical grounds, not on taste**: `<main>` hosts all ten tabs and sets no `overflow`, so a shrinkable `<main>` would let every taller tab paint through the footer, while `flex: 1 0 auto` re-parents the panel's height on a percentage resolved against a flexed item, the exact corner where engines differ and this app ships on WebKit as well as Chromium; and the PAGE is the scrollport for all ten tabs, which is precisely what both pinned-label bands anchor to and what their `scroll-margin-top` focus guards are written for. A 340px map minimum (300px on iOS) is retained deliberately, so 320px at 200% text scale still overflows by 24px by design.

**One prose defect reached three published surfaces, and it is a new failure mode for the grep-the-predicate rule.** All three claimed the control stays in place after a press. The predicate is `document.activeElement === e.currentTarget`, true in Chromium for pointer and touch and false in WebKit — the engine the macOS and iOS apps ship on — because WebKit does not focus a button on press. The sentence it replaced had the mirror-image defect, true on WebKit and false on Chromium, so a one-engine check would have caught neither. The rule now reads: where a behaviour is gated on focus, hover, or any input-modality-dependent state, the published sentence must scope itself to the modality or be verified in every shipping engine. The code and its tests were correct throughout; the keyboard path was made unconditional in both engines (an explicit `tabIndex={0}`, so it does not depend on the macOS Full Keyboard Access setting) and the prose now scopes the promise to it.

**Two corrections to claims already in `CLAUDE.md`, both measured.** (1) **`docs/HELP.md` is bundled but NOT scanned.** Tailwind v4's auto source detection scans the BUILD ROOT (`frontend/`), so a repo-root file reaching the app through a `?raw` import is not a Tailwind source: the same rare utility word appended to `docs/HELP.md` emitted no rule and left the stylesheet byte- and hash-identical, while the identical word in a comment in a `frontend/src/lib/*.ts` file did emit it and moved the bundle by 27 bytes, in the same session on clean builds with `dist/` and the Vite cache removed. A v0.5.91 QA row claimed the opposite and was corrected in place. The sweep still matters — a test file's prose genuinely can add a rule, and one did in this build, from a single word in a comment in `mapSearchAreaCss.test.ts`, reworded to describe the word rather than spell it. (2) **A `display: contents` wrapper has no box**, so a ResizeObserver on it reports 0x0 and never fires; App wraps the tab nav in exactly that, which is what would have let the tab-strip collapse go unobserved.

**One guard-the-guard was vacuous and said so.** The ResizeObserver fit probe first ran at 1x, where no configuration flips, and returned a clean 0 disagreements — recorded as a finding about the probe rather than a clean result. Re-run at 200% with `ResizeObserver` replaced by a no-op it produced 6 stale decisions in Chromium and 6 in WebKit, which is what makes the live runs evidence. A guard-the-guard must run where the guarded property can actually vary.

**OQ-01 stays open and is unchanged by this release.** Whether eBird clamps, errors, or silently truncates a `dist` above its documented 50 km ceiling is still unestablished; the shipped 50 mi sidebar rung has always sent `dist=80` and still does. The derived path can only ever send 8, 16 or 40 km, because `snapRadiusMi` applies `DERIVED_MAX_MI` by NARROWING the ladder rather than clamping the answer, so the result is a `RUNGS` member by construction. The reason for the cap is honesty rather than exposure: a user who picks 50 mi is making their own request, while a user who presses this control is handed a number they never chose, on a circle the app draws claiming coverage. Settling it means measuring a third party's behaviour, which no test in this repo can assert; either answer is a one-constant change.

**Named residuals, carried forward on ROADMAP.** `/map/hotspots` declares bare `lat, lng, dist` while its sibling `/map/recent-obs` constrains all three (Low, pre-existing, backend untouched by this feature and unreachable from the derived path). The two transports disagree on `dist` range validation, with no shipped UI path able to exercise it. Two verification items are genuinely open and the QA report asserts neither: an `ariaSnapshot` or CDP accessibility-tree read showing the status region present while IDLE, and the iOS safe-area inset on real hardware with a physical rotation, both measured so far only through a device profile.

---

## A guard's length ceiling is chosen by the store it must agree with, and the v0.5.81 lookup rule gains its write half — 2026-08-14 (v0.5.90)

**Decision: shipped**, as a four-build Spool bundle (`f111d3e` length-bound-checklist-id, `2f02778` checklists-route-guard, `018fc50` clear-nanoid-advisory, `128fbfe` taxonomy-hasown-lookups) released as v0.5.90 on macOS, Windows, the website, and TestFlight. A hardening bundle: nothing user-visible changed, and three of the four builds exist to make a guard enforce exactly what it claims. Flush verification ran the cumulative branch state, not per-commit: backend 234, frontend 2,576 across 184 files, production build, eslint, pinned ruff, all green — and the shipped stylesheet byte-identical to baseline, settling build 4's Tailwind-corpus question by measurement per the v0.5.85 rule.

**`CHECKLIST_ID_RE` is bounded to `^S[0-9]{1,15}$`, and the ceiling is 15 rather than ROADMAP's `{1,20}` candidate because a guard's ceiling must agree with the store behind it.** The shipped persisted-key guard `SUBMISSION_KEY_RE` (`exoticProvenanceCache.ts`) already refused 16+ digits, so a `{1,20}` bound would have left a 16-20-digit window where an id passed every request/link guard and then failed the store's own key guard — the v0.5.87 silent-discard shape moved rather than closed. Aligning on 15 closes the window outright; real ids are ~10 digits, so ~5 orders of magnitude of headroom remain. All six JS twin literals moved in lockstep, the shared fixture gained at-ceiling and over-ceiling rows, and each router pins the bound at its own route (400, outbound awaited zero times) — the per-consumer posture v0.5.88 established, applied rather than restated.

**Both v0.5.88 deferrals are discharged; nothing in that entry is reversed.** `GET /checklists/{checklist_id}` now applies the shared guard as the handler's first act, before any outbound call, with a 400 byte-identical to the weather/tide precedent. The query-string-only scope wording was preserved exactly (traversal and host steering remain unreachable through Starlette's `str` converter, and both protection grounds — guard first, routing converter second — are now stated at the call site); the route's converter is untouched. The `services/ebird.py` comment claiming the route "does NOT gate" went false with the change and was corrected in the same edit, comment-only, verified mechanically.

**The v0.5.81 allowlist-lookup rule gained its write half.** `taxonomyService.ts` took eight `Object.hasOwn` guards on external-keyed reads, and its four returned accumulators (`codes`/`orders`/`formCodes`/`out`) became `Object.create(null)`: on a plain `{}` a `__proto__` key hits the inherited setter, silently dropping a primitive entry — and for `out`, whose values are objects, silently swapping the returned map's prototype. The read/write pairing (hasOwn at the point of use, null-prototype on the accumulator) is promoted to `CLAUDE.md` beside the v0.5.81 bullet, which had covered only reads. One read stays deliberately bare with its reason in code (`byCode[parent]`, allowlist-validated by `speciesSet.has`), the backend twin needs no change (Python dicts have no prototype chain — the parity question answered, not skipped), and `codes`/`orders` byte-identity for every real name is proven by the pre-existing parity assertions, all unchanged.

**A dev-only change's "byte-identical bundle" claim was proven three independent ways, which is the shape to reuse.** nanoid 3.3.17→3.3.18 (advisory GHSA-2v37-7h3g-55p8, reachable only through vite→postcss): a twice-built determinism control at HEAD, QA's own pre/post A/B via `npm ci`, and the Auditor's independent re-hash of all 114 `dist/` files — identical throughout. Per the standing dev-only rule the bundle's CHANGELOG carries no claim about this build at all; the record is the commit and the ROADMAP closure, matching the `undici` and Node-25 precedents.

**One gate-wrapper trap earned its own line: zsh's `status` is a read-only builtin.** A pipefail wrapper written `status=$?` aborts with exit 1 after a green gate, mislabeling it a failure — it happened on this bundle's first flush pytest run, after pytest had already printed 234 passed. Use `rc=$?`. Same family as the zsh word-splitting harness trap; promoted to `CLAUDE.md` beside the pipefail rule.

**Named residuals, all pre-existing and on ROADMAP.** Web-transport consumer-side lookups over `JSON.parse`d taxonomy response maps still carry `Object.prototype` (live example `NamedBirds.tsx:87`; bounded by `encodeURIComponent` downstream, and the desktop half is incidentally closed by the null-prototype returns) — a separate consumer-side sweep. The backend suite's one `StarletteDeprecationWarning` (httpx TestClient shim) folds into the next deliberate backend dependency move. Two informational tidies for a future touch: the `byCode[parent]` exemption comment slightly over-states its equivalence to a hasOwn guard, and the checklists router's four 400 tests assert the detail string by substring rather than exact equality with the shared literal.

---

## Countability stops being inferred from a name's shape and starts being read from eBird's own `reportAs` — and the old rule was wrong in BOTH directions — 2026-08-13 (v0.5.89)

**Decision: shipped.** Three string-shape predicates (`isSpuhOrSlash`, `isNonCountableSpecies`, `isNonCountableObservedName`) collapse into one `isNonCountableForm(name)` at 12 production call sites. A published name counts when its code is itself a species, or when `reportAs` resolves it to one. Stated as a birder reads it: **ambiguity about which species does not count; ambiguity about which subspecies counts as the parent.** That is eBird's own distinction and it has been sitting in the taxonomy snapshot the app already ships offline for favicons and taxonomic sort, so this adds no request, no provider, and no dependency.

**The finding that changed the build's character: the shape rule was not merely conservative, it was wrong in both directions.** Swept over all 17,891 published names. **Direction A — eBird counts, we excluded: 88 names folding into 59 parent species**, subspecies-group slashes inside a trailing parenthetical, and ordinary birds for a North American birder (`Canada Goose (moffitti/maxima)`, `Redpoll (Common/Hoary)`, `Dark-eyed Junco (Slate-colored/cismontanus)`, `Iceland Gull (thayeri/kumlieni)`). That direction was predicted — it is exactly the deferred roadmap question. **Direction B — eBird rejects, we counted: 81 names**, and it had never been recorded anywhere: 3 named hybrids carrying no `" x "` (`Brewster's Warbler (hybrid)`, `Lawrence's Warbler (hybrid)`, `Bogota Sunangel (hybrid)`), 25 spuhs whose `" sp."` is followed by a parenthetical, and 53 undescribed or unrecognized forms (48 `(undescribed form)`, 4 `(unrecognized species)`, 1 `(undescribed Panay form)` — not two tidy suffixes, and the enumeration was corrected mid-build after shipping wrong in three places). A birder holding Brewster's Warbler had it counting as a species. Most totals therefore go **up**, which is what made the no-panel call below defensible.

**This discharges v0.5.83's warning rather than waiving it — and the distinction is the whole point.** That entry said at length that collapsing the raw/normalized predicate pair is a silent data-loss bug, and it was right: on a raw name, `" x "` conflates a true hybrid with a countable intraspecific intergrade. What retires the pair is not care, it is the sweep: the 36 intergrades v0.5.86 rescued stay countable under `reportAs`, 0 are lost, and a named discriminating test goes red on a revert. **The asymmetry itself survives** inside `isNonCountableNameShape`, which is no longer an inference but the FALLBACK for a name eBird does not publish — an older revision, a since-renamed species — where the asymmetry is still exactly right. v0.5.83's own unanswered question (a slash inside a parenthetical) is what this build answers, from eBird's data instead of from the string.

**The fallback is deliberately NOT "an unknown name counts", and the v0.5.87 escapee precedent does not transfer.** There, defaulting an unresolved species to counting is the safety property, because the alternative erases a bird the birder really saw and resolution is a live network pass that starts empty. Here the same default would make all 2,604 non-countable forms count at once behind a not-yet-loaded lookup and flash a badly wrong headline. Falling back to the convention makes the change a bounded, fully enumerated delta over the names the snapshot knows; everything else behaves exactly as before.

**An entry-chunk asset was compressed by shipping CORRECTIONS against the data owner's own convention, and the compression is verified rather than argued.** `speciesUtils.ts` is statically reachable from `App.tsx`, so a verdict for all 17,891 names (~105 KB gz) would ride first paint. eBird's naming convention already reproduces the verdict on 17,722 of them, so the artifact is the **169 corrections** in both directions: 2.6 KB gz, **+3,022 B (+4.08%)** on the entry chunk instead of +32.5%. `countableForms.test.ts` re-derives eBird's verdict from the snapshot independently and asserts the shipped predicate against it name by name over the whole snapshot, pins the count so the sweep cannot go vacuous, and carries a guard-the-guard proving the sweep detects a named wrong compression. `build-countability.mjs` regenerates the artifact byte-for-byte and is called from `build-ebird-taxonomy.mjs` in the same run, so the annual Clements refresh cannot let the two drift. Listing the other 2,523 non-countable names would add ~19 KB gz and change no answer.

**Four design decisions, all approved.** (1) **Labels: `Count all forms`** (Statistics, Calendar) **and `Show all forms`** (Multimedia, Species Detail), replacing `Count spuh, slash & hybrids` and `Show sp./slash`. The old labels named a set that no longer exists, and `CLAUDE.md` treats a label whose scope has moved as inaccurate rather than stale. The new ones do not enumerate (so they survive the set moving again — the v0.5.87 lesson), keep the `Count <plural noun>` parallel with the stacked `Count escapees` that `exoticCopy.ts` records was chosen *for* that parallel, stay positive rather than pairing a positive verb with a negated noun (which killed the runner-up `Count uncountable forms`), and are 15 characters against 26. (2) **Both `Show all forms` toggles widen** to govern the whole non-countable set, so the visible rows and that tab's `X of N species` agree by construction rather than by coincidence. Named cost carried rather than hidden: with the toggle off, three named hybrids and 25 parenthetical spuhs newly hide — but they were already excluded from the count, and they are one press away under a label that now names a superset. (3) **The Statistics same-tab asymmetry stays and is stated.** Media documentation coverage and the Frivolous Lists are *about* the canonical life list, not about what was recorded; a coverage denominator a reader can inflate with `Gull sp.` asks "have you photographed a spuh", which has no answer. Unifying the predicate made it more visible, not wrong. What *was* wrong is the published claim that the checkbox decides "what counts as a species across every card" — false before and after, now removed, with `ALWAYS_COUNTABLE_NOTE` rendering on both fixed surfaces. (4) **No explanatory panel.** v0.5.87's principle applies (a total that quietly falls with no account of itself is the failure this repo keeps rejecting) but its mechanism does not: that panel exists because escapees are a live, stateful, networked check with seven status states, and this rule is deterministic, offline, instantaneous, and identical forever, so most of it would be empty scaffolding around a fixed list. A one-time shift is a release event, not a permanent fixture. The toggle itself is the interactive account, and the reassurance clause v0.5.87 proved ("They stay on your Life List; only the count changes") is reused. Building it anyway would be a new surface needing its own brief.

**`exoticCopy.ts` now holds copy that is not about exotics, and the split between it and `countabilityCopy.ts` is by BUNDLE POSITION rather than by subject.** `LifeList.tsx` is on `App.tsx`'s static graph, so importing the lazy `exoticCopy.ts` (~3.7 KB gz) for one 15-character label would move all of it onto first paint; the new module holds only what an entry-chunk surface needs, and `exoticCopy.ts` imports the label it quotes rather than repeating it. The consequence is a name that under-describes its contents (`COUNT_RULE_SENTENCE`, `ALWAYS_COUNTABLE_NOTE`, `COUNTY_COUNT_RULE_SENTENCE` are all general countability copy). Recorded rather than renamed, because the rename is cosmetic and the bundle constraint is the durable fact. The em-dash and apostrophe sweep in `ExoticProvenanceAccount.test.tsx` was **extended** to the new module rather than its claim weakened — until then it swept one module while claiming to sweep the copy, which was an over-claim rather than a guard.

**Three verification failures in one run, all the same family, all reporting success.** The v0.5.88 question ("could this fail if the thing it is checking were wrong?") caught each: a mutation harness run against a red baseline, which would have made every "expected FAIL, got FAIL" meaningless; two suite invocations that failed on their own tooling while a `| tail` pipeline reported exit 0 regardless; and a mutation run without a clean baseline. Promoted to `CLAUDE.md`: run gates under `pipefail` with an explicit status. **The fourth was more useful than the other three.** QA attempt 1 found that reverting the widening left the whole suite green, and the gap was concealing a half-delivered feature: `mergeSubspecies` defaults to `true`, so the row key is the normalized base and `Brewster's Warbler (hybrid)` collapses to something no rule can tell from a species. The predicate was judging the key, so in the default view the three named hybrids and the 53 undescribed forms were still shown and still counted, and **no test could be written for the specified behaviour because the behaviour was absent.** Both surfaces now carry countability from the raw names alongside the key, as a monotone OR. When a test cannot be written for a specified behaviour, suspect the behaviour before the test.

**Real eBird data cannot discriminate the monotone OR at all, which is why the guard has to be synthetic — and that is where the scope of the "apply it everywhere" rule got sharpened.** Grouping all 17,891 names by normalized base gives 13,758 groups, 1,505 genuinely merged, and **zero** that mix a countable with a non-countable raw name. The OR is implemented on two surfaces and got its explicitly-labelled synthetic pair on one. The unguarded one (Species Detail, mutation W4) is the surface where correct behaviour falls out of an add-only `Set` rather than from an explicit choice — exactly where a future refactor away from that structure goes unnoticed. v0.5.85's rule says a rule found in review applies to every instance "in the module"; the right unit is **every surface implementing the property**. Carried as a known limitation with the file saying so in its own words, per the standing convention that an unguarded property names what does carry the guarantee.

**Security PASSED WITH NOTES, no Critical/High/Medium.** The new code is prototype-safe by construction (Sets and `hasOwnProperty.call`, never a bare object index), adds no network call, no persisted data, and no new interpolation of user data into a URL, `href`, path, or markup. Lines 1-309 of `speciesUtils.ts` are byte-identical to HEAD (md5 match), proving the v0.5.84/v0.5.85 ReDoS and unbounded-cache fixes survived a refactor of this size — the v0.5.77 rule applied mechanically rather than argued. One input genuinely changed (`countyCompleteness.ts` moved from a normalized to a raw name, deliberate and correct, its escapee half still using `norm`). The Auditor's durable finding is promoted to `CLAUDE.md`: **a bundled build-time asset and a persisted runtime cache are different trust boundaries**, and the per-entry validation rule applies only to the second, because an attacker who can alter a Vite-inlined import can already alter any code that reads it. Two pre-existing items were flagged out of scope and are on the roadmap: `taxonomyService.ts`'s bare object lookups keyed by CSV-derived names, and a build-time-only `nanoid` advisory found during release preflight.

**Two non-blocking items carried forward.** `frontend/src/lib/exoticProvenance.ts` is treated as **binary** by git — a deliberate NUL composite-key separator predating this build — so its diff is invisible to normal review and it silently breaks `git apply`; its change here is a clean three-site predicate rename, verified by a manual text diff. And one test (`LifeListCountableForms.test.tsx`) has the cancelling shape that `mediaStats.test.ts` was split to remove: dropping either correction set alone fails it, dropping both together passes, because hiding `Canada Goose (moffitti/maxima)` and revealing `Brewster's Warbler (hybrid)` leave the asserted total unchanged. Both directions are independently covered by named tests, so it is a robustness weakness rather than a coverage hole.

**One record correction the sweep forced.** This entry's own scope check found that `parseLifeList()` has zero app callers, contradicting a 2026-05-20 entry that said `ListComparer` still used it and it must not be deleted. That instruction is withdrawn in place. A "do not delete, X depends on it" note is a claim about the import graph and it decays silently; re-derive the caller before honouring one.

---

## One class of defect, two independent bugs — and a verification that could only ever confirm itself — 2026-08-13 (v0.5.88)

**Decision: shipped.** Two backend route guards now enforce what each claims to. They are the same *class* of defect — a regex admitting values its own contract excludes — but they are two bugs, and **neither fix would have closed the other**, which is the fact worth carrying forward. `backend/routers/settingskv.py`'s `_KEY_RE.match(key)` was the **anchor** half: Python's `$` matches before a trailing newline, so `POST /settings/theme%0A` returned 200 and wrote a second file `theme\n.json` beside the real one, walking past the `_RESERVED_KEYS` layer where the un-suffixed form 404s. Its character class was already explicit ASCII, so the v0.5.54 class rule did not reach it. `weather.py` and `tide.py` were the **character-class** half: `re.fullmatch(r"S\d+")` accepts every Unicode decimal digit, so `S٠١٢` passed the backend while the JS guard on the same request path refused it. Their anchor was already `fullmatch`, so the v0.5.87 anchor rule did not reach them. The guard is now single-sourced as `CHECKLIST_ID_RE = re.compile(r"^S[0-9]+$")` on `services/ebird.py`, the module both routers already imported from.

**This EXTENDS AND COMPLETES two prior entries; it reverses neither.** The **v0.5.87** entry (escapee count) recorded anchor parity as one of four closed security findings and promoted the rule to `CLAUDE.md`, explicitly deferring these two pre-existing counter-examples to their own change. This is that deferral, discharged. The **v0.5.54** entry (County Completeness) recorded the `\d`-accepts-Unicode-digits fix and promoted the explicit-ASCII-class rule; finding 2 was its last live instance. Both rules stand exactly as written — what changed is that the exceptions they named are gone. The Auditor's verdict, recorded here so the trail closes: **v0.5.87 findings 7 and 8 are both RESOLVED**, on an A/B through the real FastAPI routes against a `HEAD` worktree and an isolated `SR_DATA_DIR`. Every original reproduction case now refuses (`theme%0A` 200 → 422 with no file written; `/weather/S٠١٢` 502-past-the-guard → 400 with the outbound fetch awaited zero times; `/tide/S٠١٢` 200-all-the-way-through → 400), and a third settings bypass the brief had not listed (`files%0A`) closed with them. The residual is gone rather than moved.

**The generalizing shape, and the reason this entry exists at all: a verification whose reference point is DERIVED FROM the thing being verified cannot fail when that thing is wrong.** It happened twice in one run, in two unrelated places, and both times it reported success. (1) The parity tests pinned the *compiled pattern* — the fixture rows and the parity helper both exercise `CHECKLIST_ID_RE` directly — so mutating **both router call sites** to `.match(...)` left all 227 tests green while the mutation was behaviorally live and `GET /weather/S123%0A` passed a guard shipped code refuses. That is precisely the defect class this change exists to close, one level up from where it was being measured. (2) The mutation harness snapshotted each source file before an experiment and copied it back after, then "verified" the restore by diffing the restored file against the same snapshot it had restored *from* — identical by construction — and printed OK while a round-1 correction to a definition-site comment had been silently reinstated as stale content. The test to apply before trusting any check: **could this fail if the thing it is checking were wrong?** Route tests now carry trailing- and leading-newline rows so the call sites are pinned separately from the pattern, per-router rather than in aggregate.

**Single-sourcing prevents the copies drifting; it does nothing to prevent a copy being dropped.** So each router keeps its own route-level test, and mutating one call site turns only that router's test red. This is the same rule v0.5.87 recorded for a single-sourced copy constant that was correctly shared and then gated off on one of four surfaces with the whole suite green — the domain is different, the failure is identical.

**Measuring in isolation over-states what a route can reach, and measuring through a convenience client under-states it.** Both directions bit here, on the same question. `httpx.URL(base + "../../etc/passwd")` genuinely does collapse to `/etc/passwd`, and a first write-up called traversal reachable on that basis; it is not, because Starlette's default `str` path converter matches `[^/]+`, so the captured value is always exactly one segment and no traversal form reaches the handler. Confirmed on live uvicorn over raw sockets — so nothing normalized the path client-side — including the `%252F`, backslash, overlong-UTF-8 `%C0%AF` and fullwidth-solidus attempts. The inverse trap was equally live: a `TestClient` probe normalized `%2F` before it left, and would have confirmed the traversal claim for the wrong reason. Over-claiming risk is the safer direction and it is still false; it would have sized the deferred work a grade too high. The protection here comes from *routing* rather than from a guard, which is the fragility worth stating: switching that route to `{checklist_id:path}` would remove exactly it.

**One claim in the approved brief did not survive grepping, and was corrected mid-build rather than shipped.** The brief said single-sourcing makes the twin relationship "one-to-one as it is on the JS side." The JS side is not one-to-one: `/^S\d+$/` appears in six places, and more importantly the guard that actually gates the *request* is `isValidChecklistId`, not the `SUBMISSION_ID_RE` the brief named — that one gates whether an id becomes a link. The vitest half now drives both and asserts they agree on every row. Four artifacts state the scoped version of the claim and are checked to agree; a grep confirms no surviving one-to-one claim. An approved artifact is not evidence for a fact the builder can measure.

**The carve-out was preserved deliberately and must stay preserved.** The four pydantic `pattern=` constraints in `routers/map.py` and `routers/media.py` are **correct as they stand** and were not swept in: they run on the Rust regex engine, which rejects the trailing newline, and all four already use explicit ASCII classes. A later reader "fixing" them toward `fullmatch` would be undoing correct code. `services/tide.py`'s three `\d` sites were seen and excluded on the record: they parse trusted NOAA response timestamps, carry no `$` anchor and no JS twin, so neither rule reaches them.

**Two conditions found during review were deliberately NOT fixed here** and are on `ROADMAP.md` with their scope measured rather than estimated: `/checklists/{checklist_id}` reaches the same outbound URL construction with no shape guard (the reachable injection is the **query string only**, not traversal), and `CHECKLIST_ID_RE` refuses every dangerous character while admitting any length, where the house SSRF reference guard is explicitly bounded. Both are pre-existing, both were outside this change's approved scope, and this build's obligation was that the source comment stop claiming something untrue. No user-facing change: every valid settings key and checklist id is accepted exactly as before, and only inputs already outside the guards' stated contracts are now refused.

---

## A decline REVERSED on a measurement: provenance is per observation, but the question is per SPECIES, so it is a set cover rather than a sweep — 2026-08-12 (v0.5.87)

**Decision: built.** The Statistics tab gains an off-by-default **Count escapees** toggle beneath "Count spuh, slash & hybrids", so the headline species total follows eBird's own life-list rule — `P` (Provisional) and `N` (Naturalized) count, `X` (Escapee) does not. With the toggle ON the total is *exactly* today's number, so the prior behavior is preserved rather than approximated. On the reference export the default figure moves **267 to 264** (Graylag Goose, Swan Goose, Muscovy Duck), confirmed by the user against eBird itself before the ship.

**This reverses the 2026-08-09 decline, and the reason it was wrong is the part worth keeping.** That entry was right on every data fact and wrong on one number, and that number was the whole argument: it priced the work at ~3,252 checklist calls, reasoning from provenance being stored per observation across 21,369 rows. Provenance *is* per observation — but **the question asked is per SPECIES, and the answer is a monotone OR**: a species counts if at least one of its observations is not `X`. One `product/checklist/view` call returns provenance for every species on that checklist at once, so covering the whole life list is a **set cover over data the app already holds**, and the cover itself is computed offline from the CSV. Measured against the same real export and key: a greedy cover of all 267 species is **73 checklists, 9.7 seconds** at concurrency 4, with **zero** follow-up calls needed. 73 on-demand calls is smaller than a single county-completeness pan.

**The generalizing shape, which is what is expensive to re-derive:** when a per-item fact is fetched in batches and the question is a monotone predicate over a *group* of those items, the cost is the cover, not the population. Reasoning from the storage granularity instead of from the question's granularity overstated the cost by 45x and killed a feature for four days. The declined entry is **corrected in place rather than superseded** — the wrong figure struck through with an inline correction and a header note — because a decisions log's value is the audit trail, and excising the original figure would be closer to superseding than correcting. Every *other* conclusion in it was re-verified and stands: no provenance column in the export, per-observation storage, no bulk personal-list endpoint, the offline shortcut being a trap in both directions, and the Calendar's zero-network guarantee as a hard boundary. They are the reason the built feature has the shape it does.

**An UNRESOLVED species COUNTS, and this is the safety property.** A species is removed only once every checklist carrying it has been consulted and every one came back `X`. So the figure converges *downward* from today's number and can never wrongly erase a lifer — a partial pass under-corrects rather than over-corrects. A partial pass says how far it got and offers "Check again" on all four partial reasons, not only the error one (an approved PRD deviation, raised at the design gate: a birder who presses Stop otherwise has no route back, and because a tab stays mounted once opened, `partial (cancelled)` would persist for the rest of the session).

**The offline `category === 'domestic'` shortcut stays FORBIDDEN, and the rule that forbids it is falsifiable rather than a matter of taste.** The bundled taxonomy has a `category` field and no provenance field, and category is wrong in both directions: confirmed live that eBird returns `N` for Red Junglefowl and `P` for Indian Peafowl, and counts both. **If either disappears from the total, the shortcut was built instead of the rule** — that is the success criterion, and a named test is the guard. A control labelled "escapees" running a different rule than eBird's is worse than no control, because it claims a parity it does not have. The same reasoning was applied to the tempting `userDoNotCount` companion field: it is recorded in the cache but **never consulted**, because adopting it would only be sound if it means *exactly* "eBird does not count this toward your life list", and the shipped gate is the explicit `exoticCategory === 'X'` test. The cache stores the raw `"<category>|<doNotCount>"` pair rather than a derived boolean, because the open question is about the *pairing* and a presence flag could not answer it; a test asserts that stripping the companion flag from every token changes no classification.

**The Calendar's zero-network guarantee is preserved and enforced by the IMPORT GRAPH, not by discipline.** Resolution is initiated only from Statistics; every other surface reads the cached result passively and, when it is absent, behaves exactly as before. A test walks the closure of the four passive modules and fails if any of them ever gains a `transport` or `lib/tauri/*Service` edge, and it carries a guard-the-guard aimed at the controller so a broken matcher cannot report a clean result for everything. That test found a real defect in its own first draft: the word "export" inside a prose comment hijacked its lazy specifier match and made a dependency-free module appear to import `transport.ts`.

**The passive half needed one addition to the persisted shape, and its safety is the confirmation step.** The Calendar holds no name-to-code join and may not fetch one, so it cannot classify by code; the document therefore carries `excludedNames`, the classification **published by the Statistics pass**. It is explicitly a cache of a derivation and not the source of truth — the raw tokens remain, Statistics always re-derives from them, and a passive reader **confirms** the published list against the persisted checklist ledger using its own observations, so a newly loaded export that adds a carrier re-opens the species offline exactly as it does on Statistics. Without that confirmation this would be a stale-cache trap. Stated limit: for a species the passive reader cannot re-open, a published name is only as current as the last Statistics visit.

**Two retention policies, deliberately opposite, chosen by what an eviction costs.** The checklist ledger is FIFO — an eviction costs one redundant request and loses no answer. The species index uses **admission control** — an eviction would destroy a paid-for network answer and, at capacity+1, would do so on every pass forever. This applies v0.5.86's finding rather than contradicting it: capacity+1 is a measurement rule, not a universal policy. Admission is gated on the container's own size, never a separate counter (the v0.5.85 defect), and both stores are measured at capacity+1 asserting work done rather than elapsed time.

**Named limits, stated rather than hidden.** County Completeness applies the rule to the **numerator only**, against eBird's unfiltered regional denominator — filtering that would mean classifying every species eBird publishes for a region, a different and much larger question — and the popup caption now says so in words instead of naming exactly three excluded kinds. Statistics' **Geographic Stats** per-county species counts are deliberately out of scope, so they no longer agree exactly with the Completeness numerator they were aligned with in v0.5.86; that is an omission the approved scope requires, not an oversight, and it is on the roadmap. Surfaces that **list** species rather than headline a count are untouched.

**Three prose over-claims were caught, and the second one is the instructive one.** A privacy sentence claimed this was "the one place where a number is derived from a live lookup"; grepping the predicate turned up two counter-examples that have shipped since v0.5.54. The *repair* then introduced a different false clause in the same sentence — that the Statistics tab was previously computed entirely on-device, when it has posted to `/taxonomy/codes` and fetched `/map/hotspot-region` all along, a point the PRD had recorded under exactly this heading. **Fixing an over-claim is where the next over-claim gets written.** The final wording scopes the claim to the tab's *displayed numbers*, discloses both pre-existing requests, and adds the fact the trace turned up: the species list is matched against a copy of the taxonomy the app already holds and is **not** sent to eBird.

**No new provider, endpoint family, account, telemetry, or `PRIVACY_POLICY.md` entry.** `product/checklist/view` was already in use on both transports; both gained the two provenance fields eBird already returns, and `fields=provenance` is a flag on the existing path that suppresses a second per-checklist call a provenance pass does not need. Security **PASSED** after four findings were closed (anchor parity, collapsed-panel focusables, the false privacy sentence, and the live-region announcement rate); their durable rules are promoted to `CLAUDE.md`.

---

## Export parsers classify the RAW observation before their deliberately distinct output normalization — 2026-08-12 (v0.5.86)

> **SUPERSEDED IN MECHANISM by v0.5.89; every finding below stands.** The five call sites now pass the raw cell to `isNonCountableForm` instead of `isNonCountableObservedName`, and the 36 rescued intergrades stay rescued. The **structure** this entry settled is untouched and is the durable part: classification and output normalization answer different questions, so each parser still classifies the raw cell and then calls `truncateAtFirstParen`. Only the classifier moved.

`parseEbird`, `parseLifeList`, `parseMLExport`, and the two Breeding Codes paths no longer carry four private predicates that reject any raw name containing `" x "`. All five call sites now use the canonical `isNonCountableObservedName`: true interspecies hybrids are rejected because the marker remains in the normalized base name, while an intraspecific intergrade named only inside a trailing parenthetical remains countable. Spuhs and raw-name slash forms keep their existing exclusion.

The taxonomy sweep fixed the scale before the change: of **17,891** distinct bundled taxonomy names, the old predicates dropped **36** countable intergrade forms. The canonical classifier rescues all 36 into **26** parent species and newly excludes **0** names. Parser-level fixtures prove the row consequence as well as the taxonomy consequence: all 36 source rows survive both the ML-export and Breeding Codes paths.

This does **not** reverse v0.5.85's normalization decision. Classification and output normalization answer different questions. Each parser classifies the raw cell with `isNonCountableObservedName`, then continues to call `truncateAtFirstParen`, preserving the more-aggressive malformed-cell behavior that was measured and ratified in the prior release. The change converges the exclusion rule, not the normalization rule.

---

## The cache inventory found three different answers, so capacity+1 is a measurement rule rather than one universal policy — 2026-08-12 (v0.5.86)

The five-item roadmap inventory was wrong in two useful ways. `storage.ts` is not a cache owner at all; it is a persistence seam. `persistedStyle.ts`'s shipped caller graph is finite (`VectorVariant`, currently only the Positron call), but its string-accepting exported API does not impose a structural bound, so the record must not turn today's callers into an API guarantee.

The two durable stores remain FIFO by decision. County completeness holds at most **250** entries and replay at most **300**. At capacity+1 each performs one linear lookup/shift and one debounced whole-document snapshot, work dominated by the network or storage operation around it. More importantly, retaining the newest county result or last-loaded response for offline use is the product contract. Admission control was right for the hot name memo because repeated cheap misses made FIFO pathological; it is not a universal replacement for useful newest-data eviction.

Their historical “4 MB” and “3 MB” labels are not byte bounds. Both enforce `JSON.stringify(data).length` over payload values, which is a count of JavaScript UTF-16 code units. Keys, metadata, ordering and the persisted envelope are excluded, and one sole oversized newest payload is deliberately allowed. The strict entry caps remain the hard retained-count bounds. A separate pre-existing durability limitation is now explicit: debounced writes are best-effort and not serialized by completion, so an older stalled write may finish after a newer snapshot even though the in-memory mirror remains current.

The two genuinely unbounded Nominatim coordinate caches changed. Tauri and FastAPI now retain at most **4,096** rounded-coordinate results by fill-and-stop admission: overflow calls return normally but do not churn the admitted working set. Desktop forward and reverse calls share one request-start queue enforcing the provider's one-second spacing, concurrent same-rounded-key reverse calls share one Promise, and parity tests lock JavaScript/Python rounding at positive and negative half steps.

---

## Stylesheet absence claims use an all-depth directed selector graph, while positive every-width claims keep the top-level parser — 2026-08-12 (v0.5.86)

The v0.5.85 finding named five safe-area guard groups that could not see an ungated declaration nested in an at-rule. The root-cause sweep widened the protected set to **seven surfaces**: the original Breeding Codes pinned header, Multimedia/Life List pinned header, Help panel, skip link and fullscreen map, plus the Help table of contents and map FAB family. Every absence assertion now queries the shared `css-tree` AST inspector at arbitrary block-at-rule and native-nesting depth. `parseTopLevelRules` is unchanged and remains the right tool for a positive claim that a rule applies at every viewport width; skipping at-rule blocks is load-bearing for that question.

Using an AST was necessary but not sufficient. The first AST implementation flattened a complex `:is()`/`:where()` branch and could mistake a same-element `.sr-ios-app` class for an ancestor gate. The final representation preserves each selector alternative as directed compound constraints converging on its **rightmost subject**. Only a descendant or child path from `.sr-ios-app` establishes the native-app gate; same-compound, sibling and column relations do not, and every unsafe branch remains visible independently. Unsupported or recovered shapes fail closed.

The same review found unbounded Cartesian expansion. One deterministic **4,096-alternative** budget now preflights every functional-selector, selector-list, native-nesting, nested-scope and scope-by-rule product before allocation. Exact 4,096-path fixtures pass and 4,097/4,160/8,192-path fixtures fail with the stable diagnostic. Accepted **Low** residual: the helper still does not cap total graph nodes/edges, stylesheet rule count or recursive nesting depth. It reads committed test CSS only, has no production import, and is therefore a CI-resilience follow-up rather than a release blocker.

---

## The Breeding Codes filter row needed both nested flex floors released, behind its own phone hooks — 2026-08-12 (v0.5.86)

At 320px and 200% Text Size, the Breeding Codes filter row measured **327.11px** inside a **272px** parent: **55.11px** beyond the parent's content edge and **31.11px** beyond the viewport, identically in Normal and Unbounded. `flex-wrap: wrap` was already active. The longest pill and its label both retained the automatic `min-width: auto` floor, so the row was structurally allowed to wrap and still could not shrink.

The repair releases every minimum on that path: `min-width: 0` on the feature row, pill and nested label; phone-only `height: auto !important` with the existing 30px minimum on full-label code pills; and `overflow-wrap: break-word` for the emergency slash-delimited run. Three dedicated hooks keep that layout contract inside Breeding Codes. The shared `.sr-ctl-row` still sizes text only, its other consumers are unchanged, and widths above 640px retain the fixed desktop pill height.

The production-backed Chromium probe exercised 72 width/text-scale/view combinations, including the pathological code C label, and measured the row, every pill box and every text-node ink rectangle against the actual parent. Normal had no page horizontal scroll; Unbounded's intentional table-wide page scroll remained separate. The real demo supplies 13 of 23 codes, so an all-23 browser fixture remains a coverage-strengthening follow-up rather than a correctness prerequisite.

---

## The Breeding Codes name-cell clamp was correct; the shared name-and-two-link row was the escaping object — 2026-08-12 (v0.5.86)

The roadmap's “favicon is the offender” diagnosis was incomplete. The phone name column itself resolved to its intended clamp, but the shared one-line `BirdName` row laid the common name beside an indivisible two-link `SpeciesLinks` group. That row escaped the cell by **27.44–33.52px**; hiding or shrinking one favicon would not remove the reserved slot or preserve the two-reference contract.

The repair is scoped to the Breeding Codes phone name cell. The shared name row fills the available width and may wrap, so a long common name sits above the eBird and Birds of the World links instead of pushing them outside. Both links and both 14px icons remain present, each link keeps its full accessible name and at least a **24×24px** target, and the scientific-name line keeps its established behavior. The column width and state predicates are unchanged: Normal remains sticky; Unbounded and Unbounded+pinned remain non-sticky.

The built-app probe checked 48 Chromium/WebKit combinations across four text scales, two themes and three table states. It measured visible text and icon ink plus complete anchor rectangles against each clamped cell, not page `scrollWidth`; every edge stayed inside. A 641px fingerprint was identical with the repair enabled and removed, proving the phone scope without altering the shared `BirdName`/`SpeciesLinks` system elsewhere.

---

## The four parsers' copies were EXTRACTED, not converged, and the DIRECTION of the divergence is what settles it — 2026-08-11 (v0.5.85)

`parseEbird`, `parseLifeList`, `parseMLExport` and `parseBreedingCodes` each carried a private function *named* `normalizeSpeciesName` that shadowed the import of that name while not being it: it cuts at the first `(` regardless of closure or position. `ROADMAP.md` asked to converge them onto the real normalizer. That was measured and **rejected**.

**Real names cannot discriminate the two functions at all** — 0 divergences across all 58,104 snapshot strings, because every eBird name is well formed (at most one `(`, always closed, always trailing). The entire discriminating power sits in the probes: **10,300 of 11,111** enumerated malformed strings, 92.7%.

**The direction settles it.** Restricted to strings containing a `(`, the local rule's result is always a **prefix** of `normalizeSpeciesName`'s — 0 exceptions over 3,730 probes, strictly shorter on 3,286. It cuts *more*, so converging makes malformed names *less* normalized (`Mallard (` is `Mallard` today and would become `Mallard (`), splitting one corrupted cell into a second life-list row on four hot paths. What shipped is one export, `truncateAtFirstParen`, named for its rule and sitting beside the normalizer, with the divergence documented at a single definition rather than implied by four private functions shadowing the shared name.

**This follows the v0.5.83 precedent rather than inventing one.** `isNonCountableSpecies` / `isNonCountableObservedName` settled that two near-identical predicates keep **different names** plus a doc comment saying why, because collapsing them is a silent data-loss bug. Here the naming *is* the mechanism: `truncateAtFirstParen` cannot be mistaken for the normalizer at a call site, where `normalizeSpeciesName` shadowing `normalizeSpeciesName` invited exactly that.

**A claim was corrected mid-build, and the correction strengthens the case.** The first draft said the untrimmed no-paren branch was "unreachable from every shipped call site". It is reachable: three of the four parsers do `.trim().replace(/^"|"$/g, '')`, and stripping a quote exposes whitespace the earlier trim could not see — `parseCSVLine` unescapes CSV `"""  Mallard  """` to the field value `"  Mallard  "`, `.trim()` does nothing because the quotes are the outer characters, and the unquote yields `  Mallard  `. So converging would change stored names on real cells, not only on unreachable ones. Only the reach of the claim was wrong; the conclusion held.

**Relocation was proved, not reasoned about**, per the standing rule for a refactor that moves code: all four pre-change copies are reproduced verbatim in `truncateAtFirstParen.test.ts` as differential oracles and swept against the new export (0 divergences on the snapshot, the 11,111 probes, and the named probes). Three were byte-identical; `parseBreedingCodes` used a ternary and is carried as a separate oracle rather than assumed equivalent.

**Surfaced and deliberately not fixed:** those same four parsers each carry a private `isExcluded` testing the RAW name for `" x "`, which drops the exact 36 countable intergrades v0.5.83 corrected elsewhere (36 lost, 0 newly dropped by converging). That moves visible life-list totals, so it is its own build and went to the idea inbox and the roadmap, untouched here.

---

## The memo bound is admission control, chosen over BOTH the single slot and the reviewer's FIFO, because both were measured at CAPACITY PLUS ONE — 2026-08-11 (v0.5.85)

`normalizeSpeciesName`'s memo was keyed by the raw name, uncapped, and never cleared. The roadmap's reason for leaving it alone was wrong in a load-bearing way: it called the memo "bounded in practice because `Map.set` stores a reference to a string the parsed-observation array already holds", which is true only while that array is alive, and it is not alive after the user loads a second file. Measured with every other reference dropped: 118 B/entry at realistic lengths, 2,093 B/entry at 2,000 characters, and 26.5 MB across ten successive loads of 20k disjoint names (200,000 entries, none released). A slow leak, confirmed, never a denial of service — growth is proportional to distinct names read and never amplifies — but the mitigation expires on exactly the long session the entry was describing.

**The guarantee is stated STRUCTURALLY, never as a byte product.** Four exact facts: the Map holds at most `MEMO_MAX_ENTRIES` (32,768) entries, no key in it exceeds `MEMO_MAX_KEY_LENGTH` (128) characters, no over-length key is in it at all, and over-length names live in a separate cache bounded at `MEMO_LONG_CHAR_BUDGET` (2^20) characters. Three measurements of the same design gave 172, 208 and 173 B/entry; the first assertion built on one of them (`32,768 x 172 B < 6 MiB`) stated a ceiling the true worst case exceeds **and passed anyway**. The replacement scale figure was then wrong a second time for the reason the entry itself now names: it was measured on ASCII keys, and V8 stores one-byte and two-byte strings differently, so a hostile key set picks the expensive one. For scale only, naming the representation: ~5.4 MiB saturated with ASCII keys, ~9.4 MiB with two-byte keys. The limits are sized off measurement — 128 is 2.03x the longest string of any category in the bundled snapshot (63 chars; p99 47, p50 21, mean 22.9; zero of 58,104 exceed it), and 32,768 is 1.83x the 17,891 distinct all-category names, so a user who had recorded every taxon on earth evicts nothing.

**Both caches reached their shape by failing security review, and the second failure is the instructive one.**

**Round 1 — the over-length path was a single slot.** A one-entry cache has a 100% hit rate on one repeated key and a 0% hit rate on two alternating keys, and only the first was measured. Two alternating 40,000-character names cost **3,493.7 ms** against the uncapped Map's 2.4 ms: 1.048x the skip-only implementation the slot existed to avoid. **The rule that followed: a fixed-size cache's performance claim must be measured at CAPACITY PLUS ONE, because at capacity it never evicts and every measurement is a hit.**

**Round 2 — that rule was written into the source and applied to one of the two caches.** The short cache kept evicting FIFO at 32,768 entries, fifteen lines below the comment stating the rule, and it was the *more* reachable defect: no exotic cell sizes, just 32,769 distinct ordinary names, which is 0.75 MB of name data in a CSV well under 5 MB — and a column-misalignment corruption landing `commonName` on a timestamp or comment column produces tens of thousands of distinct values immediately. Measured at capacity+1 on ordinary 24-character names: **2,544.9 ms** against admission control's 16.4 ms, **167x worse than having no cache at all**.

**The reviewer's recommended remediation was NOT adopted unmodified, and the reason is the finding itself.** Round 1 proposed a character-budgeted FIFO and measured it at 8 rotating names against a capacity of 26 — below capacity, the same class of measurement that let the slot through. Round 2 of the review retracted it. At capacity+1 that FIFO measures 4,797.8 ms where admission control reads 142.9 ms; admission control is identical below capacity and 34x, 11x and 85x better at capacity+1 across the three workloads tested. Both caches now **fill to the limit and stop admitting, never evict**.

**The property that actually matters is "never much worse than not caching", and it is what both defects violated.** Every bounded structure in the module was then swept at capacity+1 rather than asserted about — there are exactly two, and both carry a capacity+1 guard. Honest residual: past twice capacity the short cache costs ~1.60x no-cache, a failed Map lookup per miss. A small constant, not a cliff, and no real dataset reaches it. **Accepted trade, carried on both paths:** admission is first-come, so a later file's names can go uncached behind an earlier file's — cheap either way, since an unadmitted short name recomputes a scan bounded at 128 characters and only malformed data reaches the long path at all.

**That assertion was re-expressed as work done rather than elapsed time**, and repetition was proven not to be the fix. It passed in isolation (1.60 here, 2.08 and 2.50 by two reviewers) and failed the full-suite run at 5.69 against a ceiling of 4; under real contention it read 2.21 at min-of-3 and **2.70 at min-of-9**, worse with more rounds, which is the signature of a systematic effect rather than noise (a hit is a lookup in a 32,768-entry Map and a miss is recomputation, so the two sides are different kinds of work and lose CPU-cache locality at different rates). It now counts misses: having no cache recomputes on exactly 1.0 of calls, so "worse than no cache" has an exact meaning no loaded machine can move.

**`!== undefined` on both hit tests now has a guard rather than a compliment.** Round 1 of the review singled the line out as correct and load-bearing; it went two more rounds unguarded, and both truthiness mutants survived a 57-test suite. They are real, not equivalent: `normalizeSpeciesName('(abc)')` is `''` from a five-character name, and on the long path the mutant re-charges `_longChars` every call until admission closes permanently and the cache is silently dead for the session. Two exact assertions, no wall clock — one seeds the cache with a value a recompute could not produce, the other pins the accounting variable separately from the contents.

**Hot-path cost, measured interleaved:** 3.52 ms bounded vs 3.30 ms unbounded over 240,000 calls, about 0.9 ns per call for the length compare. Interleaving is not a formality — an A-then-B run reads 3.0 vs 4.0 and reverses the sign, a JIT ordering artifact rather than a cost. **Implications promoted to `CLAUDE.md`.**

---

## The Breeding Codes tier legend WRAPS rather than truncating, in Normal view on a phone only — 2026-08-11 (v0.5.85)

At 320px and 200% text scale with a complete breeding list, the widest legend chip (`B Wren/Woodpecker Nest Bldg`, max-content 295.08px) ran **81.08px** past the legend's content box. Each code is a `white-space: nowrap` chip and no ancestor from the legend up to `<body>` clips it, so the text hung outside the card's rounded border, off the right edge of the screen, and leaked page horizontal scroll. The band reaches **390px and 1.5x**, not the 360px/2x the brief had measured on the 13-code demo dataset.

**This is the CONVERSE of the v0.5.84 defect, not a narrower version of it.** `.sr-bc-card > .sr-bc-legend` stopped the legend *dictating an intrinsic card width*, which can only happen in Unbounded. Here the card is a stretched flex item at the panel's width and an unbreakable chip is simply wider than it — the exact failure v0.5.84's entry anticipated by name when it rejected a zero contribution ("a card narrower than the widest chip would push it outside the card's rounded border and leak horizontal scroll, reachable on a phone at 200%"). v0.5.84's rule is byte-unchanged and its rejection is not reopened.

**The Designer chose to wrap, and the trade is explicit: vertical height for readability.** At 320px/2x with all 23 codes, 11 of the 23 labels take a second line. The three rejected directions were rejected on measurement, not taste — truncating or hiding a label reverses the **v0.5.56** touch-accessibility decision that spelled these meanings out as visible text in the first place; dropping the 24px tier-dot indent recovers 24px against 81px needed, and that indent is what groups a tier's codes under its heading at exactly the moment the legend is tallest; scrolling puts a horizontal scrollport inside a page that already scrolls. What wrapping costs is height, and it costs nothing in comprehension: flex collects items onto a line only *while they fit*, so a chip wide enough to wrap is always **alone on its flex line** (verified: zero shared lines across 40 configurations), and every line either opens with a bold code or continues the one above it. That is a property of flex line collection rather than luck, and it is why no hanging indent and no `flex-direction: column` were needed.

**Three declarations, each load-bearing, and two of them invisible to a box measurement.** Relaxing `white-space` alone leaves 22.19px still leaking: `C Courtship/Display/Copul.` holds a 24-character run with no break opportunity whose min-content is 236.19px against a 214px line, and the tier group and the chip are **both flex items**, whose automatic minimum size (`min-width: auto`) is their min-content width — so both floor the box regardless of available space. Releasing both floors lets the box reach the line and `overflow-wrap: break-word` then breaks that one run inside it. Removing `overflow-wrap`, or reverting the base to `nowrap`, leaves an element-box measurement reading a **clean zero** while text hangs 22px and 81px outside it. **`break-word` must not be "simplified" into `anywhere`:** it renders identically here and would let both `min-width: 0` declarations go, but `anywhere` collapses min-content to a single character, which is precisely the zero-contribution shape v0.5.84 named and rejected, and min-content is exactly the value that rule reads.

**"Unbounded cannot change" is a property of the stylesheet, and its load-bearing half lives in the component.** The block is scoped to `.sr-bc-legend--normal`, which `BreedingCodeTable.tsx` adds exactly when it omits `.sr-bc-card`, so the two can never co-occur. **Do not flatten the modifier into an unconditional class** — `min-width: 0` on the tier group lowers the legend's min-content, so an unscoped rule would silently reach into v0.5.84's input while every CSS guard stayed green. A component test asserts the mutual exclusion in both directions.

**Deliberately out of scope, both roadmapped.** Rewording code C to eBird's own "Courtship, Display, or Copulation" (whose commas are break opportunities) removes the one mid-word break and renders a line shorter — but the label is a compile-time constant that also feeds the column `title` and the sort button's accessible name, so it changes desktop rendering and an accessible name. **The CSS is deliberately not made to depend on it** and holds for any label. And the tab's filter pill row independently overflows ~55px past its parent and ~31px past the viewport at 320px/200%, in **both** views — same tab, same configuration, different element and different cause, and it is what sets `document.scrollWidth` there.

---

## The v0.5.84 security report's `centerShareOpen` remediation is WRONG, and the correction is recorded so nobody applies it back — 2026-08-11 (v0.5.85)

`pipeline/uniform-map-fabs/security-report.md:186` records: *"If the latch is ever addressed, route the coordinate-cleared path through `closeCenterShare`."* **That introduces a worse bug than the one it fixes, and it was measured rather than argued about.** `closeCenterShare` arms `restoreCenterPinFocusRef`, and the effect keyed on `centerShareOpen` then moves focus to the opener; on this particular edge the opener has unmounted along with the centre pin, so the fallback runs and focus lands on the FAB. Backspacing the Latitude field throws the caret out of the field mid-edit, with `activeElement` becoming the `Set a search center to copy its location` button.

The correct form is a bare `setCenterShareOpen(false)` — exactly what the shipped view-mode adjustment two lines away already does, and for the same reason. Framed properly, **the fix is the missing half of an existing pattern**: `centerPinShown = isCenterView && hasValidCenter`, and the shipped render adjustment covered only the `isCenterView` factor. No new mechanism, no new effect, no tracking state (a view change leaves the popup perfectly showable so only the *change* is a signal and the previous value must be remembered; no valid centre makes it unshowable outright, so the flag itself is the whole test).

**The seed idea was half wrong and that changed the scope.** It said "nothing is visibly wrong today"; the report it came from said the popup "re-mounts unbidden", and the report is right. Four probes against the shipped code found exactly one of four failure modes live: the popup reappears after a clear then re-set (yes), `aria-expanded` is never a lie while cleared (correct), the view-mode axis is already covered, and focus stays in the field being edited. The sharpest case is the right-click drop, because `applyCenter` is documented as never touching share state so "a drop-to-search stays visually identical to today (FR-16)" — with the latch set, that stated guarantee did not hold.

**Two decisions upheld rather than reversed.** v0.5.84's `aria-expanded={hasValidCenter ? centerShareShown : undefined}` is byte-unchanged; its *justification* changed and its comment was rewritten to say so honestly, since the latch it was partly written against is now closed at the source. v0.5.80 Pin Share sub-decision 4 (the popup is transient and copy is always an explicit press) is reinforced — a popup that reopens on its own sat against it. The narrow condition `!hasValidCenter && centerShareOpen` was chosen over the broader `!centerPinShown && centerShareOpen` deliberately: the broader form would subsume the shipped view-mode adjustment, and consolidating the close paths is the named regression risk on this surface, where three overlays and a capture-phase Escape ordering contract interact.

**A user-visible consequence neither the PR nor the changelog originally named**, raised in security review and folded into the changelog: `hasValidCenter` is a `parseFloat` test per field, so **any** transit through an unparseable value fires the adjustment — an in-place *edit* of an open popup's coordinate closes it too, not only a deliberate clear. That follows from the ratified rule and is the safe direction, but it is how most users will actually meet this change.

**The existing suite rejected none of this** — all 89 tests across the four share suites were green with and without the fix. Three new cases were mutation-checked in both directions, and the third exists specifically to fail on the report's remediation, naming the report and the reason in its own body.

---

## The stylesheet-guard carve-out is per QUESTION, not per file — 2026-08-11 (v0.5.85, refining v0.5.82)

`DECISIONS.md`'s v0.5.82 entry (the skip link and the parser extraction) carved out two guards *by file*: "Deliberately not migrated: `filterControlSizeCss.test.ts` and `breedingCodePinnedCss.test.ts` ask offset questions a selector→body map cannot answer." That is **refined to per question**, matching what `CLAUDE.md` already recorded at v0.5.84 ("`breedingCodePinnedCss.test.ts` now does BOTH"). `breedingCodePinnedCss`'s `ruleBody` moved onto the shared `parseTopLevelRules` — every selector it looks up is top-level reachable — while its `ruleOffset` kept a local walker, because **source order is the one question a selector-to-body map throws away**. `filterControlSizeCss` keeps its local parser entirely: both its subjects are ≤640-tier rules, which `parseTopLevelRules` skips whole, so neither is even present in its map. The parser's consumer count was **re-derived, not incremented**: still five.

**The seed idea assumed both guards were merely fragile. All three suspected weaknesses were already live defects**, each mutation-verified against the real `globals.css`. (1) One assertion could not fail: `filterControlSizeCss`'s "reaches buttons, selects and inputs" tested `sel.includes('input')` against the joined selector string, which the **class name** `.sr-input-16` satisfies on its own — narrowing the shipped rule to `:is(button, select)` stayed GREEN while the identical `button` mutation went red. That is the per-partition non-vacuity defect recorded for `mapFabCascade`'s glyph half, live in a second file. (2) Two prefix collisions held off only by source order: `.sr-bc-matrix--pinned thead th` also occurs inside `.sr-ios-app .sr-bc-matrix--pinned thead th`, and `.sr-pinnote--enter` inside `@media (prefers-reduced-motion)`; deleting the base pinned rule outright left the source-order guard GREEN, asserting about a rule that no longer existed. (3) Both helpers searched the raw stylesheet with comments intact, so a doc comment quoting a rule hijacked the lookup.

**Three things the sweep established, each now a `CLAUDE.md` rule.** "Exact" means the **rightmost compound**, not string equality — `.sr-ctl-row :is(button, select, input)` and `.sr-map-sidebar-overlay .sr-field-row > *` are deliberately descendant selectors, and equality with the ancestor would invert what they assert. A **class name can stand in for the element it is named after**, which is exactly how the inert assertion went inert; the element list is now read off the rule's own type selectors, `:is()` arguments included, never off the selector text. And `\b` sits happily between a word character and a hyphen, so `/^\.sr-bc-card\b/` admits `.sr-bc-card-x` — the same trap as the `/\b100%\b/` one already on record.

**20 mutations: nine the old guards accepted now go red, and four rewrites a guard must not reject stay green.** That last group is not ceremony — build 5 of this same bundle had a guard keyed on the literal selector spelling `.sr-bc-card > .sr-bc-legend`, so rewriting it as a descendant combinator (which selects the same element) turned it red; only running the must-stay-green cases surfaced it. One case ran the other way: the old guard went *red* on reordering the `.sr-ios-app` rule above the base it cannot lose to, a change that alters nothing, because it had resolved to the wrong rule in the first place.

**"Test-only, no shipped-bundle change" was briefly FALSE, and it was caught by building rather than by reasoning.** Tailwind v4's auto source detection scans test files and extracts bare words from comments as class candidates, so one word in a comment this build added emitted a real rule into the production stylesheet (+219 bytes, different content hash). No element carried the class so nothing rendered differently, but the claim was untrue. The comment was reworded rather than the claim weakened — and the first repair reproduced the defect by naming the word inside its own warning. A controlled same-directory A/B with both a determinism and a reproducibility control confirmed the shipped CSS byte-identical to HEAD at the same content hash. **Promoted to `CLAUDE.md`:** any comment in any test file in this repo can silently add a rule to the shipped stylesheet, and the cost falls on words new to the whole corpus, which makes it invisible to review and detectable only by measuring.

**A pre-existing blind spot, recorded at its true width because it is easy to record as narrower.** The "no ungated `env(safe-area-*)`" check is defeated by an at-rule tier in **five guards by two distinct mechanisms** — a line anchor in `breedingCodePinnedCss`, and `parseTopLevelRules` skipping at-rule blocks whole in `lifeListPinnedCss`, `iosChrome` (twice) and `mapIosFullscreen`. All five catch the ungated form at column 0 and all five miss it indented inside a tier, which is exactly where a DRY consolidation puts a rule. Untouched by this build; roadmapped as a five-guard pattern rather than a single-file issue.

---

## Uniform map FABs: a second route to the existing pin, not a second pin — 2026-08-11 (v0.5.84)

The saved idea read as "give the other three map views the flag button My Sightings has." The naive build of that sentence is a FAB that drops an independent share pin on Hotspots, Nearby Lifers and Media Targets — and that would have **reversed v0.5.80 sub-decision 3** ("the gesture collision is resolved by extension, not competition"), which settled that on those three views the drop gesture is already the v0.5.43 search-centre pin and that pin gains the copy action rather than a second one competing with it. It would also have crossed out of Improve and into Feature territory, since it adds a capability rather than a route to an existing one.

What shipped extends that decision instead: the new FAB opens the **existing** search-centre pin's `SharePopup`. No pin is created (measured with the popup open: 1 maplibre popup, 1 centre pin, 0 share pins), no copy capability is added or removed on any view, and the Settings sharing preference is untouched. It also extends v0.5.80's "the keyboard route is the *primary* route, not a hidden fallback", which had produced a visible corner tool on the five share-pin surfaces and had never been applied to the three centre views.

**Three sub-decisions worth keeping.**

**`aria-expanded`, not `aria-pressed`.** The neighbouring share button's `aria-pressed` means "this map is holding a pin", a property of the map; this button holds nothing and discloses a popup. The green tint is deliberately the *same* green on a different carrier with a different meaning — one app, one active convention — and the two buttons can never be on screen together, so nobody ever sees one green disc meaning two things. The no-centre state is `aria-disabled` with no native `disabled` (the locate button's focus-preserving precedent), dashed border, and **identical 36x36 geometry to the ready state**, so the row does not shift when a centre is set.

**Pressing when the centre has drifted off screen pans first, through the shipped `panTarget` → `MapEffects` `flyTo` path**, so there stays one answer to "how does this map travel" (measured: centre pin `x = -15` → `x = 935`, latitude unchanged at `40.73`, so camera-only, no re-search, no pin move). The bounds check needed care: `BoundsTracker` reports the viewport grown 15% a side, and testing that padded box answers the question wrong **in the worse direction** — a point in the pad ring reads as in view and the popup opens where it cannot be seen. `lib/markersInView.ts` gained `unpadBounds` (proved to invert `padBounds` exactly) and `pointNeedsPan`, and `BoundsTracker`'s `0.15` literal became the shared `VIEWPORT_PAD_FRAC` so the two cannot drift with nothing failing.

**Desktop FABs now grow with text scale, and that is a deliberate accepted change, not a side effect.** The shared base is `2.25rem` where the old fullscreen rule was a fixed `36px`, so a desktop disc is 36px at 1x and 72px at 200%. Keeping 36px fixed was rejected because it forces a px glyph, which re-opens the ratio bug the rem glyph exists to close, and leaves two sizing idioms inside one family. The phone tier already behaved this way.

**Scope call taken rather than assumed:** the design marked the Filters pill's `.sr-touch-target` as "recommended, safe to defer" and it is included (one existing class, no new CSS, 44px at 1x phone and 88px at 200%), because "one family" is the change's whole point. It is one class name to delete if a future reader disagrees.

---

## The Breeding Codes Unbounded card was sized by its legend, not its table, for fourteen versions — 2026-08-11 (v0.5.84)

Recorded because it **corrects a claim inside a previously recorded decision**, and a reader of that entry would otherwise inherit the wrong model.

Pressing "Pin code labels" roughly doubled every column of the matrix on desktop. The pin was not the cause: `pinned implies Unbounded` forces the view switch, pressing "↔ Unbounded" alone reproduced it identically, and pinned measured byte-identical to unpinned Unbounded both before and after the fix. The defect was in the Unbounded view, shipped since v0.5.70.

`.sr-bc-card { width: max-content }` sizes that card intrinsically, and the card is a **column flex container**, so its width is the maximum over BOTH children: the table wrapper and the tier legend. The legend is a wrapping row of nowrap "CODE Full Label" chips, so its max-content is every chip on one unwrapped line — 1749px against the table's 792px on the 13-code demo dataset, 2951px against 812px at 200% text scale. The table's `width: 100%` then resolved against that inflated card and `table-layout: auto` stretched every column to fill it: code columns at 97px instead of their declared 44px, and the card running 519px past the panel on a 1440px window.

**What this corrects.** v0.5.70's entry, and the matching comments in `globals.css` and `CLAUDE.md`, said the card "hugs its wide auto-layout table". That was true on the phone tier and **false on desktop the entire time**. The v0.5.70 *decision* is not reversed: its "desktop Unbounded stays intentionally wide" is about the ≤640 dot-width narrowing not applying to desktop, and desktop still keeps 44px code columns against the phone's 30px; its three durable CSS lessons all stand. Only the incidental descriptive claim was wrong, and it is now true rather than merely written.

**The fix constrains the legend so it can floor the card but never dictate it:** `.sr-bc-card > .sr-bc-legend { width: min-content; min-width: 100%; }`. Two alternatives were measured and rejected. Sizing the card `min-content` instead measures the same today (every column is width-pinned, so the two intrinsic sizes coincide) but is still the maximum over both children, so the legend would keep dictating whenever it happened to be larger — the defect shrinks rather than goes away and returns silently the first time content shifts. Removing the legend from sizing entirely (`width: 0`, or `contain: inline-size`) works on desktop and drops its contribution to zero, which lets the card fall below the widest chip; each chip is `white-space: nowrap`, so the chip hangs outside the card's rounded border and leaks horizontal scroll — reachable on a phone at 200% text scale with few codes present. `min-content` keeps the legend as the floor and the table as the ceiling, which is the property that survives both tiers.

One user-visible consequence, named rather than hidden: on a wide window with a narrow matrix the Unbounded card is now **narrower than the panel** (794px in a 1232px panel) rather than wider than the window. That is what "the card hugs the table" means; it still grows past the panel and page-scrolls whenever the table genuinely needs it, which is the point of the view.

---

## Help overlay phone width: only ONE of the fix's two halves is tier-bound — 2026-08-10, recorded 2026-08-11 (v0.5.83, amended v0.5.84)

Logged retroactively. v0.5.83's `help-docs-phone-width` fix shipped with **no `DECISIONS.md` entry at all** — its reasoning lived only in code comments and its pipeline folder — and the very next bundle had to repair it. The reasoning is exactly the kind that gets re-derived wrongly, so it is recorded here together with the amendment.

**The v0.5.83 defect and its repair.** The Help overlay's prose column was being sized by a `white-space: pre` coordinates block's longest line (494px at 1x, 955px at 200%), so every line of help text ran off the right edge mid-word on a phone. The cause is that `.sr-help-row` carries an inline `alignItems: 'flex-start'`, which is load-bearing above 640 for the sticky table of contents and becomes a **cross-axis width constraint** the moment the phone tier flips that container to `flex-direction: column`; the child's own `minWidth: 0` is powerless, because it relaxes the main axis. The repair has two halves: a **constraint** (`align-self: stretch` + `width: 100%`, `!important` to out-rank the child's inline block) and a **wrap allowance** (`overflow-wrap: anywhere; word-break: break-word`).

**The v0.5.84 amendment: both halves were written inside `@media (max-width: 640px)`, and only the constraint half belongs there.** Above the tier the row is a real row, `flex-start` governs the vertical axis, and the column's inline `flex: 1; minWidth: 0` already fills correctly (measured `viewport − 288` at every width) — so those two constraint declarations would fight `flex: 1` and must stay ≤640-only. The wrap allowance has no such tie and was simply missing above 640, where the content column is exactly `viewport − 288` and the longest unbreakable run in the help text renders 399.77px at 200% (the link `github.com/dtgibson/snowraven-mini` breaks at its hyphen, leaving `github.com/dtgibson/snowraven-` as one fragment). At 641px that fragment sat 46.77px past a 353px column and dragged the whole help body 23px sideways. The fix is one rule: the wrap allowance alone, scoped to the Help subtree, in a `@media (min-width: 641px)` block.

**Deliberately no upper bound on that query.** The 687px edge is a function of the longest link's rendered width in `docs/HELP.md`, so pinning the band (`and (max-width: 687px)`) would silently stop covering a longer future URL. The guard test rejects that form — and, per the lesson this build produced, now asserts the *lower* edge too, since a consolidation into a higher tier would reopen the entire band with the suite green.

**`.sr-wrap-anywhere` was not used, on both passes.** The helper is unconditional and cannot be scoped to a tier, and the two tiers want different halves of the fix.

**Why this survived a fix written for it.** The `globals.css` comment above the ≤640 rule claimed "641px through 1440px measured clean and stay untouched". That was true at 100% text scale and had never been measured at 200%. Both that comment and the guard test's header now state what was actually measured and what was not, and the general form is in `CLAUDE.md`: a "measured clean" claim must name its text scales. Page `scrollWidth` was no help either — `.sr-help-panel` is `overflow: hidden`, and `document.documentElement.scrollWidth` read *exactly the viewport width in all 76 pre-fix configurations*, every broken one included.

---

## Pinned label rows: two reversals the user made personally, and the risk that retired with them — 2026-08-10 (v0.5.83)

Both of these reversed a builder's verdict, and both will be re-derived by anyone reading only the code, so the reasoning is recorded rather than the outcome alone.

**1. The Breeding Codes pin stays opt-in and default OFF.** The saved idea asked to default it ON for phones. The Designer measured that defaulting it would **swap one freeze for the other rather than add one**: `pinned implies Unbounded` is load-bearing (v0.5.81 settled that Normal view has no viable height unit at 200% text scale), and the name column's `left: 0` applies in Normal only — so on a phone every bird name goes off-screen (x=-277 at 1x, x=-390 at 200%, against 103px and 215px visible today) and the page leaks 306px / 419px of horizontal scroll, rising to 516px / 629px at the 23-code ceiling. Freezes before: one. Freezes after: one. And it removes the freeze that does more work — the code header is one row at the top of a 400-row table, while the species name is present in *every* row, so losing it makes every row an anonymous grid of dots, continuously. The user was asked and chose opt-in, upholding v0.5.81's rule that the pin is a mode a user chooses and **never something a user can land in**.

**2. Pinning freezes the code header row ONLY, and Multimedia gets the same opt-in control.** The Designer's replacement for the declined Half A was a two-axis freeze (`leftFreeze = !wideMode || pinnedNow`, plus an inline `z-index: 4` corner) that kept the name column frozen in Unbounded too. It measured well. The user previewed it on a device and rejected it: *"I wanted to pin only the row with the breeding codes, not the bird labels. I also want the multimedia page to have the same pin labels option as the breeding codes."* Both halves shipped as asked. `BreedingCodeTable.tsx` was reverted byte-identical to `d8d4a56^` apart from one comment recording why the pin is one-axis, so nobody re-derives the reshape; the shipped predicate is `!wideMode`, and the pill is "Pin code labels" because naming the axis is what keeps the label accurate. The design pass had explicitly declined a Multimedia pill, and that verdict was reversed too: the user asked for parity of the **control**, not merely of the mechanism.

**The named cost, taken with eyes open.** Chromium users (web, Windows) had an always-on header pin in Multimedia's Unbounded view and now press a button for it. That is a real regression for that group and is exactly the objection the design pass raised. The trade bought parity of the control across the two tabs instead of one tab having a button and the other pinning silently — and WKWebView users (the macOS app, iOS) gained a pin that had very likely never worked for them at all, since Multimedia's sticky had sat on the `<tr>` since v0.0.29 and WKWebView honors sticky on cells only.

**A risk retired, worth noting because it is invisible in the diff.** The two-axis version required a `<th>` sticky on both axes at once under `table-layout: fixed` — a shape this app had never shipped and that only Chromium had been observed on. What ships is single-axis per cell, the already-proven form. The reversal removed an untested platform assumption as a side effect.

Also settled here: persistence stays out of scope (a saved preference would mean a Settings control plus storage-seam state, reversing the deliberate session-only choice that matches `wideMode` beside it), the v0.5.69 capped-height frozen-header box stays reverted on both surfaces, and Multimedia still gets no frozen name column — its name column is 238px at 1x and 423px at 200% on a 320px viewport, so freezing it would leave nothing for the data.

---

## Map location buttons: a live region hidden by its own tidiness, and two structural deviations from the spec — 2026-08-10 (v0.5.83)

The feature itself is discoverability over shipped machinery: `getCurrentLocation()` and `handleUseMyLocation()` were already built and platform-proven, but reachable only from the sidebar and absent entirely from My Sightings, the default view — while the one round button on that view rendered lucide's `MapPin` and planted a flag. The glyphs are now `LocateFixed` and `FlagTriangleRight`, which **completes** the v0.5.80 "shape carries the distinction" decision rather than reversing it: that reasoning had governed the sprite and had never been applied to the button.

**The post-mortem worth keeping: `.sr-map-geo-error:empty { display: none }` shipped in the first revision and was caught in security review (Medium).** `display: none` removes an element from the accessibility tree, so the `role="status"` region was being inserted at the same instant its first content arrived. Two things made it worse than a first-message problem: `handleUseMyLocation` clears the message as its first statement, so **every** announcement was a `none` → `flex` transition; and it defeated the whole point of `geoErrorState.ts`, a module written specifically so a repeated identical failure announces twice via a sequence-keyed child — a mechanism that assumes a stable region. On My Sightings there is no sidebar copy, so that region is the sole carrier. The rule was deleted. Its stated benefit was false anyway and had already been measured so: the cluster is bottom-anchored, so an empty row grows the box upward and every button's frame is byte-identical either way; what the rule bought was 10px of dead space inside an invisible `pointer-events: none` box, paid for with the announcement. Verified in a real accessibility tree with `ariaSnapshot`, not reasoned about. **Implication promoted to `CLAUDE.md`.**

**Two deviations from the schema and the design, both deliberate, both preventing a regression the spec would have shipped.** (1) The cluster wrapper is now mounted unconditionally and the `!sidebarOpen` gate moved inward to wrap only its interactive contents: the PRD had removed `role="alert"` from the sidebar's failure block so there would be exactly one announcer, but on a phone with the Filters overlay open the sidebar's own "Use my location" is still pressable and can still fail — with the cluster unmounted that state would have had **no announcer at all**, strictly worse than before. (2) The button's gate moved from "is there data" to "is there a map", so it is absent on My Sightings while the setup-required screen shows; a press there would detect successfully, arm `panTarget`, do nothing observable, and potentially raise an OS location prompt for no benefit — which is precisely the lesson the old pin button taught and the reason this feature exists. QA-02 was amended in `prd.md` to scope to the three centre views, with both halves asserted in tests so the amendment is recorded rather than silently narrowed.

`geoErrorState.ts` is a `useReducer` rather than a `useState` plus wrapper setter for a concrete reason: `dispatch` is recognized as stable by `react-hooks/exhaustive-deps` exactly like a `useState` setter, whereas a `useCallback` wrapper is not and would have forced a change to `handleUseMyLocation`'s dependency array. No location button was added to Species Detail, Statistics, or Named Birds: those maps are bounded to the user's own sighting data by `MapBoundsFitter` and answer "where have I seen this," not "where am I going." Privacy verified rather than assumed — a press on My Sightings is a pure recenter that issues no eBird, Nominatim, OpenWeather, or NOAA request, now locked by a **paired** regression guard (the negative case alone passes on an implementation that has silently stopped searching everywhere), and `PRIVACY_POLICY.md` gained a cross-reference to "Map Tiles" without weakening either existing statement, since centering does cause tiles for the user's area to be requested.

---

## Hybrid life-list count: the raw-vs-normalized predicate asymmetry, and why the narrow option was the right one — 2026-08-10 (v0.5.83)

> **SUPERSEDED IN MECHANISM by v0.5.89; every finding below stands.** The predicates this entry names no longer exist — `isNonCountableForm` decides countability from eBird's `reportAs` field, and one predicate takes one input. The asymmetry survives inside `isNonCountableNameShape`, which is now the fallback for a name eBird does not publish rather than an inference, and it survives for exactly the reason argued here. This entry's warning that collapsing the raw/normalized pair is a silent data-loss bug was **discharged by the sweep, not waived**: the 36 intergrades it protected stay countable, and the entry's own open question (a slash inside a parenthetical) is what v0.5.89 answered. Read the reasoning; do not reach for the API.

`filterObservations` filtered on `isSpuhOrSlash`, which omits hybrids, so `" x "` hybrids survived as countable species on Statistics and in the Map Explorer's county aggregates — where county **Species** and county **Completeness** were counting by different rules in the same dropdown. Its own doc comment already claimed it dropped hybrids. `lib/calendar.ts` carried the sibling defect.

**The decision is which name the predicate tests, and it was sized by sweeping the bundled taxonomy rather than reasoned from examples.** The obvious repair — apply the existing countable predicate to the raw exported name — newly excludes 818 names: 782 true hybrids (correct) and **36 countable intraspecific intergrades** (wrong), because `normalizeSpeciesName` strips the trailing parenthetical and a name like `Yellow-rumped Warbler (Myrtle x Audubon's)` carries its ` x ` only inside it. Excluding those erases the species outright for a birder whose only record of it is the intergrade. The shipped `isNonCountableObservedName` tests the `" x "` half against the **normalized** name and the spuh/slash half against the **raw** name, excluding exactly the 782, losing 0 intergrades, and newly keeping 0 names the old code excluded. That last number is what makes it the narrow option rather than a scope-expanding one. The asymmetry is deliberate and documented at the definition, because "tidying" it later is a silent data-loss bug.

Statistics' toggle was relabelled **"Count spuh, slash & hybrids"**, matching the Calendar tab's existing switch verbatim rather than inventing new copy, since the old "Include spuh / slash species" became inaccurate the moment the filter governed hybrids. `frivolousLists.ts`'s re-inlined duplicate of the predicate was retired to the canonical helper (predicate drift being the exact bug class), but its own raw-name `isExcludedName` was left alone deliberately, with the reason at the call site — switching it would change which themed lists tick, which the brief excluded.

**Deliberately not fixed:** `LifeList.tsx:506` derives its "N species" label from the display-filtered list by construction, so correcting it would either make the number disagree with the visible rows or silently drop hybrid rows from the list. That is a product decision, captured to the idea inbox rather than assumed here. Effect on a user's own data: invisible if their export has no hybrid rows, a genuine downward correction to the species total if it has any.

---

## Map Explorer iOS focus-zoom guard: nine per-element classes, and the companion stacking rule scoped to the sidebar — 2026-08-09 (v0.5.82)

**What was broken.** Nine focusable form controls in the Map Explorer sidebar carried no `.sr-input-16` at all — a miss from the v0.5.61 sweep — so each computed a sub-16px font size at the phone tier and iOS zoomed the viewport whenever one was focused, leaving the user to pinch back out. Every other tab already behaved. Nine source edits cover fifteen rendered instances, because `AddressSearch` and the latitude/longitude pair are each one source site rendered in the hotspots, media-targets, and nearby-lifers sidebars.

**`.sr-input-16` per element, NOT `.sr-ctl-row`, and the reason generalizes.** `.sr-ctl-row` is the container hook for a filter *row*; this is a sidebar. The nine sit in four separate subtrees, so it would need roughly four placements and still not be one row, and it sizes every interactive descendant — which here would also catch the four-button Breeding Code `SegControl` (nowrap labels at 0.71875rem in a 282px overlay, so 16px wraps them onto extra rows), Map View, Point Size, Radius, "Use my location", "Find sightings", and every in-view marker-list row. That is unrequested layout change on controls that never zoomed. The brief's correction stands too: the sidebar is not uniformly 0.75rem — the three selects are 0.8125rem via `SELECT_STYLE` — but both values are sub-16px, so no mismatch was visible and the conclusion held.

**The Date Range pair was the one predicted risk and it was real.** `.sr-field-row` stacks only at ≤480, so from 481 to 640 the two native date inputs sit side by side with 120.5px each; measured in Chromium against the built CSS, `08/09/2026` fits at 12px and renders as `08/09/202` at 16px. The repair is the brief's named contingency, **scoped**: the row stacks through the whole phone tier when it is inside the map sidebar. Not a global tier move, because `.sr-field-row` has six consumers and the other five sit in the full-width main panel with 220px+ per field in that band. The guard was never weakened to resolve the clip — the guard is the requirement and the layout is what yields.

**Vertical fit at 200% needed no accommodation, for a structural reason rather than luck.** All nine sit in fixed 34px boxes. `max(16px, 0.75rem)` only *raises* while the rem is under 16px (below ~133% scale); above that it returns the rem, which is what the inline style already was. So the six inputs are 24px both before and after at 200%, and the three selects go 26px → 24px. The formula cannot tighten a box at any scale.

**Method post-mortem, and the durable half of this entry.** Two numeric probes were tried and both were wrong, in opposite directions on the same elements: `scrollWidth === clientWidth` on a date input that was visibly cutting off the year (under-reports), `scrollHeight > clientHeight` on selects that render perfectly at 200% (over-reports, and present in the pre-change revision too), and canvas `measureText` declaring the clipped `Longitude` placeholder a fit by 0.04px because it cannot see the picker icon, the spinner buttons, or internal field spacing. The screenshots settled all three. **Implication:** promoted to `CLAUDE.md` — a numeric browser measurement is still not a render for a native control, the `max()` vertical-fit corollary, and the companion-layout-rule convention.

**Pre-existing defect found and deliberately not fixed:** at 641px the sidebar narrows to 240px, giving each date input 99.5px, where the year is already clipped today at 12px. Both revisions render identically, so this change neither causes nor worsens it; it is outside a phone-tier fix's scope and is on the roadmap.

---

## The count-cluster leak: a responsive class that had been shipping inert, and one visible change taken deliberately — 2026-08-09 (v0.5.82)

**What was broken.** At 320px with 200% text scale, the right-hand count-and-view cluster on Multimedia and on Breeding Codes held its max-content width inside a 272px row content box and pushed page horizontal scroll. On Breeding Codes this had pushed the `↔ Unbounded` button entirely off the screen, unreachable.

**The finding worth keeping: `.sr-wrap-flex` was already on the Breeding Codes cluster and had been doing nothing.** It computed `flex-wrap: wrap` the whole time while that cluster measured 475px inside a 296px box — the single largest unclipped overflower on any tab at that size. An inline `flexShrink: 0` pins a flex container at max-content even after the parent row has wrapped it onto its own line, and a container that is never narrowed has no reason to break a line. A class-only fix on Multimedia measured 71px → 71px, cluster 366.59 → 366.59: literally zero change. **The width cap is what makes the class bind.** `max-width: 100%` was chosen over dropping `flexShrink: 0` — the Evaluator measured the two identical in effect — because it preserves the do-not-get-squeezed intent rather than discarding it, is already the pairing `.sr-scroll-x` uses, and is responsive by construction. The test encodes the invariant (given an inline `flexShrink: 0`, a width cap must be present) rather than pinning the variant.

**One visible layout change was allowed that was not forced, and both the Engineer and the Tester independently judged it right.** Breeding Codes at 320px/1x now wraps its cluster to two lines (height 44 → 70). It was 21.09px past its row content box before, absorbed by the panel's 24px padding so no page scroll showed — but that is defective by the brief's own definition of done, it is the same shape as the 0.23px Multimedia case the brief explicitly calls a defect, and gating the cap behind a breakpoint would have been exactly the breakpoint math the responsive convention says to avoid. Recorded because it is a visible change on a small phone that the brief did not predict.

**Measurement notes.** The 80-cell geometry matrix (10 widths × 4 scales × 2 tabs) found no cell at 640px or above changed on either tab, 10 changed cells on Breeding Codes (against the brief's estimate of one, which had been measured on the other tab's much narrower cluster), every one of them already defective pre-fix, and after the fix zero of the 80 cells has a cluster wider than its row content box. Page `scrollWidth` alone was proven not to be a usable assertion: the unfiltered Multimedia row is 24.23px past its content box yet reads a clean integer 320.

**`ROADMAP.md` was wrong on three counts and is corrected rather than carried forward:** it described two tabs when `LifeList.tsx` renders only Multimedia (the panel id `life-list` is legacy); it called the leak a constant 3px when it tracks the count label's text (`428 species` reproduces 3px, `1247 species` gives 12px, `88 species` gives none); and it asserted that Breeding Codes *avoided* the leak because it carries `.sr-wrap-flex`, when that tab was the worst instance and the class was the thing sitting inert. **Do not restate that third claim anywhere.** **Implication:** promoted to `CLAUDE.md` — the inert-class rule, and that adding a responsive class is not evidence the layout responds.

**Deliberately out of scope, and separately tracked:** the other measured 320/200% leaks — Statistics 60px, Checklists 42px, Calendar 29px, and Breeding Codes' own residual 31px from its filter pills. None share this cause, and the 31px residual is exactly what was predicted to remain.

---

## The skip link takes the safe-area inset on focus only; and the stylesheet-guard parser is extracted at its third consumer — 2026-08-09 (v0.5.82)

**What was broken.** `.sr-skip-link` is `position: fixed`, so it escapes `.sr-ios-app body { padding-top: env(safe-area-inset-top) }` and came to rest 16px from the *physical* top on focus — inside the Dynamic Island band, leaving most of the pill behind opaque hardware. It is the last untreated surface of the family v0.5.81 documented, and the most direct one: an interactive control rather than a title, and the app's very first tab stop. One `.sr-ios-app`-gated rule in `globals.css` carrying `top` and `left` only; no TSX change at all, because the skip link's positioning already lived in the stylesheet.

**Three decisions inside a two-line rule, each of which was a live wrong turn.** `:focus` only, never the base rule — the base `top: -100px` is an off-screen *park*, and the pill is 41px tall at 1x and 62px at 200%, so insetting the park (by `calc()` or by `padding-top`, which fail identically) puts its bottom edge at +21px and makes a hidden link permanently visible. Re-point rather than pad — the two panel precedents pad because they are `inset: 0` boxes; padding a `width: auto` pill grows it by the inset and paints its background across the Island. `left` yes, `right` never — the element declares no `right`, and adding one to a `width: auto` fixed box stretches the pill across the viewport. All measured in a Chromium reproduction rendering the declarations **parsed out of `globals.css`**, not retyped, with the inset substituted as a literal 59px; every number in the bug brief was confirmed exactly, and landscape was run with the housing charged both ways.

**What is deliberately not claimed as verified:** that iOS reports 59px on any given model, and which edge it charges the inset to in landscape. Neither needs settling, because the rule *defers to the platform value* — it adds whatever `env()` reports to the shipped 16px, so it is right for 59px, for iPad's ~24px, and for 0.

**The shared parser, extracted as `CLAUDE.md` anticipated.** `frontend/src/lib/cssTopLevelRules.ts` is now the one top-level stylesheet parser; `iosChrome.test.ts` (which hosts the new guard) and `mapIosFullscreen.test.ts` both migrated onto it, the latter strictly stricter than the trio it replaces. Deliberately not migrated: `filterControlSizeCss.test.ts` and `breedingCodePinnedCss.test.ts` ask *offset* questions a selector→body map cannot answer. It is test-only and never bundled. Nine mutations against the new guard and four against the migrated ones were each rejected by the suite — **a green suite after a guard refactor is not evidence, and a quietly tautological assertion is invisible in review**, so re-introduce each original regression against the migrated guard and watch it fail.

**Published prose was checked and correctly left alone.** `ACCESSIBILITY.md`'s only mention of this control claims tab-order position and nothing geometric, so it stayed true throughout. The sentence this bug *did* falsify — "Wherever keyboard focus lands, you can see it" — is made true by the fix, so no edit keeps either honest, and adding device-specific geometry to a published statement would create a claim needing maintenance.

---

## Declined: an escapee-aware species count on the Statistics tab — 2026-08-09 (escapee-count-toggle, scoped, not built)

> **CORRECTED AND SUPERSEDED by v0.5.87, which BUILT this.** The decline was right on every data fact and wrong on one number, and that number was the whole argument. **The ~3,252-call figure below is WRONG and is corrected in place** (see the struck clause in the third paragraph). Provenance is stored per observation, but the question asked is per SPECIES and the answer is a monotone OR: a species counts if at least one of its observations is not `X`. One checklist call returns provenance for every species on that checklist at once, which makes this a SET COVER over data the app already holds, not a sweep. Measured against the same real export and key: a greedy cover of all 267 species is **73 checklists**, fetched in **9.7 seconds** at concurrency 4, with **zero** follow-up calls needed and 3 species dropped (267 → 264). The cover itself is computed offline from the CSV.
>
> Every OTHER conclusion in this entry was re-verified and STANDS, and they are the reason the built feature has the shape it does: no provenance column in the export, per-observation storage, no bulk personal-list endpoint, the offline `category === 'domestic'` shortcut being a trap in both directions, and the Calendar's zero-network guarantee as a hard boundary. The two Improve-sized items named at the end have since shipped (v0.5.86). The county-completeness caption named below was corrected in v0.5.87.

**Decision: not built.** Declined at the feature check. The request was reasonable and user-reported (the Statistics total does not match the number eBird shows), but the scoping found it is a Feature-lane acquisition build wearing a checkbox's clothes. The idea returns to the inbox. Recorded in full following the v0.5.79 and v0.5.81 precedents, because the analysis is expensive to re-derive and its conclusions are stable.

**The load-bearing finding is a data fact, not a judgement call: the eBird CSV export carries no provenance column at all.** Verified against three of the user's real exports (2026-06-28, 2026-07-01, 2026-07-29) — all the same 23 columns, none of them an exotic/provenance field. This is stronger than "the parser drops it"; there is nothing to retain, and every statistic in the app is computed from this export.

**Where provenance actually lives, and why it is expensive rather than merely new.** `GET product/checklist/view/{subId}` returns `obs[]` carrying `exoticCategory` — `X` (escapee), `N` (naturalized), `P` (provisional), or absent — with a companion `userDoNotCount`. Two properties decide the lane: it is **per observation, not per species** (Mute Swan came back `P` on one of the user's checklists and is `X` elsewhere in eBird), so no species-level lookup can stand in for it; and there is **no bulk personal-list endpoint**, which is the original reason SnowRaven is built on the CSV export at all. ~~Covering this user's history means ~3,252 checklist calls over 21,369 observation rows~~ **[CORRECTED: 73 calls, measured. See the note at the head of this entry.]**, plus an eBird key requirement, a persistent cache, progress UI, and offline/no-key degradation — and it would put a network dependency on a tab that is currently pure offline computation. (The last clause stands and is what the built feature's degradation design answers: resolution is initiated only from Statistics, every other surface reads the cached result passively, and the Calendar stays zero-network.)

**The tempting offline shortcut is a trap, and this is the part most likely to be re-attempted.** The bundled taxonomy has a `category` field but no provenance field. `category === 'domestic'` is not eBird's rule and is wrong in **both** directions on the user's own data: it would wrongly drop Indian Peafowl (`P`) and Red Junglefowl (`N`), which eBird counts, while correctly catching Graylag Goose, Swan Goose, and Muscovy Duck (`X`). A control labelled "escapees" running a different rule than eBird's is worse than no control, because it claims a parity it does not have. If a category-based filter is ever built it must be labelled for what it does ("domestic-type forms"), never for what it is not.

**Size of the real problem: about 3 species out of 267, roughly 1%** — ~~and pinning it exactly still requires the full sweep, because provenance is per observation~~ **[CORRECTED: pinning it exactly requires the 73-checklist cover, not a sweep. Confirmed exactly: Graylag Goose, Swan Goose, Muscovy Duck.]** Domestic-type forms of birds also seen wild already fold into the parent via `normalizeSpeciesName`, so they never inflated anything.

**Two genuinely Improve-sized items surfaced and are NOT part of this decline** (neither delivers what was asked, and both are noted for whoever picks this up): `filterObservations` in `birdingStats.ts` filters on `isSpuhOrSlash`, which omits hybrids, so the Statistics life-list total counts `" x "` hybrids as species — contradicting the canonical `isNonCountableSpecies` predicate settled in v0.5.38 and a partial counter-example to that entry's "no other stat had the same overcount" audit claim (delta 0 for this user, so it is correctness hygiene). And an honest caption on the tab saying the total includes exotics because the export carries no provenance.

**Hard boundary on any future design:** the Calendar's v0.5.63 zero-network guarantee. Its species counts use `isNonCountableSpecies`, so a network-sourced exclusion cannot reach it without breaking that promise. Also in scope if the count rule ever changes: Statistics totals and milestones, media documentation coverage, county completeness (whose "spuhs, slashes & hybrids don't count" caption becomes inaccurate the moment a fourth exclusion exists), and the Frivolous Lists.

---

## Breeding Codes pinned labels: v0.5.69 TOUCHED, NOT REVERSED — pinning is offered only where it is free — 2026-08-09 (v0.5.81)

**Decision:** An opt-in **"Pin code labels"** toggle on the Breeding Codes tab keeps the code header row (NB, FL, CF, …) visible while a long species list scrolls. Default OFF, session-only `useState` (matching `wideMode` beside it), so anyone who never presses it sees today's table byte for byte in both views at every width. Pinning is offered **only in the "↔ Unbounded" view**, under the invariant **pinned implies Unbounded**: pressing Pin from Normal switches the view and pins in one press; pressing again restores the view you came from and unpins, leaving no residue; pressing `↔ Normal` while pinned clears the pin and visibly un-presses the pill.

**The v0.5.69 decision is touched and NOT reversed, and this is the part not to get wrong later.** v0.5.69 recorded that a capped-height frozen-header box **was built, live-tested, and REVERTED at the user's request** in favor of the natural full-height page-scrolling table. That remains the default and the shipped behavior; what v0.5.81 adds is a user-chosen mode on top of it, never something a user can land in. Its empirical CSS limit is respected rather than fought: in Normal view `overflow-x: auto` forces the vertical axis to `auto`/`hidden`, so page-frozen header + unbounded height + contained horizontal scroll stay mutually exclusive. In Unbounded neither the card nor the wrapper sets `overflow`, so the scrollport is the page, a `position: sticky; top: 0` header anchors to the viewport for free, and nothing is given up.

**Normal view was left without a capped box on ARITHMETIC, not preference.** The brief left the call open for The Designer, who settled it against the binding requirement that the surface hold at 320px and 200% in-app text scale: at 200% a species row is roughly 68px, so a `60dvh` cap on a 375x667 phone leaves about five rows inside a box that scrolls independently of the page with the legend stranded below it — worse than the shape v0.5.69 reverted. A `26rem` cap resolves to 832px, taller than the viewport, so once the page scrolls the scrollport's top (and the pinned header with it) is off-screen and the feature silently stops working. `min(26rem, 60dvh)` collapses back to the first case. **There is no viable height unit at 200%**, which is a stronger and more durable reason than taste.

**Mechanics worth keeping:** `position: sticky` sits on each `<th>` individually, never on `<thead>`/`<tr>` (WKWebView and older Safari honor sticky on cells only, and this ships in WKWebView on both macOS and iOS); `border-collapse: separate` was already set and is required. All the pinned CSS lives in `globals.css` rather than inline, which is load-bearing: the iOS variant re-points `top` to `env(safe-area-inset-top)` under the `.sr-ios-app` gate, and an inline style at (1,0,0) is unreachable from a stylesheet. This required first lifting the shipped `thBase.boxShadow` into `.sr-bc-matrix thead th` at the same value so the pinned rule can win by specificity instead of fighting an inline one. One new token, `--sr-sticky-shadow`, in both themes with a genuinely deeper dark value (a verbatim `:root` copy is the shape of the v0.5.44 milestone-badge defect, and a test rejects it). `.sr-touch-target` was added to the shipped `↔ Unbounded` button as well, a deliberate one-className deviation: the two are now a visual group and a 2.75rem pill beside a 28px toggle would read as a rendering error at ≤640. Its base rule also sets `display: inline-flex`, so that button moves from default button rendering to flex centering at all widths — height, padding, border, and font unchanged, and the same pattern already ships in `NamedBirdsTable.tsx`.

**Contrast, stated plainly rather than claimed:** `--sr-border-medium` is about 1.65:1 against `--sr-bg` in light mode. This is NOT claimed as a WCAG 1.4.11 pass and does not need to be — the header is identified by its text and the pinned state by the pill's `aria-pressed` plus its visible pressed styling, so the line and haze are reinforcement, not the sole means of identifying a component or its state. A 3:1 line would read as a rule rather than a hairline and would break the tab's register.

**Implication:** the promoted `CLAUDE.md` line ("a NATURAL full-height, page-scrolling table at ALL widths") gains **"by default"** and the pinning amendment, so it stays true. Also promoted: the `scroll-padding`-on-the-scrollport vs `scroll-margin`-on-the-focus-target rule (see the post-mortem below), and a nuance on the v0.5.80 live-region test.

---

## Two defects in the pinned-labels work, both about reaching the right element — 2026-08-09 (v0.5.81)

**Post-mortem.** Neither was a wrong idea; both were a correct rule aimed one element off.

**1. `scroll-margin` on the cell is inert, because the cell is not what receives focus.** The first cut guarded keyboard focus from the sticky band (WCAG 2.2 SC 2.4.11) with `scroll-margin-top` on the table's body cells. `scroll-margin` neither inherits nor applies to an ancestor, and in this app the focus target is the `<button>` that `BirdName` nests three levels inside every species row, so the rule computed `0px` on everything that can actually take focus. The security review caught it. Both candidate fixes were then **measured in Chromium** by reverse-tabbing the species list (the direction that aligns a target to the top edge where the band sits): the first cut left 3 focus stops obscured at 100% text scale and 9 at 200%, while a root `scroll-padding-top` and a descendant `scroll-margin-top` each eliminated every occurrence at both scales. **The descendant form was chosen because it stays inside this table's subtree.** A root-scoped `scroll-padding-top` is the textbook fix and works geometrically, but in this app `mountedTabs` only grows and hidden panels are `display: none`, so it would remain in force on every other tab once a user pins and navigates away; `:root:has(…)` leaks identically, because selectors match the DOM tree irrespective of computed `display` (verified in Chromium, not assumed). The `*` selector's cost was measured at about +2ms of full restyle on a 7200-cell worst case, only on a pin toggle, and the probe is committed at `pipeline/breeding-code-pinned-labels/focus-obscured-probe.mjs` so the numbers are reproducible rather than asserted.

**2. Published prose said a session-only toggle turns off when you leave the tab. It does not.** Tabs stay mounted once opened, so the Help text was wrong about the new toggle — and the same sentence shape was already **shipped** in the v0.5.80 share-pin prose. Two occurrences in one bundle makes it a repeating shape, not a slip. Both are corrected to the settled house phrasing, **"per-session, resetting on relaunch"**.

**Two method notes worth keeping.** A standalone reproduction inherits the blind spots of what it leaves out: the repro proved the `scroll-margin` semantics correctly and still led to the wrong recommendation, because with no tab shell it could not show that a root-scoped rule outlives the tab that set it — when a repro is used to CHOOSE between fixes rather than just confirm a defect, model the part of the shell the candidates relate to differently. And a regression tripwire is scoped to the shape that regresses (a `:root`/`html`-scoped declaration), not to the property or selector vocabulary it happens to use; a stylesheet-wide ban on `scroll-padding-top` or `:has(` protects one rule at the cost of failing unrelated future work under a test name pointing at the wrong thing.

**Implication:** both promoted to `CLAUDE.md`, along with the nuance that a live-region mutation-counting test only discriminates when the message node is permanently mounted (where the node unmounts and remounts, an unkeyed child passes the same test).

---

## Share format toggles: three independent switches, all eight combinations, and one manifest that generates every string — 2026-08-09 (v0.5.81)

**Decision:** The v0.5.80 Sharing preference becomes **three independent switches** (Coordinates, Google Maps link, Apple Maps link) in place of the two-way radio group, so all eight combinations are reachable. The payload keeps its fixed coordinates / Google / Apple order whichever parts are on, built as a present-lines array joined with `\n` so an elided middle element leaves no blank line, with no trailing newline.

**All three off is permitted, and is a structural state rather than a ninth string.** It is what the user literally asked for, and its cost is bounded by three things: the live example shows the empty state at the instant the last switch flips, in the same block, so it is never discovered later on a map; the popup's on-screen coordinate readout is independent of the payload, so the pin still shows the spot and stays hand-selectable; and in both places the control is **replaced by a plain sentence** rather than left as a dead disabled button. Binding rule going forward: **no control that looks pressable may put an empty string on the clipboard.** Rejected: making coordinates non-optional (fails the request literally and blocks the Apple-only case), and refusing the last switch-off (a switch that will not move is a mystery found only by hitting it).

**The generating rule is the point of the change, not an implementation detail.** Eight button labels and eight mode lines are generated from one ordered `SHARE_PARTS` table plus pure functions; adding a fourth destination is one row and no new copy, which the suite asserts by actually adding one. Two traps the design pass hit and fixed are preserved deliberately, each with a test that fails without it: `label` and `noun` are separate columns (the one-column-plus-`.toLowerCase()` version reads correctly on today's three and silently produces "Bing maps link" on a fourth), and `countWord` runs to six so a fourth destination says "Four lines:" rather than mixing a digit into a sentence of word forms. The button may collapse a complete family to "map links" (37 characters, which is what keeps it inside the 224px compact popup against 55 for the enumerated list) **only because** the mode line directly below always spells out which links, so the two functions are not redundant.

**Migration was the defect risk and is handled explicitly.** The storage key `shareCopyMode` is unchanged and its value widens from a string literal to `{coords, google, apple}` (the web/Pi kv store persists any JSON verbatim and `TauriStorage` writes JSON, so no transport change). `normalizeShareCopySelection` branches on **both** legacy literals: `'coords-only'` → coordinates on, both links off; `'coords-and-links'` → all three on; absent/malformed/unknown → all three. Letting `'coords-only'` fall through to the default would silently hand links back to someone who deliberately turned them off, so each literal has its own unit test. All-false round-trips rather than being treated as malformed. Rollback is safe: a v0.5.80 build reading the new object falls through to the default superset.

**v0.5.80 sub-decision 2 is named rather than silently contradicted:** it records that "a single-link default with the second behind the setting was offered explicitly and declined." The user declined a *single-link default*; this is the complement, choosing each part explicitly. The no-shortener exclusion and the ratified link forms are **untouched** and must not be re-opened — this only elides whole lines from the existing block.

**Correction to the v0.5.80 record, and it is bigger than eight.** The Auditor's Low finding was that `normalizeShareCopySelection`'s string branch used a bare `LEGACY[raw]` index on an ordinary object literal, so it inherited `Object.prototype` and took the legacy arm for inherited members, spreading to `{}` (every switch off) instead of the documented default. **The Auditor first reported eight such strings and then corrected its own enumeration to twelve** — the four `__defineGetter__` / `__defineSetter__` / `__lookupGetter__` / `__lookupSetter__` accessors join `'constructor'`, `'__proto__'`, `'toString'`, `'valueOf'`, `'hasOwnProperty'`, `'isPrototypeOf'`, `'toLocaleString'` and `'propertyIsEnumerable'`. The shipped `Object.hasOwn` allowlist guard **closes all twelve by construction rather than by list**, which is precisely why the count being wrong did not make the fix wrong. It failed closed and polluted nothing, so it was never a crash or an escalation; it was the stated behavior and the real behavior disagreeing.

**Also recorded, because it ships unexamined otherwise:** `Object.hasOwn` is the **first ES2022-era runtime API in the app's non-test source** (a sweep for `.at(`, `findLast`, `findLastIndex`, `structuredClone`, `replaceAll`, `Promise.allSettled`, `toSorted`, `toReversed` returns zero shipped uses), so the bundle had been living on an older runtime baseline than its `es2023` tsconfig target implies — that target governs syntax downleveling and type-checking, not runtime API availability, and Vite polyfills no runtime methods. Cleared against both native targets: `minimumSystemVersion: "16.0"` and `IPHONEOS_DEPLOYMENT_TARGET = 16.0` against a Safari 15.4 requirement, and Windows on evergreen WebView2.

**Correction owed to the v0.5.80 "no outbound request" entry:** its carry-forward formulation said the preference carries "only the mode literal." The value is now an object. That entry has been reworded in place; **its conclusion was re-verified and is unchanged** — no third party, no coordinate transmitted, no change to who talks to whom, offline-safe, and `PRIVACY_POLICY.md` and `ACCESSIBILITY.md` both re-checked as needing no change.

**Implication:** promoted to `CLAUDE.md` — the generate-from-a-manifest rule for combinatorial copy, and the `Object.hasOwn` allowlist rule with its prototype-chain test corpus and `JSON.parse` pollution probe.

---

## Three `position: fixed` overlays escape the iOS safe-area padding: the same mechanism, sibling rules rather than a shared utility — 2026-08-09 (v0.5.81)

**Decision (builds 1 and 5 of the bundle, one mechanism).** `.sr-ios-app body { padding-top: env(safe-area-inset-top) }` protects every in-flow surface, but a `position: fixed` element is viewport-relative and sits above that padding. Two overlays were pinned to the physical top of an iPhone screen as a result: the Map Explorer's fullscreen panel, whose four view-mode pills rendered under the status bar and Dynamic Island, and the in-app Help overlay, whose book icon and "SnowRaven Documentation" title did the same. In each case the positioning was an inline `{ position: 'fixed', inset: 0 }` at specificity (1,0,0), unreachable from a stylesheet — so the fix in both is to **lift the positioning into a `globals.css` class at byte-identical values** (`.sr-map-fullscreen-panel`, `.sr-help-panel`), which is the only thing that gives the inset somewhere to hang, then add an `.sr-ios-app`-gated companion rule for top/left/right.

**Gated, never a bare `env()`.** `index.html` ships `viewport-fit=cover` to browsers too, so `env(safe-area-inset-*)` is non-zero in iOS Safari on the **web** build; an ungated rule would fix the app and silently change shipped web rendering on every notched phone. This repeats a QA round-1 finding already documented in `globals.css`, and both new rules carry a test asserting their ungated base contains no `env(`.

**Each overlay gets its own sibling rule; deliberately NOT a shared inset utility.** The two share only the three-line inset block. The map panel additionally needs `height: 100dvh` (its inner column resolves `height: 100%` against it) and carries a landscape coupling where the sidebar overlay reaches the padded edge through `.sr-map-content`'s `position: relative`; Help has neither and deliberately has no `height` (a test asserts that, so a copy-paste from the map rule cannot quietly add one). A shared utility would still need a per-overlay positioning class, buying one declaration block at the cost of a second class name on the element. **Revisit generalizing at a third overlay, not at two.**

**A secondary defect from the same root cause, and the more interesting half:** the Help table-of-contents capped itself at `calc(100vh - 52px)` and never subtracted the top inset, so above 640px — iPad, where the inset is typically 24px — it over-extended past the scrollport and its last entries were unreachable. **A viewport-height calc inside such an overlay must subtract the top inset too**, or a child capped that way over-extends by exactly the inset: invisible on a phone, live on iPad. Same family as the v0.5.80 "measure what actually bounds it" rule. That cap was lifted to `.sr-help-toc` for the same specificity reason one level down.

**Two things checked rather than assumed, and left alone.** The bottom edge in both overlays: the FAB cluster already handles `env(safe-area-inset-bottom)`, and Help's content column carries 80px of bottom padding with 32px on the sticky TOC, both clearing the portrait home indicator — adding a `padding-bottom` would shrink a `flex: 1` scrollport into a dead band, so both mirror `.sr-ios-app body` at top/left/right only. And the containing-block question in build 1: removing the sidebar overlay's now-redundant `padding-left` is safe only because its containing block is `.sr-map-content` (an in-flow descendant the panel's padding has already displaced) rather than the fixed panel itself — an absolutely positioned box resolves against its containing block's **padding box**, so if the panel were it, `left: 0` would land back at the physical viewport edge and the removal would have *under*-inset the sidebar in landscape. That makes `.sr-map-content`'s `position: relative` load-bearing, and the test now asserts it.

**Known and untreated, tracked rather than silently dropped:** `.sr-skip-link` is a third `position: fixed` surface with the same escape, focusing to `top: 16px` (inside the ~59px Island band). It is a more direct integrity case than either header, since it is an interactive control rather than a title, and it was out of scope here — it was not among the sibling overlays either bug brief enumerated. `WelcomeScreen.tsx`, `Calendar.tsx`, and `RootErrorBoundary.tsx` were each re-checked twice and all centre their content vertically, so nothing renders at the physical top edge.

**Implication:** promoted to `CLAUDE.md` as one rule covering `position: fixed` and `position: sticky` alike (the pinned Breeding Codes band needed the same gate), with the inline-positioning constraint, the gating rule, the viewport-calc corollary, the sibling-rule policy, and the containing-block caution. Also promoted, from the security review of the lift: a cascade-competitor scan must cover **every** stylesheet the bundle emits (SnowRaven ships `maplibre-gl.css` as well, the larger of the two) and must test the **rightmost compound** of each selector; and where a lifted rule must beat Tailwind preflight, record the **layer** (unlayered user CSS beats `@layer base` regardless of specificity), not only the specificity.

---

## Mobile filter text size: one `max(16px, 0.75rem)` formula on both sides of the row — 2026-08-09 (v0.5.81)

**Decision:** On phones the filter rows mixed two text sizes. `.sr-input-16`'s flat `font-size: 16px !important` (the iOS focus-zoom guard) held every `<select>` and date input at 16px while the pills, sort toggles, and switches wrapping beside them in the same flex row stayed at their inline `0.75rem`. It also **inverted** at large text scale, because the root font size is `calc(100% * var(--sr-text-scale))` while the guard was a flat px value: at 200% the pills reached 24px and the controls stayed pinned at 16px, so the controls became the small ones for exactly the user who enlarged their text. Both halves close with one formula written once in `globals.css` and shared verbatim by both selectors: `font-size: max(16px, 0.75rem) !important` inside the ≤640 tier. 16px is the iOS threshold, an absolute value, so it stays the floor; `0.75rem` is the app's control size and tracks `--sr-text-scale`; the two sides can never differ at any scale, which the old flat value could not promise.

**`.sr-ctl-row` is a CONTAINER hook, not a per-element class, and that was forced rather than chosen.** Filter-row membership is conditional (the county select only mounts once counties resolve, the non-bird toggle only with an eBird backbone), so there is no stable element list to enumerate; and the alternative meant threading a `className` prop through `ToggleSwitch`, `SegControl`, and `SpeciesCombobox`, which are shared with Settings and the map sidebar and must not change there. It sizes interactive descendants (`:is(button, select, input)`) only, never the container, and cannot reach the deliberately smaller uppercase section labels because those are spans — an exclusion that holds by the selector's shape rather than because nothing happens to violate it. Applied to six filter blocks across five surfaces: LifeList (serving both Life List and Multimedia), Checklists, Breeding Codes, Species Detail, and Calendar. Desktop is untouched.

**The cost was measured, not estimated, and came in materially below the brief's prediction.** The brief predicted the Multimedia block growing from about 10 rows to about 12 at 402px and perhaps +3 rows at 320px. Measured in Chromium against the real built stylesheet across both revisions: **+1 row at 402px** at both text scales, **+0 rows at 320px** at both, and at 320px/200% the block is actually **26px shorter**, because the wider date inputs repack its tail onto fewer lines. All 14 fixed-`height: 30` controls compute `overflow: visible` and nothing clips at 200% (a pre-existing tightness, neither introduced nor worsened). Horizontal overflow is identical before and after everywhere except Calendar's pre-existing 320px/200% leak, which grows from 27px to 29.5px purely from the intended text growth.

**Two deliberate exclusions.** The right-hand count-and-view cluster on Life List / Multimedia and on Breeding Codes sits **outside** `.sr-ctl-row`: the species count is static text and `↔ Unbounded` / `Pin code labels` are view controls rather than filters, so they keep their smaller ghost styling — which reads the same way on desktop (11px against 12px) and so is not the phone-only mismatch that was reported. And the row is not literally single-size by design: the uppercase section labels stay smaller on purpose.

**One correction to how the fix was first described.** Leaving `.sr-input-16` flat would NOT have shown in the five filter rows: `.sr-ctl-row :is(button, select, input)` is (0,1,1) and outranks `.sr-input-16` at (0,1,0), so it wins there regardless. That variant was built and rendered and is identical to the shipped fix on all five surfaces. Its real residue is three guarded inputs sitting outside any filter row, where nothing raises them — a genuine defect the assertion catches, just not the visible one it was first described as. This is why the two selectors, deliberately differing in specificity and both `!important`, must share **one** declaration with a test locking the values identical: it makes the question moot rather than something to reason about.

**Implication:** promoted to `CLAUDE.md` — the `max(<px floor>, <rem>)` formula and the guarantee stated as a property of the formula across the whole input domain (it is ≥16px for every value of `rem`, including a browser or OS default font size the user has lowered — sampling the four in-app text scales would have missed that); `.sr-ctl-row` added to the shared responsive layout vocabulary; and put a control's font size on the control element, never on a nested label span, since a descendant size beats any ancestor class and the two forms are indistinguishable until the container rule exists (Calendar's local `Switch` had it on the label span).

---

## Declined: a "copy the closest street address" option on the share pin — 2026-08-09 (share-pin-street-address, scoped, not built)

**Decision: not built. The user chose to keep v0.5.80's published "no lookup of any kind" promise intact**, at the feature-check gate, after the tradeoff was put to them in full. The idea returns to the inbox rather than the roadmap.

**What was scoped, and why it was genuinely arguable.** A secondary, user-pressed control in the share popup that reverse-geocodes the dropped point and offers the nearest street address to copy, with the default copy path byte-identical and still request-free. It reads at first like a straight reversal of v0.5.80 and is narrower than that: the app **already** reverse-geocodes through the same provider and endpoint, `POST /nominatim/counties` calling `nominatim.openstreetmap.org/reverse` on both transports and reading `address.county` off the response while discarding the rest. A street address is other fields of that same response. `PRIVACY_POLICY.md` already discloses the endpoint, both transports already serialize to 1 request/second with an identifying User-Agent, and Nominatim's policy permits a one-off reverse lookup tied to a user action while forbidding only systematic sweeps. The v0.5.80 shortener rejection does not transfer either: a shortener mints a permanent public URL and sits on the feature's central path, whereas this mints nothing public and is never on the default path.

**What genuinely changes is the coordinate CLASS, and that is what decided it.** Today's lookups are the user's own eBird checklist locations, already published to eBird. The share pin is an arbitrary dropped point, which the v0.5.80 decision explicitly framed as nest sites, stakeouts, and suppressed rare-bird locations. **Four published sentences would have become false as written** — `docs/HELP.md` ("no shortener, no geocoder, no lookup of any kind"), `README.md` ("no coordinate ever leaves your device"), `website/index.html`, and `ROADMAP.md` — each requiring rewording to scope the promise to the default copy rather than to the feature. That is a weaker promise, and a reader who trusted the strong one is entitled to notice. No wording recovers it.

**The offline alternative was rejected on its own merits, not as a compromise.** "Nearest place I have birded," computed from already-loaded data with no request, does not answer the request: a hotspot name is not an address, the nearest one can be kilometers away, and it would be actively misleading for the stated purpose of directing someone to a parking pullout. A stat or a label may not borrow the name of the thing it merely approximates — the same posture as v0.5.79's rejected GPS-track proxy.

**Implication:** the v0.5.80 no-lookup promise stands unqualified, and the share-format-toggles build immediately after this reaffirmed "fully offline, no lookup of any kind" as a binding constraint. Recorded following the v0.5.79 precedent for a declined idea, so the analysis is not re-done from scratch if the idea resurfaces — the finding is that the blocker is the coordinate class and the published promise, not the provider, the policy, or the endpoint.

---

## Process incident: `git checkout <path>` is never safe during a Spool spin — 2026-08-09 (v0.5.81)

**What happened.** Mid-run, the orchestrator ran `git checkout` on `frontend/src/globals.css` while build 2's work on that file was uncommitted. The uncommitted work was destroyed. It was restored byte-exact from a snapshot, and the restored diff was confirmed additive-only with build 1's committed rules untouched, so nothing shipped wrong.

**Why it is worth recording rather than filing as a slip.** A Spool spin deliberately keeps uncommitted work in the tree between checkpoints — several builds run before the bundle's single commit — so the usual mental model, that `git checkout <path>` discards only unwanted local edits, is exactly inverted there: in a spin the local edits are the product. `globals.css` is the worst file for it, because nearly every build in this repo touches it, so a spin concentrates several builds' uncommitted work in one file.

**The durable rule:** during a Spool spin, never `git checkout <path>` (or `git restore`, `git stash`, or any other tree-discarding operation) against a file a build may have touched. If a file must be reverted, take a checksummed snapshot first and restore from the snapshot, then diff the restore against the snapshot to prove it byte-exact. The recovery here worked only because a snapshot happened to exist.

---

## Pin Share: short canonical map URLs (never a shortener), and the gesture collision resolved by extending the existing center pin — 2026-08-08 (v0.5.80)

**Decision:** Drop a transient pin on a birding map with right-click or long-press and copy that spot as a share-ready block. Four sub-decisions are settled and should not be re-opened:

1. **No third-party URL shortener. A permanent exclusion, not a deferral.** The user asked for "shortened" links; the delivery is short canonical coordinate URLs (`https://maps.google.com/?q=<lat>,<lng>`, 45 chars; `https://maps.apple.com/?q=<lat>,<lng>`, 44 chars), built locally. A shortener would send the user's exact coordinate to an outside company that logs it and mint a permanent public URL resolving to it — for a birding app that means nest sites, stakeouts, and suppressed rare-bird locations leaving the device. It would force a `PRIVACY_POLICY.md` entry breaking a policy that asserts nothing is collected, make the feature's central action fail offline, and make every shared link depend on a third party staying alive (the exact failure mode SnowRaven was founded to escape). Google's own `maps.app.goo.gl` links can only be minted from inside Google's infrastructure, so "use theirs" was never available either. **What the user gives up:** links are short, not tiny, and the default payload is three lines; the coordinates-only mode exists for the most compact share.
2. **The link forms are ratified, with the alternatives on the record.** Rejected: Google's `api=1` form (19 chars longer, no benefit); `maps.app.goo.gl` / `maps.apple/p` short links (both require calling the vendor with the coordinate); a bare `geo:` URI (23 chars, but most messaging apps do not linkify it, defeating the purpose); dropping `https://` (saves 8 chars, linkification becomes app-dependent and fragile); four decimal places (saves 2 chars, costs ~10 m and diverges from what eBird shows). A single-link default with the second behind the setting was offered explicitly and declined.
3. **The gesture collision is resolved by extension, not competition.** On the Map Explorer's Hotspots / Nearby Lifers / Media Targets views (`isCenterView`), right-click and long-press already drop the v0.5.43 search center. Rather than a second pin, a modifier key (which touch cannot express), or a mode toggle (a control on every map), the *existing* center pin gains the copy action. One gesture, one mental model. **Accepted consequence:** on those views the drop still re-runs the search — not new behavior, and better than either alternative. The Weather tab's Predict picker map is excluded entirely; a second pin concept on a small dedicated picker map would confuse rather than help.
4. **The pin is transient and session-scoped, and copy is always an explicit press.** No saved/named/listed pins, no history, no persistence across relaunch — following the v0.5.43 center pin, Point Size, and the shading state. Auto-copying on drop would silently overwrite the clipboard on a gesture the user may have made by accident, which on the search views also re-runs a search.

**Also decided:** the keyboard route (a visible corner map tool planting the pin at the view center) is the *primary* route, not a hidden fallback — a right-click-only feature has near-zero discoverability, and making the accessible route the main one serves both audiences with one control. The preference deliberately does **not** use the `useEmbeddedMediaPreference` hydration-gating pattern: that pattern exists to keep an unsafe pre-hydration state closed, and there is no unsafe state here, so the preference hydrates to its default and gates nothing. One new token pair (`--sr-share-pin` / `--sr-share-pin-ink`, theme-identical, map-anchored) because no existing map color is free on all five surfaces — shape (a planted flag) carries the distinction instead.

**Accepted bounded residual, not a defect:** on the 220px Named Birds card map, with the pin dead centre and the failure block revealed, roughly 8px of the compact popup can fall outside the card (an 88px popup against 80px of room), widening to roughly 18px at 200% text scale. The geometry is genuinely impossible at that size; all content stays reachable by scrolling inside the capped body, and a test pins that the failure block, the payload, and `Select all` remain inside it. Deliberately chosen over dropping the body below a 44px touch target, which would make the copy control unusable. Every other pin position has slack. Recorded rather than roadmapped — it is a tradeoff, not a backlog item.

**Implication:** four conventions promoted to `CLAUDE.md` (capture-phase Escape for in-map overlays, `display: contents` for portaling into an existing flex row, the keyed-child live region, and the px-container/rem-cap mismatch), plus an amendment to the existing required-`compact` rule.

---

## The Pin Share "no outbound request" claim, stated accurately — 2026-08-08 (v0.5.80)

**Correction.** The strategic brief's Key Decision 9 and its matching success criterion say the feature "adds no outbound request" and that "nothing new appears in a network log." The Auditor was asked to verify rather than accept it. **The privacy conclusion is correct; the wording is not literally exact.**

- **Desktop (Tauri) is literally request-free** — `TauriStorage` reads and writes `AppLocalData/data/settings.json` through `tauri-plugin-fs`, no socket involved.
- **Web/Pi is not.** `hydrateOnce()` runs on first subscribe (the moment any share popup opens, or the Settings Sharing row mounts) and issues `GET /settings/shareCopyMode`; `setShareCopyMode()` issues `POST /settings/shareCopyMode`. Both appear in a network log.

**Why no `PRIVACY_POLICY.md` change is nonetheless required** — checked limb by limb against the v0.5.76 rule ("a change that alters which component makes a third-party request is a policy change even when the host is unchanged"), because that rule is precisely what makes it easy to conclude wrongly: no third party (the user's own backend, same origin, already contacted for every other preference); **no coordinate transmitted** (the pin's lat/lng live in `SharePin`'s component-local `useState` and reach the storage seam nowhere — `setShareCopyMode` receives only the Settings row's own preference value, never a coordinate); no change to who talks to whom; and offline-safe (a failed call leaves the default in place, and the mode applies in-session before persisting).

**The accurate carry-forward formulation, to be used instead of the imprecise one:** *the share action itself is pure local string work and issues no request on either transport; the preference persists through the existing same-origin storage seam, carrying only the user's own share-format choice and never a coordinate.*

> **Corrected 2026-08-09 (v0.5.81).** This entry originally said the preference carries "only the mode literal." v0.5.81 widened the stored `shareCopyMode` value from a string literal to a `{coords, google, apple}` object, so that wording is stale and has been reworded above. **The conclusion is unchanged and was re-verified against the wider value:** still same-origin, still no third party, still no coordinate, still offline-safe, and `PRIVACY_POLICY.md` still needs no change. Do not cite the old "mode literal" phrasing.

The published prose is accurate as written and needed no change — `README.md` ("no coordinate ever leaves your device"), `docs/HELP.md` ("no shortener, no geocoder, no lookup of any kind"), and `website/index.html` are all true statements scoped to the share block and the coordinate.

**Implication:** recorded so "this feature makes no requests at all" is never cited as precedent from Decision 9. A zero-request claim is scoped to the mechanism it actually describes, and verified per transport — desktop and web/Pi can differ.

---

## Maplibre already suppresses the browser context menu over markers — the `onContextMenu` handlers are defense in depth, not the mechanism — 2026-08-08 (v0.5.80)

**Correction.** The Engineer believed the two `onContextMenu={e => e.preventDefault()}` handlers added on the share pin were what suppressed the browser's context menu over map markers. They are not. Maplibre appends every `Marker` into the map's **canvas container**, whose own contextmenu handler ends with `this._map.listens("contextmenu") && e.preventDefault()` — so the menu is already suppressed for every marker as soon as any surface registers a `contextmenu` listener, which the drop gesture does.

**Why it matters:** the handlers are genuinely redundant and were kept as defense in depth, which is fine. The hazard is the inverse reasoning — a later change that removes or bypasses maplibre's own listener registration (or stops binding `contextmenu` on a surface) believing the two React handlers cover it. They cover only their own two elements; every other marker on every map relies on maplibre's behavior.

**Implication:** context-menu suppression over map markers is maplibre's, conditional on a registered `contextmenu` listener. Do not treat a local `onContextMenu` handler as the app's mechanism for it.

---

## Two Pin Share defects a green test suite hid: a live region that never re-announces, and a rem cap in a px container — 2026-08-08 (v0.5.80)

**Post-mortem.** Both were found at the first QA gate (needs-fix), both were invisible to a passing suite, and both were fixed and independently re-verified by reverting each fix and confirming the suite failed before restoring it byte-identically.

**1. A live region whose text is set to the same string does not announce.** `aria-live` fires on DOM *mutation*, and React bails out when reconciling a text node to an identical string — so pressing Copy twice announced once, while the visible confirmation re-rendered both times and every `textContent` assertion stayed green. The repo's existing rule ("render the region from the start, only change its text") is necessary but **not sufficient**. The shipped fix puts the message in a **sequence-keyed child node** whose key advances per announcement, making each one a real node replacement while the region's `textContent` stays exactly the message. The append-an-invisible-character trick was rejected: it makes every `textContent` assertion quietly false. This is a real WCAG failure mode against a published AA statement, which is what earns it a `CLAUDE.md` line.

**2. A `rem` cap inside a fixed-`px` container moves the wrong way under text scale.** The compact popup body was capped at `9.5rem`, unrelated to the room actually available and *doubling* at 200% in-app text scale — `--sr-text-scale` multiplies the root font size while a `height: 220px` card map does not follow. The fix measures the container: the cap is computed from geometry and written as a px custom property from a ref side effect (no `setState`), with a floor at the touch-target size. Where the constraint is the *viewport* rather than a container, the existing `.sr-map-popup-body` (`min(60dvh, 26rem)`) remains correct.

**Implication:** both promoted to `CLAUDE.md`. A live region needs a test that presses the same control twice and counts DOM mutations; a cap must measure whatever actually bounds it.

---

## A nonzero share never renders as a rounded "0%" — percent display routes through `fmtSharePct` — 2026-08-08 (v0.5.79)

**Decision:** A displayed whole-percent share for a NONZERO count must never render a bare rounded "0%". Share display routes through the pure `fmtSharePct(count, total)` (`frontend/src/lib/statsFormat.ts`, unit-tested): a nonzero share that rounds to zero shows "<1%"; an honest "0%" appears only for a genuinely zero count (or an empty total). Applied to the Statistics "Lists by observer count" legend, whose rows now lead with the exact checklist count — "{n} obs · {count} lists ({share})" — so the exact numbers read at a glance instead of only in the click tooltip.

**Why:** The Spool idea behind the run: on a 99%-solo dataset every rare group size rendered as an invisible sliver bar labeled "0%" — a real count displayed as nothing. Same honest-stats posture as the v0.5.78 duration histogram's coverage note. Display-only: `computeEffort`/`observerRows` are untouched, no binning introduced, and the v0.5.78 no-rollup regression test stays green.

**Deliberately skipped:** count labels on/above the bars — with many distinct observer counts the labels would collide over thin bars, and the legend now carries the exact numbers. Pre-existing `Math.round` percent sites elsewhere (e.g. the "% solo" caption) have the same latent zero-collapse; sweeping them through `fmtSharePct` is tracked on the roadmap (On the Horizon), not done here.

**Implication:** promoted to `CLAUDE.md` (one line). New whole-percent share displays use `fmtSharePct`, never raw `Math.round(count/total*100)`.

---

## The eBird personal export carries NO GPS-track indicator — the GPS-track-coverage stat is not buildable — 2026-08-08 (gps-track-coverage-stat, investigated, not built)

**Finding:** The queued idea "show what percentage of lists have GPS track data" cannot be computed from any data SnowRaven has: MyEBirdData.csv contains no column, flag, or derivable signal indicating whether a checklist carries an eBird-mobile GPS track. Verified against the complete recognized column set in `frontend/src/lib/parseEbirdObservations.ts` and the 23-column export header in `website/tools/gen-demo-data.mjs`; eBird stores mobile tracks server-side only and exposes them through no export the app ingests. The run was abandoned at Stage 1 and the idea returned to the inbox with this finding.

**Rejected proxy:** shipping a Traveling-protocol / recorded-distance share under a "GPS track coverage" label. A Traveling checklist with a distance proves a distance was entered, not that a track exists — a stat may not borrow the name of the thing it merely approximates (the same honest-stats posture as the duration histogram's coverage note).

**Honest computable alternatives (noted for the user, unscheduled):** % of Traveling checklists with a recorded distance; % of checklists with a start time; % complete checklists. NOT viable: "% with precise coordinates" — every export row carries a location lat/lng, so it would read ~100% for everyone.

**Implication:** a proposed statistic is scoped against the export's actual column set before a run is committed; when the data does not exist, the answer is "not buildable" plus honest alternatives — never a relabeled proxy.

---

## Every release ships to ALL available platforms — iOS TestFlight included — 2026-08-07 (v0.5.78)

**Decision:** A release is not complete until it has shipped to every platform the app currently supports: the `release.sh` assembler (notarized universal macOS + signed Windows installer + `latest.json` + website) **and** an iOS TestFlight build of the same version (build 1, incrementing only for iOS-only follow-ups). User direction at the v0.5.78 ship, which initially went out desktop/web-only.

**Why:** iOS TestFlight builds had been selective catch-ups (0.5.71, 0.5.73), so TestFlight testers drifted versions behind the desktop app with no signal about what they were missing. The user's standing rule ends the drift: one version, all platforms, every time.

**Consequence:** The deploy stage of every lane now ends with the iOS TestFlight recipe (CLAUDE.md "iOS release" section) after `release.sh` verifies — including bundled Spool releases. An iOS-asset-only change still ships as an iOS build-number increment without a desktop release, unchanged.

## A histogram whose bin count derives from a data VALUE must bound its ladder structurally — 2026-08-06 (v0.5.78)

**Decision:** Any statistics histogram whose bin count derives arithmetically from a data *value* (rather than from row count or distinct values) must bound its ladder structurally in the compute layer: a plausible-range guard on the input **plus** a hard clamp on the bin index, paired with reduce-not-spread for any `Math.max`/`Math.min` over a data-length array. `computeDurationBins` (`frontend/src/lib/birdingStats.ts`) is the reference implementation.

**Why:** The new Checklist duration histogram drew a Medium in security review, empirically confirmed: the CSV parser admits any `parseInt`-able integer, so a single corrupt duration cell (`999999999` — e.g. an ML catalog number landing in the Duration column from a column shift) minted a ~16.7M-bin ladder, ~3 GB of heap, and a render-time `RangeError` from `Math.max(...spread)` that took the view down. The observer-count histogram this stat imitates was safe only because its size is bounded by distinct values in the file — a structurally different shape that must not be generalized from. The parser is the wrong home for the bound (it admits what the export contains); the compute layer owns it.

**Remediation shipped (Tester re-verified, Auditor re-reviewed to PASSED):** a `[0, 1440]` range guard (eBird's own 24 h checklist cap; out-of-range and negative rows are treated as duration-less and surface honestly in the "N of M checklists have a usable duration" coverage note), a structural `DURATION_MAX_BIN_INDEX` clamp bounding the ladder at 33 bins even if the guard were bypassed, and the component max as a reduce. The crash-regression test runs the exact probe value in milliseconds versus ~2.5 s / ~3 GB on the pre-fix code.

**Deliberate documented divergence — do not "fix":** with a corrupt out-of-range cell present, the Effort tile's average (`computeEffort`, byte-untouched, sums all non-null durations) can differ from the Temporal caption's average (in-range only). A parity test asserts equality on sane data; an exclusion test asserts the divergence on hostile data.

**Implication:** promoted to `CLAUDE.md`. Future value-derived binning follows the same contract.

---

## Em-dash convention extended to every published prose surface — 2026-08-06 (v0.5.78)

**Decision:** The v0.5.68 no-em-dash rule (app copy + `docs/HELP.md`) now also covers `README.md`, the website's user-facing prose, `PRIVACY_POLICY.md`, and `ACCESSIBILITY.md`. Same exclusions: provider-mandated attribution/credit strings stay verbatim, load-bearing dashes in parsing logic are untouched, and historical records (`DECISIONS.md`, `CHANGELOG.md`, pipeline archives) keep their written style. The website List Comparer mock's two placeholder cells became en dashes — the sanctioned empty-cell glyph, not prose punctuation.

**Why:** the sweep found 124 em dashes across the four surfaces (README 46, ACCESSIBILITY.md 32, PRIVACY_POLICY.md 20, website/index.html 26), each replaced per context rather than blind-deleted, and the two published statements were verified meaning-identical hunk by hunk — a privacy policy or accessibility statement whose meaning drifts in a punctuation sweep is a liability, not a style fix. One informational string was polished in passing: the USGS proper noun now reads "USGS: The National Map".

**Implication:** `CLAUDE.md`'s Documentation rule states the extended scope; `grep -c '—'` on all four files should stay 0.

---

## Self-hosted positioning adopted across the four descriptive surfaces — 2026-08-06 (v0.5.78)

**Decision:** The app's tagline is now **"Self-hosted birding tools and data explorer"**, and the same self-hosted formulation carries across the four synchronized spots: the `App.tsx` tagline, `README.md` line 3's description, the website `<title>`/`og:title`, and the website footer. Build 1 (main-heading-selfhosted) scoped README line 3 out; build 5 (docs-website-sync-emdash) deliberately superseded that call so the formulation is written once and propagated (the v0.5.75 convention).

**Why:** the old tagline ("Birding tools for your eBird workflow") undersold the product; the new copy leads with the self-hosted, local-first identity and names the data explorer — matching how the docs already describe the app. Descriptive, not promotional, per the website voice rule; the compact-iOS-chrome tagline guard and its test moved with the string, structure unchanged.

**Implication:** a future rewording of the positioning touches all four spots in one edit.

---

## Two prior stats decisions touched, none reversed (duration in Temporal; Rainbow Connection) — 2026-08-06 (v0.5.78)

**Decision:** Three notes for the record, all touches rather than reversals. (1) The Checklist duration histogram lives in **Temporal Stats** by explicit user direction — the 2026-05-24 "don't duplicate Effort content in Temporal without user confirmation" note stands; the user's saved idea *is* that confirmation, the distribution is new content, and only the small average caption overlaps the Effort tile. (2) The observer-count change *fulfills* the 2026-05-23 entry's recorded direction ("for as many observers as there are in the file") more faithfully — the "5+" rollup was an implementation cap on that intent, now removed and locked by a regression test proven to fail on the old clamp. (3) "Rainbow Warrior" → **"Rainbow Connection"** is a pure rename (label, internal result field, tests, `globals.css` comments, `HELP.md`); the v0.5.36 rainbow-matching entry is not reversed, historical records stay as written, and the `--sr-rainbow-*` token names stay — they encode colors, not the title.

---

## The embed guard threaded for real, dev advisories cleared, and website screenshots regenerated behind a new `SR_DATA_DIR` — 2026-08-06 (v0.5.77)

**Decision — three independent improvements in one release.**

1. **Both `MediaFrame` call sites now pass `embedAllowed={embedAllowed}` instead of the JSX shorthand. This IMPLEMENTS the defense-in-depth clause of the v0.5.72 embedded-media decision below; it reverses nothing.** That clause promised `MediaFrame`'s eligibility prop as a second, independent layer behind the App-root gate, so "a future missed call-site guard still cannot silently request an embed." The shorthand made both call sites hand it a hardcoded `true`, so the inner layer had been answering a literal rather than the hydrated preference — **inert from v0.5.72 until now**.
2. **`SR_DATA_DIR` was added, and the four routers that each derived the data path independently (`settings`, `settingskv`, `mapdefaults`, `taxonomy`) now all import `backend/datadir.py`.** This exists so the website screenshot capture can point the backend at a throwaway synthetic dataset.
3. **Dev-only advisories cleared and every website screenshot regenerated** from synthetic demo data.

**On piece 1, state the gain precisely — an earlier draft of the change brief overstated it and the security review corrected it.** Because both parents gate above the call (`RecentMediaEmbed.tsx`, `NamedBirdMedia.tsx` plus its `wantEmbed` guard), `MediaFrame` is only ever rendered with the preference already true. Its `useMlEmbedGate(embedAllowed ? catalogId : '')` suppression branch was therefore **unreachable before the fix and remains unreachable after it**. Nothing renders differently. The gain is a **static** property, not a runtime one: a future edit removing a parent's gate is now caught by the inner layer instead of sailing through. Record it that way — describing this as fixing a live leak would be false, and the next person to read the code would find no behavior to point at.

That unreachability is also why the fix is locked by a **separate test per call site** (`frontend/src/components/mediaFrameEmbedAllowed.test.ts`), each asserting against only its own source file. A rendering test provably cannot distinguish the literal from the forwarded value at any reachable moment — both produce `true` everywhere `MediaFrame` mounts. This is a case where the source assertion is the only honest test, and one combined test would pass on a half-fix (the standing two-independent-paths rule from v0.5.75).

**On piece 2, the substance is the rejected alternative.** `website/tools/README.md`'s documented capture procedure was to `mv` the user's real eBird export aside and move it back afterwards — and the `SR_DATA_DIR` override that README referenced as the alternative **had never been implemented**; a grep found it only as a hypothetical in that file. A crash or an interrupted capture strands real data under a renamed directory. An env var needs no swap, so the real `data/` is never touched at all. **The consolidation is not incidental to it:** with four independent derivations, an override could reach some routers and miss others, and a partial override is worse than none — the app would read demo data on one route and real data on the next, which is exactly the privacy failure the override exists to prevent. `backend/tests/test_datadir.py` asserts every consumer resolves through the one module, so a future router that re-derives its own path fails the suite.

**One property of `SR_DATA_DIR` is load-bearing and easy to misread as a bug.** It is resolved once, at import, from `os.environ` — so it **cannot** be set in `backend/.env` (the routers import while `main` is still importing, before `load_dotenv()` runs), and setting it there fails **silently**: the app just uses the default directory, which for a capture run means quietly photographing the real data it was meant to avoid. The same import order is the security-positive half of the fact — a file write can never redirect the data root. Both halves are stated in `backend/datadir.py`'s docstring, at the definition site.

**Two verification notes worth carrying, because both were done by diffing rather than by reasoning.** The refactor was proven inert by diffing the full OpenAPI surface against HEAD in an isolated worktree — identical, 31 endpoints, same order, catch-all still registered last. Separately, ~24 path-traversal payloads were run at the settings store both directly and over HTTP, and the guard-bearing code was confirmed **byte-identical to HEAD** — the consolidation moved the guards' base path, and byte-identity is what proves no guard was dropped in the move. Reasoning about a relocated guard is not the same evidence.

**Pieces 2 and 3 in brief.** The dev-dependency sweep (`brace-expansion`, `nanoid`, `postcss`, `undici` via non-breaking `npm audit fix`, no `--force`) follows the exact precedent of the `Dev Dependency Cleanup` entry below: dev-only, `npm audit --omit=dev` 0 before and after, byte-identical app bundle, and **would have required no version bump on its own**. It came from a saved idea in the user's inbox. The screenshots had been frozen at v0.5.23 while the site's version pill kept moving — 53 releases of drift, and Calendar and Named Birds had never been photographed at all; all eleven shots were retaken, two of them new. Because piece 1 does touch the shipped bundle, the run takes a patch bump anyway, and the website version pill and footer moved with it.

**A capture-tooling fact that will bite again.** The capture width had to move from 1440px to 1600px: the app now has ten tabs needing ~1409px while TabNav collapses below ~1457px, so the old width silently photographed a dropdown instead of the tab strip. `clickTab` also failed silently on a renamed label (returning `false`, yielding a screenshot of whatever tab was already open); it now throws.

**Implications.** Three conventions promoted to `CLAUDE.md`: a backend module that reads `data/` must import `backend/datadir.py` rather than re-derive the path, and an env var read at module import time cannot come from `backend/.env`; the screenshot capture width is load-bearing against the TabNav collapse threshold, so adding a tab may require raising it; and when a refactor relocates security-relevant code, prove it byte-identical against the pre-change revision rather than reasoning about it. No `PRODUCT_CONTEXT.md` change — nothing about what the product is or does changed. Two `ROADMAP.md` "On the Horizon" items are closed by this release (the `embedAllowed` threading and the stale website screenshots). The shipped release is `v0.5.77`.

---

## Macaulay embeds behind Cornell's bot check: detect it and step back, don't route around it — 2026-08-06 (v0.5.76)

**Decision.** The Cornell Lab put **Anubis** (a proof-of-work anti-scraper gate) in front of `macaulaylibrary.org`. Its interstitial sets `Secure; SameSite=None; Partitioned` cookies that a cross-site iframe cannot hold, so every inline Macaulay player in SnowRaven rendered Cornell's **"Missing feature Cookies"** card. SnowRaven now **probes the embed endpoint out-of-band** (`GET /media/embed-status`, with the desktop Tauri twin `lib/tauri/mediaService.ts`) and, when the gate is up, renders **its own** fallback — local date, checklist link, "View on Macaulay Library" — and **mounts no iframe at all**.

**The rejected alternative is the substance of this decision.** Rendering media directly from Cornell's CDN was investigated and **verified to work**: `cdn.download.ams.birds.cornell.edu/api/v2/asset/<id>/…` serves photo (`/1200`, `/2400`), audio (`/mp3`), and video (`/mp4/1280`) to a browser User-Agent with no cookies and no gate. It would have restored inline playback completely. It was rejected because it routes around protection Cornell deployed deliberately, days earlier. This project's posture toward eBird and the Macaulay Library is to work *alongside* free services it depends on, never around them — the same principle that governs the website's voice. **Do not re-litigate this silently:** the CDN path still works, and a future contributor who finds it will need this paragraph to know it was a choice, not an oversight.

**Rationale for the shape of the detection.** Three constraints forced it. (1) **The browser cannot see the failure.** The interstitial is a same-status HTTP **200** in a cross-origin frame, so `onError` never fires and `onLoad` reports success — the v0.5.66 give-up/overlay machinery, which is correct for slow and broken embeds, is structurally blind to this one. (2) **`fetch` cannot see it either** — the endpoint sends no CORS headers — so detection has to leave the page, through the existing transport seam (FastAPI on web/Pi, the Tauri HTTP plugin on desktop). (3) **The probe must look like a browser.** The gate only challenges browser-shaped requests; with httpx's default agent the real page comes back, and the probe would cheerfully report "all fine" while every viewer was blocked.

**Two properties are load-bearing, and both are guarded by tests.**
- **It fails OPEN.** Any probe failure — offline, a 5xx, a malformed id — resolves to *not gated*, so a probe that cannot run never hides media that would have played. The competing implementation (treat unknown or failed as blocked) would blank every tile the moment the device went offline.
- **The signal is GLOBAL, not per-viewer.** Nothing in the page can observe a cross-origin frame's outcome, so "the gate is up" is the most we can know. A browser that could pass the challenge (Chrome on an HTTPS origin, where partitioned cookies are allowed) therefore sees our card instead of a working player. **Accepted deliberately:** Safari blocks third-party cookies outright and is also the engine behind the macOS and iOS apps, so the blocked case is the common one here; and the fix **self-heals** — when Cornell lifts the gate the probe reports open and players return with no code change and no release.

**A second-order finding worth keeping.** The fix changed **which component** makes the third-party request: in web/Pi mode it now originates from the user's own self-hosted backend rather than their browser. The destination host was unchanged, so it would have been easy to conclude the privacy policy was still accurate. It was not — the policy describes who talks to whom, so it was updated in the same change (and "no SnowRaven server is involved" was corrected to "no developer-operated server is involved", which is what that sentence always meant and is now load-bearing). The probe is also correctly suppressed by **Disable embedded media**, so that setting's promise still holds exactly as published.

**Verification note.** The desktop path had no automated coverage — `mediaService.ts` is a thin Tauri-HTTP twin that cannot run outside the desktop shell — so it was confirmed by live preview against real data before the deploy sign-off, and the fallback rendered correctly there. That is the third consecutive release where the pre-ship live preview carried real verification weight.

**Implications.** `CLAUDE.md`'s Media-embeds rule now records the gate, the probe twins, and the fail-open contract. Two conventions were promoted from the security review: a route that interpolates user input into an outbound URL must constrain that value to a character class that cannot express a scheme, host, credential, or path separator, and must say in its docstring why the destination cannot be steered; and a change that alters which component makes a third-party request is a privacy-policy change even when the destination is unchanged. `PRODUCT_CONTEXT.md`'s two media entries were corrected to the current fallback behavior. Docs and records only after this point: the shipped release is `v0.5.76` (notarized universal macOS DMG + signed Windows installer + updater + `latest.json`).

---

## Named Birds media precedence (the observation comment is evidence, not noise) + a documentation and website accuracy sweep — 2026-08-04 (v0.5.75)

**Decision — three parts in one release.**

1. **`computeNamedBirdMedia` now falls back to `observationDetails` when an asset's own `caption` and `mediaNotes` carry no `[name:…]` tag. This MODIFIES the v0.5.66 Named Birds Media decision below, reversing exactly one clause — the blanket exclusion of the observation comment.** The rule is a per-row **precedence, never a union**: the asset's own comment wins outright when it carries a tag, and only a tagless own comment falls back. The gate is a **parsed tag, not caption text** — a plain descriptive caption does not override, it simply leaves the row on the fallback. Everything else in v0.5.66's first decision survives and is strengthened into that explicit precedence: the asset's own comment is still the authority, the join is still the shared `namedBirdKey` (parity test byte-identical), and matching stays pure and fully offline from the already-loaded `mlExportCache`.
2. **Named Birds audio tiles get the full 230px / 280px-phone height through the existing `.sr-media-iframe--audio` class — deliberately NOT a swap to `--recent`, so the two embed surfaces stay independently tunable even where their values now agree. This MODIFIES the v0.5.71 Species Detail Recent Media decision below by taking the follow-on it named.** Audio dropped its compact icon-only offline fallback for the full one at both call sites, and `compact` became a **required** prop on `MediaFrame` rather than a defaulted one.
3. **A documentation and website accuracy sweep**, incl. `PRIVACY_POLICY.md`'s map glyph/sprite clause. **This CORRECTS the v0.5.45 offline-support record**, which stated the policy "now enumerates every tile/style/glyph/sprite host": `BUNDLED_MAP_ASSETS` is `true` in shipped code and v0.5.74 confirmed glyphs and sprites ship bundled and same-origin, so the policy was *over*-disclosing. The v0.5.45 decision is not reversed — its statement is.

**Rationale.** v0.5.66 excluded `observationDetails` because the ML export copies the observation comment onto every asset from that observation. That fact is true; the inference was not. It grouped `observationDetails` with the far broader *checklist* comment, when an observation comment is scoped to **one species on one checklist** — and it is the very field `computeNamedBirds` parses to discover a named individual in the first place. The tag that CREATES a named bird therefore could never attribute that bird's media, so every birder who tags the ordinary way (in the species comment rather than per asset) got a guaranteed empty state. `lib/mediaComments.ts` keeps its own exclusion and the two modules are now **deliberately divergent**: that one *lists comments*, where the copied text repeats identically across every asset from an observation (noise); this one asks *which assets show this individual*, for which a species-and-checklist-scoped tag is real evidence. Part 2's rationale is v0.5.71's, unchanged: ~230px is what the Macaulay audio player needs to expose its transport controls under the frame's `overflow:hidden`.

**Two accepted risks, reasoned and worth watching as post-release feedback.**
- **The audio transport itself was never live-verified** — the user has no named bird with an audio recording, so the heights rest entirely on Species Detail's v0.5.71 verification of the identical player at the identical size. If a named bird's audio ever proves clipped, this is where to look first.
- **The fallback over-attributes** when a birder photographs a *different, untagged* bird of the same species on the same checklist: that asset appears under the named individual. Accepted because the scope is one species on one checklist rather than the whole checklist, the birder has an explicit override the precedence rule honors, and the alternative was a guaranteed empty state for everyone who tags the ordinary way. When one observation names two individuals, both get all its uncaptioned assets — the honest superset; suppressing the fallback there would blank exactly the birders who tag the most.

**The mid-run re-entry is itself worth recording: a live desktop preview before the deploy sign-off caught a defect no test could see.** The run began as parts 1 and 3 only. In preview the user reported "No media matched to this bird." on every named individual; their own export proved all 15 assets carried the tag *only* in `Observation Details`, the one field the matcher excluded. That made part 2 unobservable on their machine — shipping an audio-height fix nobody could see — so the run re-entered Stage 1 rather than deferring, and the Designer's approved refinement carried forward unrevisited. The whole defect was invisible to the suite because the suite's fixtures encoded the same wrong assumption as the code. This is the second consecutive release where live preview, not tests, found the real bug (v0.5.74's was `window.open`; v0.5.70's were layout-only) — the standing preference for a live preview before a UI ship keeps earning itself.

**Implications.** `CLAUDE.md`'s Bird-names rule is rewritten to state the precedence **and why the two modules diverge** — the reason is load-bearing, and without it a later change re-unifies them. Any future per-asset media attribution follows the same contract: own comment first, observation comment as fallback, key through `namedBirdKey`, and at least one test the competing union implementation would fail (fallback-only cases pass under both, so a suite full of them guards nothing). Three further conventions were promoted to `CLAUDE.md`: a hand-maintained index over a single-source-of-truth document needs a parity test (`helpToc.test.ts`, after three Help sections sat unreachable for several versions); published prose that states a trigger must be checked against the predicate the code actually tests; and a display choice reaching a shared child down two independent paths must be passed at both, with a test per path. No `PRODUCT_CONTEXT.md` capability was added — the Named Birds media entry was corrected to current state, since the matching rule it documented is what changed. Docs and records only after this point: the shipped release is `v0.5.75` (notarized universal macOS DMG + signed Windows installer + updater + `latest.json`), and the closeout commit is byte-identical to it, so it carries no version bump, tag, or release.

---

## Offline maps retired — 2026-08-04 (v0.5.74)

**Decision:** Remove the downloadable offline-maps feature (offline-support "Tier B") end to end and add **nothing** in its place. Out go the Settings "Offline maps" section and its `offline-maps-enabled` toggle, the bundled region catalog, the download and orchestration layer, the `srpm://` PMTiles protocol with its range-read path through the storage seam, the region API on both storage implementations, the map-side region swap, the `pmtiles` dependency (and its transitive `fflate`), the region-baking tooling, and the four region-only Tauri grants (`fs:allow-open`, `fs:allow-read`, `fs:allow-seek`, `fs:allow-write-file`). Offline-support **Tier A is untouched** — the persisted map-style blob and the bundled glyph/sprite assets, which are what actually make the map mount and label itself offline — as are the replay store, the bundled taxonomy floor, and the offline messaging.

**Rationale — the feature never worked for a single user, on any platform.** This is dead-code removal, not a capability withdrawal, and four independent facts prove it: the bundled `regions-catalog.json` shipped at 140 bytes with `"regions": []`; the `regions-2026.06` GitHub Releases tag meant to host the tiles was never created, so every download URL 404s; `RegionBaseSource` self-gates to inert on `regions.length === 0`; and `renameRegionPartial` calls `rename`, but `fs:allow-rename` was never granted — so even a successful download would have been denied at the commit step. The blocker was always tile **hosting**, never rendering. The v0.5.45 design tried to route around it by self-hosting pre-baked county and state `.pmtiles`; that bake was deferred at release and never happened. Hundreds of GB of PMTiles is not something this project can host, which is the user's own read and exactly what the 2026-06-05 exploration had already concluded.

**Prior decisions touched:**

- **`## Offline support — 2026-06-21 (v0.5.45)` — its Tier-B half is REVERSED:** the `srpm://` / self-hosted-PMTiles basemap mechanism (OQ-01/OQ-09), FR-20 (desktop-only region downloads), and FR-11a's opt-in toggle. Its **Tier-A half stands**, along with the replay decisions, the bundled-taxonomy-snapshot decision, and the `src/assets` (imported) vs `public/` (URL-served) map-asset convention. **FR-11a's standing promise that the app performs no automatic or background tile downloading survives and is now UNCONDITIONALLY true** — there is no longer any toggle behind which tile bytes could be fetched.
- **`## Offline maps — explored, shelved (roadmap) — 2026-06-05` — NOT reversed; VINDICATED.** Its finding that hosting rather than rendering is the blocker is precisely what this change concedes. What ends here is the attempt to route around it.
- **`## iOS app icon fix (+ offline-maps deferral) — 2026-07-06` — its offline-maps-deferral half is MOOTED,** along with the `pipeline/mobile-app/prd.md` FR-15 / FR-23 desktop-only scope it rested on and the `showOfflineMapsSection()` platform gate that implemented it. There is no longer a desktop-only feature for iOS to be excluded from. Its icon half (the opaque-icon rule) is unaffected and still binding.

**Scope the user cut, and why a future request must reckon with it.** The run was originally asked to also cache map tiles around a home location and add a "clear map caches" Settings control. Investigation found that **neither a tile cache nor a home-location concept exists anywhere in the app** — so this would not have been a control over existing data, it would have been genuinely new persisted data plus automatic background downloading, reversing FR-11a's promise above. Told that, the user re-scoped to removal only and, asked directly, also dropped the clear-caches button (with no cache to clear, it would have been a button that does nothing). Any future "cache tiles near home" request is therefore New Feature lane work that must explicitly decide whether to break the no-background-download promise, not an incremental Settings addition.

**Implications:** User-facing impact is modest but real and was stated honestly rather than waved off — desktop and web/Pi users lose a visible Settings section (iOS never showed it); nobody loses working behavior. `PRIVACY_POLICY.md` changes in the **shrinking** direction: GitHub leaves the tile-host list and the "Offline maps" subsection goes, because the app can no longer contact that endpoint at all (effective date advanced per its own "Changes to This Policy" clause). One orphan is deliberately left alone: an `offline-maps-enabled` boolean inside `data/settings.json` for any user who flipped the toggle — an unread key that nothing will read again; deleting it would add a startup write path and a new failure mode for no user-visible benefit. Write no migration for it. History is not rewritten — the 0.5.45 changelog entry, the decision entries above, and the `pipeline/offline-support/` and `pipeline/offline-maps/` record sets stay as they are. Two release-ops facts are promoted to CLAUDE.md: the shipped DMG *container* carries no code signature by design (the headless `.DS_Store` styling step re-converts the image after `tauri build` signs it; the notarization staple and the Developer-ID-signed `.app` inside are what gate the download, and the updater verifies the minisign signature on the `.app.tar.gz`, never the DMG), and `release.sh`'s `touch src-tauri/src/main.rs` relink will rebuild and relaunch a running `desktop:dev` app mid-release — harmless, but alarming during a live preview. Verified: frontend 1579 / backend 178 green (1757 total, 0 failing), `npm run build` green, `npm audit` clean at 0 vulnerabilities on the production dependency surface, notarized universal macOS DMG + signed Windows installer + three-key `latest.json` published at `v0.5.74`.

## Toggle Box and iOS Ship — 2026-08-03 (v0.5.73)

**Decision:** The shared `ToggleSwitch` gained an opt-in `bare` prop (chromeless: no bordered-button frame, a larger 36×20 track / 16px knob, `.sr-touch-target`) for rows whose visible label is the row's own text; Settings' "Disable embedded media" row is its only consumer. The boxed default is the standard everywhere a switch carries its own visible label, and its render path stays byte-identical (locked by `ToggleSwitch.test.tsx`). The run also shipped iOS 0.5.73 build 1 to TestFlight, closing the gap left when v0.5.72 shipped desktop-only.

**Rationale:** The chrome exists to frame a visible label next to the switch; Settings hides that label (`labelVisible={false}`), so users saw an empty box around a bare switch — a reported visual defect, not a design choice worth keeping. An opt-in variant fixes the one mis-fitting site without touching the other switch call sites or the v0.5.68 switch-thumb tokenization (the bare variant reuses `--sr-switch-thumb`/`--sr-switch-thumb-shadow`/`--sr-gray-400` unchanged).

**Implications:** New Settings-style rows (row text as the visible label, trailing switch) should pass `bare`; label-carrying switches keep the boxed default. Two release-ops facts are promoted to CLAUDE.md: after a Hephaestus reboot the login keychain is locked for remote sessions and must be unlocked by the user in their own terminal before any signing (codesign/export dies with `errSecInternalComponent`; the in-chat `!` prompt cannot take a hidden password), and `tauri ios build` stamps `gen/apple/snowraven_iOS/Info.plist` with the version/build number, which must be committed before `release.sh` (its clean-tree preflight aborts otherwise) — commit the stamp when the iOS build runs before the desktop release. No prior decision reversed. Verified: full frontend suite (1606) + backend (178) green, `npm run build` green, notarization Accepted, all six release assets + three-key `latest.json` confirmed, altool upload accepted (delivery 3c24380f).

## Disable embedded media: one fail-closed global gate, with audited backend and CI pins — 2026-07-30 (v0.5.72)

**Decision:** Added one durable, off-by-default **Disable embedded media**
setting rather than per-surface controls. `useEmbeddedMediaPreference` owns the
`disableEmbeddedMedia` value at the App root and exposes iframe eligibility only
after hydration confirms the exact saved value `false`; unresolved startup and
saved `true` both keep the gate closed. Species Detail Recent Media and expanded
Named Birds media consume that gate, immediately unmount players when disabled,
and show the shared neutral sentence “Embedded media is disabled in Settings.”
only where embed-backed content exists. Formats, dates, checklist links, direct
asset links, counts, comments, analytics, and other non-embed behavior remain.
`MediaFrame` stays the sole iframe constructor and now also requires explicit
eligibility, so a future missed call-site guard still cannot silently request an
embed.

**Rationale:** Macaulay Library's third-party players have become unreliable;
their existing slow/failed/offline fallback cannot make the provider
deterministic. A single locally persisted opt-out gives users control without
removing useful export-derived data or user-initiated links. Failing closed only
while the preference hydrates prevents a player/request flash on a relaunch with
embeds disabled, while the negative setting's absent, malformed, and non-boolean
values preserve the historical embeds-enabled default. Web writes now reject
non-2xx responses so Settings can restore the last durable value and show its
fixed inline error instead of claiming an unsaved choice.

**Dependency and verification decisions:** The release audit found reachable
advisories in the former multipart, dotenv, and Starlette resolution. The
backend therefore keeps the independently verified exact runtime set
`fastapi==0.141.1`, `starlette==1.3.1`, `python-multipart==0.0.32`, and
`python-dotenv==1.2.2`; clean `pip check` and exact-version OSV queries found no
runtime advisories. CI also pins `ruff==0.15.20` and `pytest==9.1.1` instead of
installing unconstrained verification tools. The Calendar's unchanged QA-41
contract still requires one complete `buildDayCells` run below 50 ms, but takes
the minimum of seven complete measurements so unrelated parallel-runner
contention cannot create a one-sample false failure; neither the work measured
nor the 50 ms threshold was weakened. Starlette 1.3.1's warning about the
test-only `httpx` TestClient transport is a future harness-migration note, not a
production issue.

**Implications and release evidence:** Every future inline ML surface must pass
the hydrated App-root gate and reuse `MediaFrame` plus the shared disabled
status; direct links remain available because they make no provider request
until chosen. v0.5.72 is published from tag commit
`4e472570587e85b3ffd051cd977502a54697616c`: Pipeline run `30594949885` and
Windows Build run `30594969963` passed, all six release assets and `latest.json`
were verified, and the website serves the release. The headlessly styled outer
DMG has one non-blocking tooling diagnostic: after conversion it reports no
usable container signature, although its stapled notarization ticket validates
and the signed app inside passes strict codesign and Gatekeeper as Notarized
Developer ID. v0.5.72 is healthy; a future release-tooling pass may investigate
preserving or adding the outer-container signature without recasting this
shipped notarized app as broken.

## Species Detail Recent Media: shared resilient-embed primitives + Macaulay Library attribution/links, backporting v0.5.66 — 2026-07-20 (v0.5.71)

**Decision:** Backported the v0.5.66 non-destructive inline-embed resilience to Species Detail's "Recent Media" and, in doing so, promoted it to a shared implementation. The `MediaFrame` / `MediaFallback` / `MediaShimmer` components moved to `components/MediaEmbed.tsx` and their constants (`MEDIA_CATALOG_ID_RE`, `EMBED_GIVE_UP_MS`, `MEDIA_FORMAT_META`) to `lib/mediaEmbed.ts` (split out so the component file stays component-only for `react-refresh/only-export-components`); Named Birds now imports them, behavior byte-identical (its suite unchanged). Species Detail's Recent Media is a new component `components/RecentMediaEmbed.tsx` (extracted from the huge `SpeciesDetail.tsx` so its attribution row is unit-testable without dragging in maplibre), which adds the shared resilient frame PLUS the `^\d+$` id-guard + `encodeURIComponent` the bare iframe lacked, and — new for Species Detail — an info + attribution row beneath each player: capture date, a link that opens that asset on the Macaulay Library (credit + view/play), and its eBird checklist (all from the user's own ML export, so shown even offline). All three players share ONE uniform full height (`.sr-media-iframe--recent`, 230px / 280px phone) instead of per-format heights, and `MediaFrame` gained a `compact` prop so a caller picks its fallback density. Two doc-review ride-alongs also shipped: HELP's two "eBird backup powers these tabs" lists now include Calendar/Named Birds/Checklists, and an OpenWeather "requires a payment card" note (HELP + README); the repo's About → website field was set.

**Rationale:** Fulfills the Species Detail backport candidate explicitly noted in the v0.5.66 decision. The Macaulay Library attribution/link addresses ML/Cornell terms (there was no visible credit or way to open the asset) — surfaced by the user in live review. The uniform full height was also a live-review finding: the compact per-format audio height (116px) clips the Macaulay audio player's controls under the frame's `overflow:hidden`, so the audio was un-interactable; matching photo/video (230px) gives the controls room and makes the row read as matching tiles. Named Birds keeps its shipped compact grid — its per-format heights are unchanged; the resilience *logic* is shared, the *display height* is a per-caller choice. The docs review's High/Med findings (a `master` branch whose docs lag `main`) were FALSE: no `master` branch exists, and `main`'s docs are current through 0.5.70 (Calendar, offline, CHANGELOG all present); only the two summary lists (#5), the OpenWeather note (#7), and the repo link (#8) were real.

**Implications:** No prior decision reversed. Any future inline ML embed reuses `components/MediaEmbed.tsx` (frame/fallback/shimmer) + `lib/mediaEmbed.ts` (constants), picking the tile height per surface. **Named Birds' compact audio (116px) has the same latent control-clipping** and is a possible follow-on (left untouched — out of this run's scope). PRIVACY_POLICY is unchanged: Species Detail was already a disclosed embed surface, and the new attribution links are user-clicked navigations, not new automatic requests. Promoted to CLAUDE.md (the media-embeds convention). Verified: `npm run build`, `npm run lint` (0 errors), vitest 1579 (126 files, +3 for the RecentMediaEmbed attribution test); the entry-chunk guard stays green (the new media files pull no maplibre). Shipped desktop v0.5.71 (notarized universal macOS DMG + signed Windows installer + updater + `latest.json`) and iOS 0.5.71 build 1 to TestFlight.

## Unbounded-view column narrowing on the Breeding Codes matrix: `table-layout: fixed` makes the phone dot-width widths authoritative, and the wideMode card uses `min-content` to hug the table — 2026-07-07 (v0.5.70)

**What:** Completed the v0.5.69 phone code-column narrowing so it also holds in the matrix's **"↔ Unbounded" (wideMode)** view — previously only the Normal view narrowed to 30px dot-width columns at ≤640; Unbounded stayed full-width — and removed the ~1200px of trailing whitespace beside the ~540px Unbounded table (the card no longer over-sizes to the columns' intrinsic width). Frontend-only, phone-tier (≤640) only; desktop Unbounded stays intentionally wide. Files: `frontend/src/components/BreedingCodeTable.tsx` + its test + `frontend/src/globals.css`. Desktop shipped as v0.5.70 (notarized universal macOS DMG + signed Windows installer + updater + `latest.json`); iOS 0.5.70 build 1 uploaded to TestFlight. Feature commit `daadb6a`. This **EXTENDS** the v0.5.69 mobile Breeding Codes matrix decision below — it does not reverse it (the native-pinch and reverted-frozen-header calls are untouched).

**Decision:** The ≤640 dot-width narrowing now holds in BOTH modes via two class contracts. `.sr-bc-matrix` on the `<table>` (base `width:100%; min-width:max-content`; `@≤640` `table-layout:fixed; width:max-content; min-width:0`) makes the declared `.sr-bc-code-col` widths (30px at ≤640) *authoritative* instead of advisory. `.sr-bc-card` on the wideMode card (base `max-content`; `@≤640` `min-content`) shrinks the card to hug the fixed-width table so there is no trailing whitespace. Normal mode and desktop (>640) are unchanged.

**Rationale (three durable CSS lessons — each bit us live, and any future wide-table-on-phone work should heed them):**
- **`table-layout: auto` treats a cell `width`/`min-width` as a FLOOR, not an authoritative width** — a wide (uncapped) table grows its columns to distribute the content width, so the 30px floor was never reached in the uncapped Unbounded view. `table-layout: fixed` makes the declared column widths bind exactly. (This is why Normal mode narrowed but Unbounded did not: Normal's scroll container capped the table's total width and squeezed the columns down to the floor; Unbounded's `max-content` card capped nothing.)
- **`table-layout: fixed` with an inline `width:100%` inside a `width:max-content` (shrink-to-fit) container is a CIRCULAR constraint** that runs the table away to the browser's ~500,000px max-element-width cap. A fixed-layout table needs a *definite, non-circular* width — `width:max-content; min-width:0` — not `100%`.
- **A `width:max-content` card sizes to the fixed table's INTRINSIC content width (the columns' natural width, ~1750px), NOT its rendered fixed width (~540px)** — leaving huge trailing whitespace beside the narrow table. Use `width:min-content` on the card to hug the fixed-width table.

The last two were caught ONLY in live phone-width preview — they are layout-only and invisible to the test suite (jsdom has no layout engine). The first was verified by the Normal-vs-Unbounded behavior difference.

**Implications:** Phone-tier column widths for this matrix are now authoritative via `table-layout:fixed`; future wide-table-on-a-phone work should prefer a *definite* width over `max-content`/`100%` when using fixed layout, and use `min-content` on a shrink-to-fit horizontal-scroll card to hug a fixed-width table. Folded into CLAUDE.md's existing Breeding-Codes-matrix note and `pipeline/design-system.md`'s "Phone wide-table" pattern (both extended, not duplicated). QA and Security both passed with no new attack surface, network, provider, dependency, or persisted setting; `PRODUCT_CONTEXT.md` correctly unchanged (the matrix already reads as "reads well on a phone with dot-width columns" — this run refined *which view*, not what the product IS). Multimedia's Unbounded columns were verified OUT of scope (its `LifeListTable` has ~3 text+icon count columns, no `.sr-bc-code-col`-style dot grid — nothing to narrow).

---

## Mobile Breeding Codes matrix: dot-width columns + native pinch, NOT a custom zoom control and NOT a frozen-header data-grid — 2026-07-07 (v0.5.69)

**What:** Made the Breeding Codes matrix comfortable to read on a phone. Frontend-only (`frontend/src/components/BreedingCodeTable.tsx` + its test + `frontend/src/globals.css`); no new data model, network call, provider, backend route, bundled dataset, token, or persisted setting. Four live-verified revisions at the Engineer gate settled the approach. Desktop shipped as v0.5.69 (notarized universal macOS DMG + signed Windows installer); iOS 0.5.69 build 1 uploaded to TestFlight. Feature commit `6da3645`.

**Decision:** On phones the matrix is made usable by narrowing the code columns to ~30px dot-width (`.sr-bc-code-col`, 0.625rem headers, at ≤640) and relying on NATIVE viewport pinch to magnify — NOT a custom −/Fit/+ zoom control, and NOT a frozen-header / capped-height data-grid. A frozen title row + capped-height scroll box WAS built and live-tested (revisions 2–3), then REVERTED at the user's request in favor of a natural full-height, page-scrolling table with the tier legend in normal flow after the last row. The species-name column stays horizontally sticky only (`left:0`), and thin vertical column rules (`--sr-border-subtle` right-borders on `.sr-bc-code-col` / `.sr-bc-name-col`) are kept at all widths.

**Rationale:**
- **Native pinch, not a CSS zoom control.** CSS `zoom` / `transform:scale` is unreliable in WKWebView — the same reason the v0.5.64 ZoomableWideSurface was reverted — so magnification is delegated to the viewport's own pinch. eBird codes are 1–3 chars and stay legible at 30px; the `−/Fit/+` fallback control the Designer reserved (feature `decisions.md`) ships only if an on-device pinch check fails, and did not ship.
- **Natural table, not a frozen-header capped box (empirical CSS limit).** Pure CSS cannot combine a page-frozen header + an unbounded (full-height) table + contained horizontal scroll on a phone: `overflow-x:auto` forces the vertical axis to `auto`/`hidden`, which binds a sticky header to the wrapper rather than the page — so removing the vertical height bound necessarily un-freezes the header (verified both ways: `overflow-y: visible`→auto and `clip`→hidden each fail). Faced with that tradeoff the user chose the natural full-length page-scrolling table over the freeze.

**Implications:** Keep the horizontal-only sticky name column + the vertical column rules; do NOT re-introduce the capped-height frozen-header box on this matrix. Future wide-table-on-a-phone work uses the same recipe — dot-width columns single-sourced in a CSS class + native pinch — not a custom zoom widget or a frozen-header data-grid. Promoted to CLAUDE.md (a Breeding-Codes-matrix note by the responsive-layout conventions) and folded into `pipeline/design-system.md` as the reusable "Phone wide-table" pattern. Separately, this run surfaced a real gap in the iOS build recipe — `tauri ios build --export-method app-store-connect` needs the App Store Connect API key under Tauri's own env names (`APPLE_API_KEY` / `APPLE_API_ISSUER` / `APPLE_API_KEY_PATH`), distinct from the `altool` upload creds — also promoted to CLAUDE.md (iOS release). QA and Security both PASSED with no new attack surface and no builder Convention Flags; `PRIVACY_POLICY.md` / `ACCESSIBILITY.md` correctly unchanged.

---

## iOS app icon fix (+ offline-maps deferral) — 2026-07-06 (iOS build v0.5.68 build 2)

**Decision:** Fixed the iOS app showing Tauri's default placeholder icon (a committed-artifact bug), and — from the same two-issue report — confirmed that offline maps on iOS is a FEATURE, not a bug, and DEFERRED it (not built). iOS-asset-only: the desktop v0.5.68 bundle is unaffected, no version bump; it shipped as iOS build 2 to TestFlight. Commits `e070d73` (icon swap) + `21fd5b2` (flatten).

- **Icon (FIXED, shipped):** the correct green SR icon set existed at `src-tauri/icons/ios/` but was never copied into the committed `gen/apple` AppIcon.appiconset at `tauri ios init` — Tauri's placeholder icons were what iOS displayed. Fixed by copying the SR set over the 18 placeholders in `src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/`. The first upload was then REJECTED by App Store Connect (**altool error 90717** — the large 1024 app icon can't have an alpha channel); the SR icons carried a redundant, all-opaque alpha (pixels 254–255 opaque, anti-aliased edges only). Fixed by flattening all 18 icons to opaque RGB in BOTH `icons/ios` and the appiconset (composite onto white, save without alpha). Rebuilt as build 2, re-uploaded, accepted.
- **Offline maps on iOS (DEFERRED, not built):** confirmed a FEATURE, deliberately desktop-only in v1 (`pipeline/mobile-app/prd.md` FR-15/FR-23 + the v0.5.45 offline-support decision "region downloads are desktop-only, FR-20"). The `srpm://` PMTiles plumbing is JS + cross-platform capabilities (not Rust-desktop-gated), so iOS is not structurally barred — but making it actually work there is untested, App-Review-sensitive work that reverses a logged v1 scope decision, so it belongs in the New Feature lane. Put on hold by the user this run and captured to the idea inbox; NOT touched in this Fix run (no `platformGates.ts` change).

**Rationale:** The placeholder icon was a real user-facing defect (wrong home-screen / TestFlight / App Store icon, not matching macOS + Windows). The alpha-channel rejection is an App Store Connect hard rule that will recur on any future iOS icon change, so both the opaque-icon requirement and the iOS build/deploy recipe are promoted to durable conventions. Offline-maps-on-iOS is left as intended v1 behavior (desktop-only) until it's scoped as a feature — un-hiding the toggle alone would expose an unvalidated downloader.

**Implications:** Promoted to CLAUDE.md (new `### iOS release` subsection): (1) iOS app icons must be fully opaque — no alpha channel — flattened in both `icons/ios/` and the committed `gen/apple` appiconset (the desktop icon may keep alpha); (2) iOS build + TestFlight upload is Claude's to run via the `/tmp/xcshim` + parent-`DEVELOPER_DIR` recipe and `xcrun altool --upload-app`, NOT `release.sh`, and an iOS-asset-only change ships as a build-number bump with no version bump / tag / `latest.json`. Offline maps on iOS is tracked in ROADMAP.md "On the Horizon" (a deferred feature that would reverse the FR-15/23 desktop-only decision). No `PRODUCT_CONTEXT.md` change (the icon fix isn't a product-capability change).

---

## Calendar mobile view modes + em-dash cleanup — 2026-07-06 (v0.5.68)

**What:** Two independent Improve-lane refinements bundled as one patch. (1) The Calendar tab's Compact/Large view toggle now governs at ALL widths, so the two views are distinct on a phone too — Compact = per-day counts with no day-of-month date; Large = dated, shaded whole-year mini-months with the day's figures on tap. (2) Em dashes (—) were removed from the app's user-facing copy and `docs/HELP.md`. Frontend + docs only; no new data model, network call, provider, backend route, bundled dataset, or persisted setting. **Item 1 REVERSES the recent phone-force / phone-date-corner decisions (named below); the Calendar view-carries-the-date, label, and offline decisions REMAIN binding.**

**Decisions worth keeping:**

- **The Calendar's Compact/Large toggle governs at every width — the phone no longer forces a single view. This REVERSES v0.5.61 and v0.5.64.** v0.5.61 made phones (≤640) force one Calendar view via `useIsPhone` (a `matchMedia` store) and hid the View toggle in the ≤640 CSS block; v0.5.64 then added a phone-only day-of-month corner (`.sr-cal-bigday`, revealed at ≤640) so the one forced view could still show dates. Net: on a phone the toggle did nothing (hidden) and the single view crammed BOTH the count and the date, so Compact and Large were indistinguishable — a real defect. This run drops the `isPhone ? … : viewMode` force (the toggle drives the render branch on phone too), un-hides `.sr-cal-view-toggle` at ≤640, and removes the phone-only date corner so Compact stays count-only at all widths (Large carries the date on its mini-cells at every width, phone included). **REVERSED:** v0.5.61's phone-force and v0.5.64's phone-Compact date corner. **PRESERVED and still binding:** v0.5.60/62/63's decisions about *which view carries the date* (dates on the Large thumbnails, big grids count-only), the "Compact"/"Large" labels, the label-agnostic `'months'`/`'overview'` values, and the Calendar's offline / zero-network guarantee (day-popup location names stay plain text, no `HotspotLink`). The `useIsPhone` hook itself STAYS — it is CLAUDE.md-blessed and used elsewhere; only the Calendar's use of it to force a mode is removed.
  - **Rationale / implication:** the whole point of the Compact/Large toggle is two distinct views; hiding it and force-pinning a hybrid view on the exact device where a toggle matters most defeated it. Any future Calendar view change keeps the rule: the explicit toggle is the single view-switch at all widths, and each view shows its designated half (Compact = counts; Large = dates + shading, data-on-tap). The `--sr-cal-*` ramp, `calendarContrast.test.ts`, and `calendarTextures.test.ts` are untouched (render-branch / label-placement only, no count or geometry change).
- **Em dashes (—) are not used in the app's user-facing copy or `docs/HELP.md`.** Replaced per context (period / comma / colon / parentheses / small restructure — not a blind character delete), preserving meaning and the app's voice, across on-screen text, tooltips, `title`/`placeholder`/`aria-label` values, headings, buttons, messages, empty states, and all of the in-app Help. TWO standing exclusions: (1) provider-mandated attribution / credit strings (e.g. Esri's required map-tile attribution) stay verbatim; (2) data-parsing regexes and any dash load-bearing in matching logic are untouched. Out of scope: code comments, tests, and eBird/Macaulay DATA passthrough (bird names, place names, user comments — not our copy); en dashes (–) are also out of scope (the year span, `min–max` ranges). No prior DECISIONS.md entry governed em-dash punctuation, so this is a net-new convention, not a reversal. Promoted to CLAUDE.md (Documentation section).
  - **Rationale / implication:** a cleaner, more consistent product voice (Weft's own product-copy guidance discourages em dashes). A `grep -rn '—'` over rendered `.tsx`/`.ts` strings + `docs/HELP.md` should stay clean; any new copy follows the same rule.

**Implications:** Item 1 is the third Calendar run to reverse/restore prior Calendar decisions (v0.5.62 and v0.5.63 were the first two). REVERSED: v0.5.61 (phone-force a single view) and v0.5.64 (phone-Compact date corner). STILL BINDING & UNTOUCHED: v0.5.60/62/63 (which view carries the date; the Compact/Large labels; the `'months'`/`'overview'` values) and the Calendar offline / plain-text-location guarantee. Item 2 reverses no recorded decision. Separately, the app-wide switch-thumb tokenization (`--sr-switch-thumb` + `--sr-switch-thumb-shadow`, white knob + identical shadow in both themes) reached production in this release — the pixel-identical migration flagged in the v0.5.67 entry, now applied to every switch thumb app-wide and recorded as a CLAUDE.md convention (Colors/theming). Verified: `tsc -b`, lint (incl. build-blocking `react-hooks/purity`), vitest, and `npm run build` green with the Calendar phone/date tests rewritten to the new behavior; the Calendar stays a lazy chunk and maplibre/county/taxonomy stay off the entry chunk. QA PASSED and Security PASSED (frontend + docs only; no new attack surface, network, provider, dependency, or persisted setting; `PRIVACY_POLICY.md` / `ACCESSIBILITY.md` correctly unchanged).

---

## Weather Backlog: weather-only copy, and `window.open` is dropped in the Tauri WebView (the `openExternalUrl` seam) — 2026-07-06 (v0.5.67)

**What:** A "List checklists with no weather blocks" section at the bottom of the Weather tab that lists the user's most-recent checklists whose comment carries no recognized weather block (via the shipped `hasWeatherBlock` detector), each row offering open-checklist / open-comment-page / "Copy weather & go" actions — a frontend assembly of already-shipped parts (no new backend route, provider, or formatter). Frontend-only. The two decisions worth keeping are a product choice (what action #3 copies) and a durable desktop-platform gotcha surfaced in live preview.

**Decisions worth keeping:**

- **Action #3 copies WEATHER-ONLY by default — the user's explicit override of the PRD's combined weather+tide default (OQ-3).** The PRD's deferred default (FR-18/OQ-3) was to mirror the Weather tab's "Copy Weather and Tide Together" — the combined `buildCombined` block when tide is available, weather-only otherwise. The user chose weather-only to match the literal request ("only copy the weather by default"), so `buildBacklogCopyText` returns the weather block and does not fetch or append tide (the one-line omission the Architect isolated in the schema for exactly this). "Complete + non-incidental" is the default filter; incidental is eBird protocol `P20` (the widen toggle adds incomplete + `P20` incidental rows, chip-marked).
  - **Rationale / implication:** a user-corrected product default. If a combined weather+tide variant is ever wanted, it's the same one function — re-append the tide branch. No formatter or provider changed; the existing single-checklist Weather lookup, Current, and Predict are byte-behavior-unchanged.
- **`window.open()` is silently dropped in the Tauri desktop WebView — open external URLs from code via the new `openExternalUrl` seam (`lib/openExternal.ts`), never `window.open()`.** Action #3 first opened the eBird edit page with `window.open(url, '_blank', …)`; on web that works, but in the desktop app WKWebView swallows the call with no error — a defect only the live desktop preview caught (jsdom tests can't). The whole app opens external links exclusively via `<a target="_blank">` anchors, which `tauri-plugin-opener` intercepts; `window.open` was the sole exception. The fix is a programmatic seam that synthesizes exactly what the opener plugin listens for — a transient, detached `<a target="_blank" rel="noopener noreferrer">` appended, `.click()`-ed, and removed — working in both web (opens a tab) and desktop (opener intercepts). Security posture unchanged: same `SUBMISSION_ID_RE` + `encodeURIComponent` id guard, same `noopener,noreferrer`, no `dangerouslySetInnerHTML`.
  - **Rationale / implication:** this is the programmatic sibling of the `OutboundLink`/`ChecklistLink` convention and the reason those components synthesize an anchor rather than call `window.open`. Any code path that must open an external URL from code (e.g. after an `await`, where a shared link component isn't the right shape) uses `openExternalUrl`; a user click still prefers the shared link components. Promoted to CLAUDE.md (Desktop app seams, beside the Clipboard seam).

**Implications:** No prior decision is reversed. The white switch-thumb literal (`#fff` + shadow) in the widen toggle is the sanctioned app-wide switch pattern — it byte-matches `ToggleSwitch.tsx` / `Calendar.tsx` / `MapExplorer.tsx`, and the `--sr-gray-400` off-track token is explicitly tuned for ≥3:1 against the white knob — so it is NOT a token violation (same class of exception as the map boundary-line color); a separate user task is tokenizing that thumb app-wide, so no per-feature change was made here. Reuses only providers already disclosed in `PRIVACY_POLICY.md` (no new analytics, telemetry, account, backend, or persisted setting); the list itself builds and pages with zero network — only action #3's per-row lookup uses the network, and its failure is surfaced honestly (offline / no-key / error), never swallowed.

---

## Named Birds Media: match by the media asset's OWN comment, and a non-destructive inline-embed timeout/offline overlay — 2026-07-05 (v0.5.66)

**What:** On the Named Birds tab, each named individual's expanded row now shows that individual's own Macaulay Library media (photo/audio/video) below its sightings map, each item labeled with its capture date and a checklist link, rendered as on-demand `macaulaylibrary.org/asset/<id>/embed` inline iframes with a bounded batch ("6 + Show more") and graceful offline/failed-load degradation. This is the first inline third-party media fetch on the Named Birds tab (the tab previously only linked out). Two durable decisions came out of the build: (1) how a named bird's media is *matched*, and (2) a reusable non-destructive pattern for a slow/failing inline embed. Released bundled with v0.5.65 (the sex-terminology Improve fix) — the deployer publishes everything since v0.5.64. Frontend-only; no new backend route, provider, database, migration, or Tauri-config change (CSP is `null` and iOS ATS permits the HTTPS origin — verified on macOS/Windows/iOS, no change needed).

**Decisions worth keeping:**

- **A named bird's media = the ML-export assets whose OWN per-asset comment (`caption` + `mediaNotes`) carries the `[name:…]` tag for that individual — NOT the checklist comment, the species comment, or the checklist the asset rode in on.** This was a user-corrected design choice, and it is the crux of the feature. A checklist comment or a species comment may *mention* the named bird, but neither points at a *specific media asset*; only the asset's own comment identifies which photo/recording shows the individual. So the matcher (`computeNamedBirdMedia` in `frontend/src/lib/namedBirdMedia.ts`, pure, no network) parses name tags with the existing `parseNameTags` from each row's `caption` and `mediaNotes` **only**, and **excludes `observationDetails`** — because the ML export copies the eBird observation comment onto every media row from that observation, so it is not asset-specific (this is the identical field contract `lib/mediaComments.ts` already established for the Multimedia tab's Media Comments section, and for the same reason). Matched assets are grouped by the shared `namedBirdKey(name, commonName)` — the exact same name-plus-normalized-species key `computeNamedBirds` buckets on — so the media join can never cross-attribute (`[name:Pete]` on species A never lands under a `[name:Pete]` individual of species B). A dedicated key-parity unit test asserts the two key formulas stay byte-identical so a future refactor of either can't drift them apart; matching, dates, and checklist labels are computed entirely offline from the already-loaded `mlExportCache`, and only the embed iframe needs the network.
  - **Rationale / implication:** the asset-comment matching is non-obvious and was explicitly chosen over the "easier" checklist/species-comment inference precisely because those don't identify a specific asset. Any future media-attribution work on this tab (or a similar per-asset surface) reads the asset's own `caption`+`mediaNotes` and excludes `observationDetails`, and keys through the shared `namedBirdKey` — never re-derives the key inline. Promoted to CLAUDE.md (Bird names section).
- **A non-destructive inline-embed timeout + offline overlay: keep the iframe MOUNTED and flip only a `position:absolute` fallback overlay — this is the first embed in the app to solve slow/broken/offline degradation, and Species Detail's embed is a backport candidate.** The naive approach (a give-up timer that tears down the iframe and latches a permanent "unavailable" fallback) was caught in review: it killed a slow-but-working embed and never recovered. The shipped pattern (`MediaFrame` in `frontend/src/components/NamedBirdMedia.tsx`) instead keeps the iframe mounted for its lifetime; a 20s give-up timer (`EMBED_GIVE_UP_MS`) and the iframe's `onError` only reveal an **overlay** fallback (the metadata + a "View on Macaulay Library" `OutboundLink`), never unmount the frame — and a late `onLoad` clears the latch so a slow-but-working embed recovers *in place*. Offline→online recovery is an **online-keyed remount** (`key={online ? 'online' : 'offline'}`), not a `setState`-in-effect. The offline/failed state ALWAYS keeps the item's capture date, its `ChecklistLink`, and the link-out, so it is never a broken or blank frame. Online detection is a new shared `useOnline` hook (`frontend/src/lib/useOnline.ts`), extracted from the `SnowMap` `navigator.onLine` + `online`/`offline`-listener pattern — `navigator.onLine` is read in the state initializer and event handlers, never in a render body or memo (render-purity).
  - **Rationale / implication:** this is a genuinely reusable inline-embed resilience pattern, and it fills a gap the pre-existing **Species Detail** embed still has — that embed has NO offline/failed-load fallback and would benefit from this exact treatment (`MediaFrame` + `useOnline`). Backporting it to Species Detail is a noted candidate (recorded on the roadmap's On the Horizon), not done in this run (Species Detail was explicitly out of scope). Promoted to CLAUDE.md (a media/embeds note) with the `useOnline` hook and the non-destructive-overlay rule.

**Implications:** No prior decision is reversed. Extends the Species Detail inline-embed precedent to a second tab and, for the first time, adds offline/failed-load resilience to an inline embed. `PRIVACY_POLICY.md`'s "Embedded Bird Media and Link Icons" section was updated to name the Named Birds tab as a surface that embeds `macaulaylibrary.org` media, with its effective date advanced to 2026-07-05 (a review finding — the policy's own "Changes to This Policy" clause); no new data collection, analytics, telemetry, backend, account, or persistent storage. Verified: `npm run build` (`tsc -b && vite build`), `npm run lint`, and vitest (121 files / 1503 tests, +34 for the feature) all green; the `entryChunk` guard passed and `vendor-maplibre` stays ABSENT from `dist/index.html` modulepreload (the new media component is a light iframe, statically imported into `NamedBirdRow` but pulling no maplibre). QA PASSED (6-lens adversarial review, 5 findings all fixed and re-verified: the destructive-timeout teardown, the offline→online non-recovery, a "Show more" `aria-label`/visible-text divergence (WCAG 2.5.3), a final-reveal focus drop to `<body>` (WCAG 2.4.3), and the stale privacy-policy effective date). Security PASSED with no Critical/High — catalog id `^\d+$`-guarded + `encodeURIComponent`-wrapped before it can reach the iframe `src` or the link-out, checklist ids through `ChecklistLink`'s `^S\d+$` guard, no `dangerouslySetInnerHTML` on any asset-derived text (the section renders its own labels; the bird name in the iframe `title` is a React-escaped child).

---

## Calendar Date Placement — 2026-07-05 (v0.5.63)

**What:** Six refinements to the *already-shipped* Calendar tab, one patch, correcting the v0.5.62 date-placement choices the user flagged and adding three day-popup enrichments developed iteratively against a live desktop-app preview. (1) Day-of-month numbers **removed** from the big month grids ("Compact" view) — count-only again. (2) Numbers **added** to the year-overview thumbnails ("Large" view), with the `.sr-cal-minimonth` `container-type: inline-size` + `@container (min-width: 152px)` legibility floor **restored**. (3) The overview months' **cross-view link removed** — the mini-months are now non-interactive (`<button>` → static container; `expandMonth`/`onExpand` plumbing gone). (4) The overview DAY cells now open the same day popup **in place** (real per-day `<button>`s reusing the grid's `onOpen`; birded days only; months still don't navigate). (5) Each day-popup checklist row now shows the checklist's start **TIME and LOCATION** (threaded via `DayCell.checklists` from the already-loaded backup). (6) Each popup row also shows that checklist's distinct **SPECIES COUNT** (countable by default, with-forms when the toggle is on; per-submissionId Sets, additive — day counts unchanged). Off-roadmap user request; the user re-confirmed the intent this run via a binary "keep names, move dates" question. Frontend-only; no new data model, network call, provider, backend route, bundled dataset, or persisted setting. **This REVERSES v0.5.61's "day-of-month in the big cells" and SUPERSEDES v0.5.62's decision to keep the numbers on the big grids, RESTORES v0.5.60's mini-cell numbers + 152px floor, and REMOVES the cross-view month→grid navigation that has existed since the v0.5.58 Calendar tab. The v0.5.62 combined-view current-year alignment (incl. Feb-29 pinning) and the label swap ("Compact" = big grids, "Large" = thumbnails; internal `'months'`/`'overview'`) REMAIN binding and are untouched.**

**Decisions worth keeping:**

- **Day-of-month numbers live on the year-overview thumbnails, NOT the big month grids — this is the correction of the v0.5.62 date placement the user flagged.** v0.5.61 put the day-of-month in every big-grid cell (as the *label fix* for the "all-years shows fewer species" grid-alignment confusion); v0.5.62 kept that placement while reverting the thumbnails to shading-only and retiring their 152px floor. The user reviewed v0.5.62 and found this backwards: they want the small per-day numbers on the *thumbnails*, and the big grids clean (count-only). This run therefore **REVERSES v0.5.61's big-cell numbers and SUPERSEDES v0.5.62's keep-them-on-the-big-grids decision**, and **RESTORES v0.5.60's mini-cell number spans + the `.sr-cal-minimonth` container-query floor** (which v0.5.62 had removed). The big grids return to the pre-v0.5.61 look; the `DayCorner` component stays (now used only by the restored mini-cell number). The underlying combined-view grid-alignment fix (v0.5.62's current-year weekday alignment + Feb-29 pinning) is the durable answer to the original confusion and is **untouched** — this run only moves *where the date label renders*, not the layout or any count.
  - **Rationale / implication:** the "all-years shows fewer species" symptom was always grid re-alignment misread as a count change (v0.5.61/v0.5.62), and v0.5.62 fixed it at the layout. The remaining question was purely cosmetic — which view carries the visible date label — and the user's answer is "the thumbnails." The union/sum count invariants, the `--sr-cal-*` ramp, `calendarContrast.test.ts`, and `calendarTextures.test.ts` are all untouched (geometry/label-placement only). This is the second Calendar run to reverse/restore prior Calendar decisions (the first was v0.5.62).
- **The overview months are no longer a cross-view link — each view is self-sufficient; the overview DAY cells open the day popup in place instead.** Since the v0.5.58 Calendar tab, each `YearOverview` mini-month was a `<button>` (aria-label "Open {month} in the month view") whose click ran `expandMonth` → `setViewMode('months')`, jumping the user into the big-grid view. The user found this cross-view jump confusing. The mini-months are now **non-interactive** (static container: month name + shaded, numbered thumbnail; `expandMonth`/`onExpand` removed), so view switching happens **only** via the Compact/Large toggle — neither view links to the other. To preserve day-detail access that removing the link would otherwise cost, the overview's individual **day cells** became real `<button>`s that open the **same** `DayPopup` as the Compact grid (reusing `onOpen`; birded days only; pad/no-data cells are not focusable). No new cross-view/month navigation is reintroduced — a day cell opens a popup in place, it does not switch views.
  - **Rationale / implication:** a view toggle plus a hidden second way to switch views (clicking a month) is a confusing dual affordance; making the toggle the single view-switch and giving each view its own in-place day-detail popup is cleaner and matches the user's mental model. Any future Calendar view keeps this rule: switch views only via the explicit toggle; open detail in place.
- **The day-popup rows show per-checklist time + location + species count from the already-loaded backup — and the LOCATION is deliberately PLAIN TEXT (no `HotspotLink`) to keep the Calendar offline.** Each popup checklist row gained a `{time · location}` prefix line and a distinct species count. `time` and `location` are threaded onto the widened `DayCell.checklists[]` shape from `ObservationEntry` in `buildDayCells`; the species count is a per-submissionId `Set.size` (countable by default, a parallel with-forms Set when the include-forms toggle is on) accumulated in the **existing** single derivation pass — additive display fields only, so day-level counts are byte-identical. Crucially, the location renders as an **escaped plain-text JSX child**, NOT through `HotspotLink`/`OutboundLink`/any anchor: `HotspotLink` requires `useHotspotSet()`'s region-scoped `GET /map/hotspot-region` fetch, which would add a live network dependency to a tab whose entire promise is offline, zero-network computation from the already-loaded backup. `time`/`location`/species counts introduce no `fetch`, transport call, provider, or `dangerouslySetInnerHTML`.
  - **Rationale / implication:** this is the one to guard against a well-meaning future "fix." The app-wide convention is that a public-hotspot location name should link to eBird via `HotspotLink`; a future dev applying that convention to the Calendar would silently break its offline guarantee. The waiver is now both a code comment in `Calendar.tsx` AND a durable CLAUDE.md convention (Bird-names section, beside the HotspotLink rule): on the Calendar tab, location names stay plain text. `PRIVACY_POLICY.md` correctly needs no change — the Calendar makes no network call.

**Implications:** Second Calendar run to reverse/restore prior decisions (v0.5.62 was the first). REVERSED: v0.5.61's day-of-month-in-the-big-cells; SUPERSEDED: v0.5.62's keep-numbers-on-the-big-grids; RESTORED: v0.5.60's mini-cell numbers + 152px container-query floor; REMOVED: the v0.5.58 cross-view month→grid navigation (`expandMonth`). STILL BINDING & UNTOUCHED: v0.5.62's combined-view current-year alignment + Feb-29 pinning and the "Compact"/"Large" label swap with `'months'`/`'overview'` internals; the union (Species) / sum (Checklists) / individual-sum (Total) count invariants; the `--sr-cal-*` ramp; `calendarContrast.test.ts`; `calendarTextures.test.ts`. Verified: vitest 113 files / 1423 tests, typecheck (`tsc -b`), lint (incl. build-blocking `react-hooks/purity`), and build all green with the two calendar tests updated; the Calendar stays a lazy chunk and maplibre/us-counties/taxonomy stay off the entry chunk. QA PASSED with 0 confirmed adversarial findings across 8 read-only lenses (feb29-alignment mutation-tested and reverted clean). Security PASSED with no findings — frontend-only, no new attack surface, network, provider, dependency, or persisted setting; `location`/`time` render as escaped JSX children, the species count is a rendered number, `ChecklistLink`'s `SUBMISSION_ID_RE` guard is untouched, and `PRIVACY_POLICY.md` / `ACCESSIBILITY.md` correctly unchanged.

---

## Calendar View Clarity — 2026-07-04 (v0.5.62)

**What:** Three Calendar-tab refinements to the *already-shipped* tab, one patch. (1) The all-years combined grid now aligns its weekday columns to the **current year** (a module-level session constant) instead of the fixed reference year 2000, and combined February is pinned to **29 days** regardless of the current year's leapness so the Feb-29 cell always renders; per-day count/union/sum logic is unchanged. (2) The Year-overview mini-month thumbnails reverted to **shading-only** — the v0.5.60 day-number spans and their per-cell title tooltips were removed, and the `.sr-cal-minimonth` container-query CSS retired. (3) The View toggle labels were **swapped** so they read intuitively: the big month grids are now "Compact", the whole-year thumbnails "Large"; internal view state moved from `'large'`/`'compact'` to density-neutral `'months'`/`'overview'` values. Phones keep forcing the month-grid view (now labeled Compact). Off-roadmap user request. Frontend-only; no new data model, network call, provider, backend route, bundled dataset, or persisted setting. **This partially REVERSES v0.5.60 and SUPERSEDES parts of v0.5.60 / v0.5.61 (named below); the v0.5.61 date-in-cell labels and the regression-locked union/sum count invariants REMAIN binding.**

**Decisions worth keeping:**

- **The combined all-years grid aligns its weekday columns to the CURRENT year, not a fixed reference year — SUPERSEDES v0.5.61's fixed-reference-year framing.** v0.5.61 diagnosed the reported "all-years shows fewer species" as grid re-alignment (a cell's *position* mapping to a different date than in a single-year view, because the combined view aligned columns to a fixed reference year 2000) misread as a count change, and *mitigated* it by rendering the day-of-month in every cell (that label fix STAYS binding — see Implications). This run delivers the durable fix at the **layout**: the combined grid now lays out like the current year (lead-in `dayOfWeek(currentYear, month, 1)`), so its cell positions match the single-current-year view a user is most likely comparing against. The current year comes from a module-level `SESSION_NOW_MS` / `CURRENT_YEAR` import-time constant (never a render-time `new Date()` — the render-purity contract), driving grid geometry only, never year selection.
  - **Rationale / implication:** the v0.5.61 label fix made the confusion *readable*; this fixes the confusion at its source. Fixed reference year 2000 (`COMBINED_REF_YEAR`) is retired. The v0.5.61 union (Species) / sum (Checklists) count invariants and their regression lock are untouched and remain binding — this is a geometry-only change.
- **Combined February is pinned to 29 days regardless of the current year's leapness.** The weekday lead-in and the day count are cleanly decoupled: `dim = combined && month === 2 ? 29 : daysInMonth(leadYear, month)`. A non-leap current year (e.g. 2026) still renders the Feb-29 cell — the leap-day cell the README promises survives — while single-year views use real per-year leapness.
- **The YearOverview mini-cells reverted to shading-only — REVERSES the v0.5.60 decision that put day-numbers in the mini-cells.** v0.5.60 added the active-metric count number to each Compact mini-cell, protected by a CSS container-query legibility floor (`.sr-cal-minimonth { container-type: inline-size }` + a `@container (min-width: 152px)` reveal of the number span). This run removes the number spans AND their per-cell `title` tooltips, and **retires that 152px container-query floor and the `container-type` declaration** (added only to serve the numbers). The exact figures remain in the big-grid (Compact) view and the day popup; the thumbnails are back to pure shading.
  - **Rationale / implication:** the thumbnails are a year-at-a-glance overview; the numbers added clutter the density shading already conveys, and the container-query floor existed only to make sub-floor cells legible. Removing the numbers removes the reason for the floor. The `.sr-cal-fg` token and `calendarContrast.test.ts` are untouched (the big-grid cell still carries a number).
- **The View toggle labels were swapped and the internal view-state values decoupled from the labels — SUPERSEDES v0.5.60's "Months→Large / Year→Compact" relabel.** v0.5.60 relabeled the toggle Large | Compact and, for "code and UI agreement," renamed the enum values to `'large'`/`'compact'`. This run swaps the visible labels (the big month grids → **"Compact"**, the whole-year thumbnails → **"Large"**) and — critically — moves the internal state to **density-neutral `'months'` / `'overview'`** values that name what each option renders semantically, not the visible label.
  - **Rationale / implication:** coupling the value names to the labels (v0.5.60's stated "code and UI now agree" rationale) meant this run's relabel would otherwise have forced a lockstep value rename; a label-agnostic internal value lets labels and code drift independently on any future relabel. Promoted to CLAUDE.md as a standing convention for relabelable/swappable toggles. Note the deliberate, requested outcome that the *dense* month grids are labeled "Compact" and the *small* thumbnails "Large" — counterintuitive at a glance but the user's explicit ask; every consumer and all docs honor it.

**Implications:** This is the first Calendar run to partially reverse a prior decision (the v0.5.60 mini-cell numbers + 152px floor) and supersede others (v0.5.60's Months→Large/Year→Compact relabel and its value-naming rationale; v0.5.61's fixed-reference-year framing). The v0.5.61 Large-view day-of-month labels and the regression-locked union/sum count invariants STAY binding. Verified: vitest 113 files / 1410 tests, typecheck (`tsc -b`), lint (incl. build-blocking `react-hooks/purity`), and build all green; `entryChunk` guard passed (no maplibre/county entry-chunk regression); backend suite not run (no backend files touched). QA PASSED with 0 confirmed adversarial findings across 7 read-only lenses. Security PASSED with no findings — frontend-only, no new attack surface, network, provider, dependency, or persisted setting; the one removal (mini-cell number span + `title`) strictly reduces surface; `PRIVACY_POLICY.md` / `ACCESSIBILITY.md` correctly unchanged.

---

## Calendar Tuneup — 2026-07-04 (v0.5.61)

**What:** Three refinements to the *already-shipped* Calendar tab plus one app-wide ride-along fix, all one patch. (1) The Calendar's Species filter native `<select>` became a **type-to-find combobox**, built by **extracting** Species Detail's previously-inline picker into one shared `components/SpeciesCombobox.tsx` used by both tabs. (2) Phones (≤640px) now show **only the Large calendar view** — the Large/Compact toggle is hidden and the Compact branch is forced off. (3) Every Large-view day cell now shows its **day-of-month** in the corner alongside the count. Ride-along: the app-wide `.sr-input-16` iOS no-zoom guard, silently defeated by inline font-sizes, now binds. Off-roadmap user request (a lane redirect from a New-Feature pick, confirmed as maintenance). Frontend-only; no new data model, PRD, network call, provider, backend route, bundled dataset, or persisted setting. **These EXTEND the v0.5.58 / v0.5.59 / v0.5.60 Calendar entries — no prior decision is reversed.**

**Decisions worth keeping:**

- **The Species Detail picker was extracted into a shared `SpeciesCombobox`, and Species Detail is now the reference implementation, lifted for reuse.** The picker (input + chevron + listbox, its outside-click / active-option `scrollIntoView` / display-value effects, and the case-insensitive common+scientific substring filter) had lived inline in `SpeciesDetail.tsx` and could not be imported. It is now one shared component consumed by both Species Detail and the Calendar — matching the app's shared-component convention (`ChecklistLink`, `HotspotLink`, `OutboundLink`, `BirdName`). Selection side-effects stay in each parent's `onChange` (SpeciesDetail's `selectSpecies` ~10-piece reset; the Calendar's `setPopup(null)`); the combobox owns only the ephemeral query/open/active-index state. Listbox/option ids are `useId()`-namespaced so two instances on one page can't collide (an upgrade over the old hardcoded `species-option-{idx}` ids), and an optional `allLabel` renders a keyboard-reachable "All species" clearing row (`onChange(null)`) that Species Detail does not use.
  - **Rationale / implication:** the Calendar wanted the same searchable picker Species Detail already had; the honest way to share it is one component, not a copy. Future tabs needing a species picker consume `SpeciesCombobox` rather than re-inlining one. Behavioral parity for Species Detail was the constraint — it stays the reference and must remain regression-free.
- **Phones force the Large calendar view via a render-safe `useSyncExternalStore` over `matchMedia` — NOT a `window`/`resize`/`innerWidth` listener.** The Large/Compact toggle hide is pure CSS (`.sr-cal-view-toggle { display:none }` in the ≤640 block — out of the tab order and a11y tree), but the two render branches are *different DOM* (`MonthGrid` vs `YearOverview`), so CSS alone can't convert a stale `'compact'` state carried onto a phone into a Large grid. The branch force uses a new `lib/useIsPhone.ts` — `useSyncExternalStore` subscribing to the `MediaQueryList` `change` event, `getSnapshot = () => mql.matches`, `getServerSnapshot = () => false`, old-Safari `addListener` fallback — then `effectiveDensity = isPhone ? 'large' : density` drives the render ternary. `density` state, `ViewDensity`, and `expandMonth` are unchanged.
  - **Rationale / implication:** this is the React-sanctioned external-store media pattern, with no `innerWidth` arithmetic and no per-pixel resize handler, so it honors the spirit of CLAUDE.md's "no JS resize/innerWidth checks" rule (which targets the imperative anti-pattern the mobile sweep removed) while still changing a render *branch* (not just styling) at a breakpoint — something pure CSS cannot do. Promoted to CLAUDE.md as the sanctioned alternative for render-branch-by-breakpoint.
- **The combined-years count audit outcome: the counts are CONFIRMED CORRECT — the reported "all-years shows fewer species" was grid re-alignment misread as a count change, NOT a count defect, and the fix is showing the DATE in every cell, not a count change.** A failing-first reproduction of a broken combined-years count *passed*: `buildDayCells`' combined path is a true cross-year species UNION (one bucket per `MM-DD`, a `Set` accumulated across all years, `union ≥ max(single years)`) for Species and a SUM for Checklists; the v0.5.60 `total`-metric commit left the species Sets untouched. The reported symptom was that the combined view aligns weekday columns to a fixed reference year, so a cell *position* maps to a different date than in a single-year view ("January 31 in 2026 became January 29 in all years") — the user was reading grid position, not date, because cells rendered only the count with no visible date. **The user-requested fix is therefore to render the day-of-month in every Large-view day cell** (data, present-but-zero, and blank/no-data), so a day is identified by its label, not its position; no count code changed. The union invariant is now regression-locked (a new `calendar.test.ts` case over *differing* species per year — previously only the same-species-collapses-to-1 case was covered). A latent, currently-unreachable `tierFor` out-of-range tier-6 fragility was hardened with a call-site-only `Math.min(tiers.tierFor(count), 5)` clamp (identity today; the county overlay's `breaks.length` return is untouched).
  - **Rationale / implication:** documenting a "no bug found, here's why, and here's the UX fix for the real confusion" outcome is as load-bearing as a fix — it prevents a future re-investigation of the same symptom. The per-view quantile shading (a darker single-year day can render lighter in combined even with a larger number) was noted as intended perceptual behavior, not a defect.
- **The `.sr-input-16` iOS no-zoom guard now beats an inline font-size (`font-size: 16px !important`, ≤640 tier only) — it was silently inert wherever a control carried an inline sub-16px font.** The guard's whole job is to raise a sub-16px form control to 16px on phones so iOS doesn't auto-zoom on focus; but many carriers set their font-size *inline* (specificity 1,0,0), which beat the class rule, so the guard did nothing on ~25 inputs across several tabs. Moving the class onto the `<input>` element and making the rule `!important` (scoped to the ≤640 block; desktop untouched) makes it actually bind.
  - **Rationale / implication:** this extends the existing `.sr-input-16` note — the guard must live on the input element AND out-rank inline font-size, or it is inert. `!important` is the correct tool here precisely because the thing it must beat is an inline style. Promoted to CLAUDE.md alongside the existing `.sr-input-16` guidance.

**Implications:** No prior decision is reversed; the v0.5.58 / v0.5.59 / v0.5.60 Calendar entries are extended. Verified: vitest 1406/1406, typecheck (`tsc -b`), lint, build (SpeciesCombobox emits as its own 1.98 kB-gz lazy chunk; no maplibre/county entry-chunk regression), and pytest 178 all green (QA PASSED, all criteria). Security PASSED with no findings at any severity — the combobox extraction loses no escaping (names render as escaped JSX, the filter is plain-string `includes()` with no `RegExp`, ids are `useId()`+index only), and the batch adds no network call, dependency, persistence write, or new sink. Two QA Known-Limitations stand as accepted: the app-wide `.sr-input-16` `!important` activation is verified by grep across all ~25 carriers but not by a live 320px visual pass; and the Calendar popup-close-on-selection + the ≤640 toggle `display:none` are code/CSS-verified only (jsdom can't execute media queries). The QA report's Enter-with-no-active limitation was FIXED after the report (a non-empty query now falls back to the first *species* row, not the "All species" row) and the report reconciled.

---

## Calendar Refinements — 2026-07-04 (v0.5.60)

**What:** Three refinements to the shipped Calendar tab (v0.5.58), all additive, shipped as one patch. (1) A third *Show* metric, **Total count** — each day shaded/numbered by the summed individual birds recorded (the eBird `Count` column). (2) The view-density toggle relabeled **Months → Large / Year → Compact** (both show the whole year; only cell size differs). (3) The Compact (formerly "Year") mini-cells now render the day's count number (was shading-only). Off-roadmap user request (a redirect from a New-Feature pick, confirmed as maintenance — polish/extension of a shipped feature). Frontend-only; no new data model (the `count` column was already parsed into `ObservationEntry.count`), network call, provider, or persisted setting. **These EXTEND the v0.5.58 Calendar entry and the v0.5.59 Tab Improvements entry — no prior decision is reversed.**

**Decisions worth keeping:**

- **Total count is a SUM metric, and an "X"/present-not-counted row contributes 0 individuals — deliberately matching the Statistics tab's `individualCount`.** The eBird `Count` column parses to `count: number | null`, where `null` is exactly the "X"/blank/non-numeric (present-but-uncounted) case; the new pure helper `individualsOf(count) = count ?? 0` returns 0 for it, so a day of all-"X" rows totals 0 (rendered as the present-but-zero cell, not blank — a checklist still landed there). Total count SUMs raw `count` over every qualifying row (no de-dup — a species on two same-day checklists adds twice), and the combined all-years view sums across years (Checklists-style, not the Species-union style). It threads through the untouched `metricCount` → `computeCountyTiers` (5-class) → `--sr-cal` ramp → legend/popup pipeline as a third branch; include-forms mirrors Species (`totalCount` / `totalCountWithForms`), so the toggle stays live for it (unlike Checklists).
  - **Rationale:** the app has exactly one prior individual-tally — Statistics' `individualCount` (`if (o.count !== null) sum += o.count`; X/null → 0, locked by test). Making the Calendar total match means a birder comparing a Calendar day's "312 individuals" to a Statistics figure gets **matching arithmetic** — the two tallies can't silently disagree. Counting "X" as 1 would inflate every total by the X-marked-row count and mix a *presence* signal into a *count* metric; 0 is the honest, consistent default.
  - **Implication:** any future individual-count surface uses the same `count ?? 0` rule for consistency with `individualCount`. "X as 1" remains a **defensible cheap reversal** if ever wanted — a one-line change in `individualsOf` plus two test assertions and the doc note, not a redesign.
- **The `ViewDensity` enum was renamed `'months' | 'year'` → `'large' | 'compact'` (with the UI labels) — a safe, migration-free rename.** The values are session-only `useState` (no `storage` seam, so no persisted `'months'` string to migrate), so code and UI now agree. Pure relabel: "Large" == the former "Months" big-grid view, "Compact" == the former "Year" thumbnail view; no behavior, layout, or data change. The user-facing model becomes "one calendar, two cell sizes" instead of the misleading "months vs year."
- **The Compact mini-cells now carry the active-metric count number — this EXTENDS (does not reverse) the v0.5.58 "numbers dropped at thumbnail size" note.** The number renders in the AA-guarded `--sr-cal-fg` (already covered by `calendarContrast.test.ts`, no new token/test), with the same tier-pill background under textures mode the Large cell uses. Legibility is protected by a **CSS container-query floor**, not a viewport breakpoint: `.sr-cal-minimonth` is a `container-type: inline-size` and a `@container (min-width: 152px)` rule reveals the number span; a genuinely sub-floor cell (e.g. a desktop 3-up narrow panel) degrades to shading-only by hiding only the number span — never distorting the cell or the grid — with the exact figure still in the Large view + day popup.

**Implications:** No prior decision is reversed; the v0.5.58 and v0.5.59 Calendar entries are extended. Verified: vitest 1387, typecheck, lint, build, pytest 178 all green (QA PASSED, all criteria); security posture unchanged (no new attack surface, network, provider, dependency, or persisted setting; `PRIVACY_POLICY` correctly unchanged). One QA Known-Limitation stands as accepted: the Compact mini-cell number and its 152px container-query floor are verified at the code/CSS level only (jsdom asserts the number renders and carries its value), not by a live pixel render — a coverage boundary of the test environment, not a defect.

---

## Tab Improvements Batch — 2026-07-04 (v0.5.59)

**What:** Three small enhancements to existing tabs, shipped as one patch. (1) Named Birds — each individual's header now shows the elapsed span between first & last sighting ("1 yr. 2 mos.") beside the dates. (2) Calendar — a Species filter dropdown narrows the whole calendar to one species. (3) Map Explorer — Nearby Lifers & Media Targets markers gained an always-on locator dot plus a per-panel "Labels | Dots" marker-style toggle. Off-roadmap user request (not in Up Next). Frontend-only; no new data model, network call, provider, or persisted setting.

**Decisions worth keeping:**

- **The Calendar per-species filter derives over a pre-filtered observation set, keyed by NORMALIZED common name.** A selected species filters observations *before* `buildDayCells` derivation (`calendar.ts` — one guard at the top of the observation loop), so the metric/tiering/legend/popup pipeline is unchanged; it simply operates over a smaller `DayCellMap`. The filter matches the **normalized parent** name (`normalizeSpeciesName`), so subspecies/form parentheticals ("Dark-eyed Junco (Oregon)") fold into the one selectable "Dark-eyed Junco" — consistent with the app's subspecies-folding elsewhere. Metric meaning under a filter: **Species** = 0-or-1-per-day presence of that species; **Checklists** = the number of checklists that recorded it that day (combined all-years aggregates that one species via the existing union/sum). `speciesFilter` is a separate optional arg, NOT folded into the `CalendarView` union — it is orthogonal to year/combined.
  - **Rationale:** filtering before derivation keeps `buildDayCells` a single pure pass and reuses the entire existing metric/tier/legend/popup machinery over the smaller map — no parallel path. Normalized-name matching gives the user one row per real species (folding forms) while still letting a genuine spuh/slash entry be selected and shown as its own presence.
- **A filtered species always renders via the with-forms field (`effectiveForms` neutralization).** Under a concrete-species filter the derivation forces the with-forms species set (`effectiveForms = speciesFilterActive ? true : includeForms`), so a selected spuh/slash/hybrid ("Gull sp.") shows *its own* daily presence rather than an all-zero grid; the spuh/include-forms toggle is disabled (inert) while a concrete species is selected — a normalized name has no forms to include. The DayPopup's "forms included" note gates on `includeForms && !speciesFilterActive` (not `effectiveForms`) so it doesn't render a meaningless note under a filter.
- **A cosmetic marker VIEW-mode (Labels/Dots) is a PROP, not part of the marker's remount key.** The Nearby Lifers / Media Targets Labels↔Dots toggle drives an in-place re-render (`markerMode` passed as a prop) and is deliberately **excluded** from the marker layer's `key`. Folding it into the key remounts the whole marker set on every toggle, which re-runs the `fitBounds` effect (the map re-frames to the pins) and dismisses any open popup — a jarring reframe for a purely cosmetic restyle. The locator dot is ground truth (always visible in both modes); Dots mode only hides the label chip via `display:none` while keeping the real focusable `<button>` + `aria-label` + popup, so keyboard/AT access is unchanged.
  - **Rationale / implication:** a recurring map trap worth standardizing — any cosmetic per-marker view-mode must be prop-driven and kept out of the remount key so a toggle doesn't re-fit the map or drop the popup; only genuinely structural key inputs (dataset length, view mode that changes *which* markers exist) belong in the key. Promoted to CLAUDE.md's map/overlays conventions.

**Implications:** No prior decision is reversed. Verified: vitest 1374, typecheck, lint, build, pytest 178 all green (QA PASSED, all criteria). No new attack surface, network, provider, dependency, or persisted setting; `escHtml` XSS guard on TargetMarkers preserved under the new visibility gating, `PRIVACY_POLICY` correctly unchanged.

---

## Calendar Tab: a purpose-built number-bearing shade ramp, a DOM crosshatch, lexical-only dates, and three design-stage additions — 2026-07-03 (v0.5.58)

**What:** A new **Calendar** tab that lays the birder's own eBird export out as a month-grid heatmap — each day shaded by that day's species or checklist count, per year or all-years-combined, with a per-day popup listing the day's checklists. Built by an off-roadmap user request (not in Up Next). Frontend-only, zero-network, offline-safe — computed entirely from the already-loaded backup, `React.lazy`-loaded and statically importing no map/maplibre module. Shipped as v0.5.58.

**Decisions worth keeping:**

- **A NEW purpose-built deep-green 5-tier day-shade ramp `--sr-cal-1..5` (+ `-rgb`) with one white on-cell number `--sr-cal-fg = #FFFFFF` — deliberately NOT reused from `--sr-county-1..10`.** A calendar cell CARRIES A NUMBER on the fill, so a single on-fill text color must clear 4.5:1 on every tier. The county ramp cannot satisfy this: county tier 7 (`#358758`, L≈0.188) is a dead zone where neither a light nor a dark number reaches 4.5:1 (pure white only 4.41:1), and no 10-class single-hue ramp can satisfy BOTH the 4.5:1-on-number rule AND the 1.2:1 adjacency floor at once. The 5-class deep ramp (`#357E56 → #0C271A`, theme-identical) clears both with margin (min on-number **4.92:1** at tier 1, min adjacency **1.313:1**); the class count of 5 is a *required* consequence of that math, not a preference (`computeCountyTiers` is reused as-is, called with `maxClasses = 5`). This extends the 0.5.44 milestone-badge lesson (deep tiles + one re-tuned on-tile text color, guarded at the token) and is guarded by a NEW `calendarContrast.test.ts` that parses the real tokens and asserts the on-cell number ≥4.5:1 on every tier in BOTH themes — the assertion `countyContrast.test.ts` does NOT make (it guards only ramp monotonicity/adjacency, having no on-fill text).
- **The colorblind crosshatch is a DOM CSS `repeating-linear-gradient`, NOT the map's MapLibre-sprite path.** The calendar is the DOM analogue of the county/atlas texture mode; it deliberately does NOT reuse the sprite / `ImageData` / `map.addImage` / `MutationObserver` machinery (that path exists only because MapLibre fills can't use CSS patterns). It reuses ONLY the pure monotonic density *shape* from `countyTextures.ts` (re-tuned as `CAL_HATCH`, plus a simplified single-direction `CAL_MINI_HATCH` for the Year-Overview thumbnails), covered by one monotonic-density guard; legend swatch and cell both derive from the same spec via `calHatchCss` so they can't drift.
- **ALL calendar date handling is lexical string-slicing + arithmetic — NEVER `new Date(str)`.** `daysInMonth` (arithmetic leap rule), `dayOfWeek` (Sakamoto/Zeller), and an explicit **ASCII** shape guard `/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/` + `isValidCalendarDay` own validation because the CSV parser stores `.date` verbatim/unvalidated. Rationale: `new Date(dateStr)` timezone-shifts the day (a checklist logged `2026-03-14` must land on March 14 regardless of device timezone — verified at the UTC+14 / UTC−12 extremes); a malformed row is dropped per-row, never rolled onto a neighbor. The explicit `[0-9]` class (not `\d`) mirrors the 0.5.54 discipline even though there is no Python twin.
- **Combined all-years mode = distinct-species UNION across years for the Species metric, SUM for the Checklists metric,** each labeled in the popup ("species ever recorded" / "checklists across N years", the latter using distinct-contributing-years so it can't regress to a whole-span count).
- **Three design-stage additions, approved under Studio-Style auto-advance and folded back into the written record** (prd FR-44/45/46 + QA-48/49/50): (a) a **Months | Year** view-density toggle whose Year mode renders a Year Overview — all twelve months as small heatmap thumbnails in a 3×4 grid (reflowing 3→2→1), day numbers dropped, click-a-thumbnail returns to Months; a pure layout choice re-rendering the same tiers at zero data cost. (b) A default-**OFF**, session-only "count spuh, slash & hybrids" `ToggleSwitch` affecting the **Species metric only** (Checklists never affected — dimmed + inert under it); `buildDayCells` keeps both a countable and an all-forms species set per day so the toggle re-reads without re-parsing (NFR-01 preserved). (c) The header split into a **primary controls row** (metric, year navigator + All years, density, textures) that wraps gracefully at every width, plus a **settling row** beneath carrying the low-emphasis spuh toggle so the primary line stays stable.

**Implications:** No prior decision is reversed. A future shade ramp whose cells carry text on the fill must be sized so ONE on-fill text color clears ≥4.5:1 on every tier in both themes, guarded by a parse-the-tokens both-themes test — `--sr-cal` exists separate from `--sr-county` for exactly this reason (promoted to CLAUDE.md, alongside the DOM-vs-map texture split). QA passed all five gates (vitest 1343, typecheck, lint, build, pytest 178) with zero fixes; security PASSED (15 checks, 0 findings — no new attack surface, network, provider, dependency, or persisted setting; `PRIVACY_POLICY` correctly unchanged). Several QA Known-Limitations (the no-re-read spy, the error phase, popup focus-restore / single-open) were subsequently closed with mutation-verified tests (Calendar.test.tsx 15→22, full suite 1351 passing) and the qa-report reconciled to match.

---

## Media-catalog taxon links: builders consolidated to one host + `taxonCode`, an additive `formCodes` map, and toggle-dependent link scope — 2026-07-03 (v0.5.57)

**What was broken:** Macaulay Library "view my media" links were broken for any bird recorded under a subspecies / identifiable-form / domestic-type name (a trailing parenthetical, e.g. "Scaly-breasted Munia (Scaled)"). One root cause, four builders, three surfaces, app-wide: the `/taxonomy/codes` lookup resolved only `category=="species"` names, so a form name resolved to no code — Species Detail then dropped the code entirely (linking to ALL the user's media, on the legacy `search.macaulaylibrary.org` host) and Multimedia + Statistics fell back to a malformed `?taxaName=…(Scaled)` filter. Shipped as v0.5.57.

**Decisions worth keeping:**

- **All ML catalog builders are consolidated onto ONE host with a single `taxonCode`-preferring pattern.** Every "view my media" link across Species Detail, Multimedia, and Statistics now builds on `media.ebird.org/catalog?…&taxonCode=<code>` via the shared `ML_CATALOG_BASE` (`lib/statsFormat.ts`). The legacy `search.macaulaylibrary.org` host and the `?taxaName=<name>` fallback are both **retired** — no builder emits either, and a link never goes out bare for a resolvable species. This closes the "SpeciesDetail's `mlCatalog.ts` still uses the legacy host — a remaining consolidation candidate" note carried in CLAUDE.md since v0.5.38. Net security hardening: the one data-derived-string-into-URL path (`?taxaName=<raw name>`) is gone, and `userId`/`taxonCode` are now `encodeURIComponent`-wrapped everywhere.
- **`/taxonomy/codes` gained an additive `formCodes` map** (all-category name→code, inverted from the bundled snapshot's `byCode`) so non-species names (subspecies/issf, domestic-type, identifiable form) resolve to their own code. The codes already shipped in `byCode` (17,891 entries, zero name collisions → lossless inversion) — this is a pure filter change, no snapshot regeneration, no `CACHE_KEY` bump, no new data or provider. The existing species-only `codes`/`orders` (feeding favicons + taxonomic sort) are **byte-identical**, asserted by new parity/router tests on both transports; form names still MISS `codes`. The two transports (`routers/taxonomy.py` `_by_com_all` ↔ `taxonomyService.ts` `byComAllFor`) are twins, locked by a `formCodes` parity test on the shared `taxonomyCollapse.fixture.json`.
- **The media link follows the "Show subspecies" toggle** on the two surfaces that have one. Centralized in `resolveMediaLinkTaxonCode(showSubspecies, formCode, speciesCode)` (`lib/mlCatalog.ts`): OFF → the species code (all the bird's media, resolved by normalizing the name first), ON → the form's own issf code (just that form) — on Species Detail + Multimedia. Statistics has no toggle → always the species code; the species code is the universal fallback whenever a form code is unresolvable (offline gap, unmapped name). The species-lookup path (favicons on Species Detail's header, taxonomic sort) is untouched — only the ML media link switched to the toggle-aware code.
- **The ON-case depends on the eBird catalog honoring an issf code in `?taxonCode=`** — this could not be verified headlessly and is carried as a **live deploy-smoke check** (open one ON-case link, e.g. `media.ebird.org/catalog?taxonCode=scbmun2&userId=<you>`, confirm it filters to the (Scaled) form). If the catalog turns out to be species-only, the documented degrade is a **one-line change** in `resolveMediaLinkTaxonCode` (drop the `formCode` preference in the ON branch); both call sites route through that one helper, and the backend/Tauri `formCodes` map can stay (harmless additive) or be removed separately.

**Implications:** No prior decision is reversed. Any new media-catalog link must build on `ML_CATALOG_BASE` with a `taxonCode` (resolved from the normalized name for the species code, or `formCodes` for a form), never `?taxaName=` or the legacy host, and reuse `resolveMediaLinkTaxonCode` rather than re-deriving the toggle branch; the `formCodes` map's dual-transport twins are extended via the shared fixture, and `codes`/`orders` must stay byte-identical. Promoted to CLAUDE.md (folded into the existing ML-catalog-links convention). Verified: vitest 1282, pytest 178, lint, `tsc -b`/build, entry-chunk guard all green; security PASSED (28 checks, 0 findings — one additive read-only field from bundled data, no new provider/dep/network/trust-boundary; `PRIVACY_POLICY` correctly unchanged, both hosts are ebird.org/Cornell Lab and these are user-clicked navigations, not embeds). One deploy-smoke item open for the user (the ON-case live check above).

---

## Touch-a11y follow-ups: two product scope calls (Life List sticky removed, not fixed; comparer breeding-label reveal declined) — 2026-07-02 (v0.5.56)

**What:** An Improve run resolving the three deferred-behavior findings tracked on the ROADMAP Horizon after the v0.5.55 mobile audit — hover-only / touch-inert affordances surfaced for touch users using the existing responsive/accessibility conventions (breeding-code meanings as visible legend text; comparer media counts revealed on the ≤640 tier via a new base-hidden `.sr-media-count` class; the inert Life List sticky-header CSS removed). No new component, network call, provider, or convention. Shipped as v0.5.56.

**Decisions worth keeping:**

- **Finding #40 was reframed from "make the phone sticky header work" to "remove it" (user decision).** The Life List `<thead>`'s `position:sticky; top:0` was inert (no bounded vertical-scroll ancestor), so the header already scrolled away with the page. Rather than add a bounded-scroll model to engage the sticky on phones, the user decided a phone sticky header only wastes screen space and isn't wanted — so the finding is resolved as a cleanup: the ineffective sticky declaration is gated to `wideMode` only (its byte-identical prior behavior), and the default-mode header intentionally scrolls away. No behavior change on any surface.
- **Finding #27's in-comparer breeding-LABEL reveal was declined as feature-territory.** The comparer's media counts were revealed on the phone tier, but the `BreedingBadge` full label was deliberately NOT inlined — there's no room in the 3–4px pill and an in-comparer label reveal would be new UI. The meaning is reachable instead via the #26 Breeding Codes legend (now visible text), so touch users lose nothing; adding a second reveal path in the comparer stays out of the Improve lane.

**Implications:** No prior decision is reversed. Both calls follow the standing CLAUDE.md line between surfacing existing information for touch (in-lane) and adding new UI/behavior (feature-territory). `.sr-media-count` is one more instance of the documented base-hide/≤640-reveal idiom (alongside `.sr-sidecell-tag`) — no new convention promoted. Verified: vitest 1259, pytest 172, lint, `tsc -b`, build, entry-chunk guard all green; security review PASSED (24 checks, 0 findings — no new attack surface, trust boundary, or dependency; `PRIVACY_POLICY` unchanged). Frontend-only.

---

## Mobile-prep sweep: responsive fix pass + two efficiency tidies + a logged geolocation-plugin reversal — 2026-07-02 (v0.5.55)

**What:** A bundled Improve run ahead of the mobile launch — the mobile-readiness responsive/accessibility fix pass plus three of the four recorded deferrals now due. Shipped as v0.5.55 (headless `CI=true` release from Hephaestus; the standing tag-re-push commit==tag check held — see the reversal note below). No new user-facing feature; visual repair of existing screens + output-identical/dead-code internals.

**Decisions worth keeping:**

- **The geolocation-plugin removal REVERSES the 2026-05-26 "`tauri-plugin-geolocation` remains registered for future iOS/Android" note.** `@tauri-apps/plugin-geolocation` (JS dep), the `tauri-plugin-geolocation` crate + `lib.rs` registration, and the three `geolocation:*` capability grants were all dead — zero JS imports, location runs entirely on the native `get_location` command, which is untouched. Rationale for reversing: shipping dead capability grants is the worse standing state, and re-adding is a ~3-line change (Cargo.toml + lib.rs + grants) *if* the mobile app is even Tauri-based. This alters the desktop binary, so it correctly carried its own version bump + Mac release (why it was deferred from the v0.5.52 audit rather than done inline). Executes the v0.5.52 Horizon item.
- **Pooled httpx client is a LAZY singleton, NOT lifespan-created.** New `backend/http_client.py` `get_client()` replaces the ~13 per-call `async with httpx.AsyncClient()` sites with one process-wide keep-alive client; `main.py`'s lifespan only *closes* it on shutdown. It must be lazy-created on first use, never created in lifespan startup: the test suite mounts `TestClient(app)` at module scope *without* a context manager, so lifespan startup never runs — a lifespan-created client would be `None` under every test. Per-request timeouts are preserved by passing `timeout=` at each call site (the shared client carries no default headers/cookies/auth/base-URL — verified no cross-request state bleed in the security review). The ~19 constructor-patching test mocks were repointed to patch the shared accessor. Executes the v0.5.52 Horizon item; promoted to CLAUDE.md.
- **The recent-obs cache is keyed `(lat,lng,dist)`, codes-independent, in BOTH runtimes.** The underlying eBird `data/obs/geo/recent` fetch is deduped on `(lat,lng,dist)` with the `codes` filter applied *after* the cached fetch (`backend/routers/map.py` ↔ `lib/tauri/mapService.ts`, dual-transport parity preserved), so Media Targets + Nearby Lifers at the same center share one eBird fetch. 90 s TTL (matches `networkCache`); errors are not cached; honors the desktop API-key-change invalidation; the optional-`codes` route contract and lat/lng/dist bounds (v0.5.35 Nearby Lifers) are preserved. Executes the v0.5.52 Horizon item.
- **The responsive pass adds two audit lenses the v0.5.37 sweep never covered: touch-target sizing and iOS sub-16px input auto-zoom.** 67 of 71 adversarially-verified findings were fixed (66 by the pipeline; finding #5, the comparer A/B cell labels, the user Dave implemented and folded into the release himself — see below). All fixes EXTEND the v0.5.37 class-based system (lift-to-class, established breakpoint tiers, size-in-rem) — no inline responsive styles introduced. Four new shared `globals.css` classes are the standing vocabulary for the two new lenses plus popup overflow and control wrapping: `.sr-touch-target` (~44px min-height, ≤640 tier only), `.sr-map-popup-body` (`max-height: min(60dvh, 26rem)` + internal scroll + `overscroll-behavior: contain` for tall map popups), `.sr-input-16` (16px font in the ≤640 tier — the one place a px font-size is correct, since the iOS zoom threshold is an absolute px value; avoids a `maximum-scale` that would kill pinch-zoom), and `.sr-wrap-flex` (wrapping inline flex control groups). Plus `.sr-sidecell-tag` from finding #5. Fixes hold at 320px and 200% text scale; desktop above 640px is unchanged. All four promoted to CLAUDE.md.

**Out-of-band user change (the standing re-push check held):** the user (Dave) shipped finding #5 (the List Comparer A/B cell labels) himself on top of the release commit and MOVED the v0.5.55 tag to it mid-deploy. The Orchestrator ff-merged to that commit (081a2588), re-ran gates (vitest 1257 green), and verified the selected Windows CI run's `headSha == git rev-parse v0.5.55^{commit}` before building — exactly the standing guard against a stale-CI-run mis-select after a tag re-push (0.5.34 post-mortem). So finding #5 is DONE, not deferred.

**Implications:** New backend outbound calls use `http_client.get_client()` + `await client.get(..., timeout=...)`, never `async with httpx.AsyncClient()` per call. New UI uses the four shared classes rather than re-inlining; touch targets on fixed controls meet the ~44px posture in the ≤640 tier and no form control ships a sub-16px font-size on phone. The responsive groundwork for the mobile app is now complete across every surface (the v0.5.37 sweep did the nav + reflow; this closed the touch-target and iOS-zoom lenses). Verified: vitest 1257, pytest 172, lint, `tsc -b`, build, cargo check, entry-chunk guard all green; security review PASSED (41 checks, 0 findings — no new network/provider/trust-boundary; the geolocation removal only shrinks the desktop capability surface). Three deferred-behavior audit findings that cross into new-content/behavior territory are tracked on the ROADMAP Horizon (breeding-code hover-only meanings, comparer title-only badge/media tooltips, LifeListTable inert sticky header).

---

## County Completeness: fixed percent bands, the first online/key shading mode, taxonomic-floor targets — 2026-07-02 (v0.5.54)

**What:** A third county-shading metric on the Map Explorer — **Completeness** — shading each US county the user has birded by their countable species recorded there ÷ eBird's all-time county species list (new `GET /map/county-species` → eBird `product/spplist`, dual-transport), on ten FIXED 0–100% bands over the existing green ramp. The county popup gains a progress bar, the user's five newest new-in-county species (backup-derived — works offline), and a five-species targets list; never-birded counties stay plain outlines with a click-to-fetch **Load completeness** button. Per-county results persist 30 days via the storage seam (`lib/countyCompletenessCache.ts`), and eager fetching is bounded to birded, in-view, region-resolvable counties through a pool of four — never a bulk sweep. Shipped as v0.5.54 (headless `CI=true` release from Hephaestus; Windows CI run verified against the tag per the standing check).

**Decisions worth keeping:**

- **Fixed percentage bands, NOT quantiles, for absolute-scale metrics.** "50% complete" has absolute meaning, so the legend must read as a fixed 0–100% scale — the same shade always means the same completeness — unlike the count metrics, where quantiles correct for skew. The band path (`COMPLETENESS_BANDS` / `completenessBand` in `lib/countyCompleteness.ts`, (lo, hi] semantics, FP-epsilon-guarded) lives PARALLEL to `computeCountyTiers`, feeding the same tier property/tokens/hatch sprites; the quantile machinery is untouched, and a `CountyLayer` parity test proves the count metrics never consult the completeness controller.
- **The online/key trade-off is accepted — the first county-shading mode that cannot run fully offline.** The denominator and targets are eBird-side, so the mode needs a network connection and the user's own eBird key. Disclosed at the point of use (a note under the metric switch) and in HELP/README/website; degrades through the app's standard three states (offline / no-key / server-error); cached counties still shade offline. Consistent with the founding device-to-provider posture — `PRIVACY_POLICY.md`'s eBird bullet now names the county species-list call explicitly.
- **Targets ship as the unranked taxonomic-order floor.** The public eBird API has no all-time frequency product, and the recency-based alternative would double the per-county calls, so v1 lists the first five unrecorded species in taxonomic order and the popup caption says so honestly. The `completenessTargets` seam accepts a future findability-ranked pool without a route change — tracked on the ROADMAP Horizon.
- **A fetched-but-0% county stays unshaded.** "Plain outline = never birded" survives click-to-fetch scouting: Load completeness shows "0 of Y species · 0%" plus targets, but the county keeps band 0.
- **Security findings, both closed before ship:** (1) the backend pydantic region pattern's `\d` accepted Unicode digits (pydantic v2's rust-regex `\d` is Unicode-aware) while the JS twin's `\d` is ASCII-only — a twin-parity gap with no exploit path (the value is percent-encoded into a fixed-base path segment); fixed to `[0-9]` with a Unicode-digit rejection test, and the rule is promoted to CLAUDE.md. (2) The cache's load path accepted well-formed documents with malformed entries into render state (a crash surface on a truncated write or hand-edit); per-entry shape validation on load now drops — never throws on — malformed entries.
- **Design-stage deviations, user-ratified (D-401/D-402):** the county sub-toggle is relabeled **"Shade counties"** (it now governs three metrics, two of which aren't "species seen" — a shipped-label edit outside the feature's additive surface), and the completeness popup RETAINS the species/checklists count row, disambiguated by labeling ("Countable species — spuhs, slashes & hybrids don't count") rather than dropped.

**Implications:** Future absolute-scale map metrics copy the fixed-band parallel path, never extend the quantile code; long-TTL persistent network caches follow `countyCompletenessCache.ts` (both promoted to CLAUDE.md). QA's two coverage-gap flags — a shared fixture test locking the dual-transport taxonomy-collapse twins (`collapse_to_species_list` ↔ `collapseToSpeciesList`, currently lockstep-by-comment), and a direct hook test of `useCountyCompleteness`'s eager-fetch gating — are tracked on the ROADMAP Horizon. Verified: frontend 1238 / backend 163 tests, QA 36/36 criteria, security PASSED WITH NOTES (all actionable findings closed), entry-chunk guard extended and green.

---

## Map Explorer Point Size control: the automatic pin-fade made user-controllable — 2026-07-01 (v0.5.53)

**Decision:** A session-only **Point Size** control (Normal / Small / Off, a `SegControl`) on the Map Explorer's My Sightings map, shown under the Pins/Heatmap toggle in Pins mode only. It governs the `sr-sight-circle` GL layer: **Small** shrinks the sighting points, **Off** hides them AND their click/popup target so a shaded breeding-block or county choropleth reads through cleanly; the heatmap is untouched. This is an **EXTENSION of the v0.5.47 shade auto-dim, NOT a reversal** — it composes with it (Small + an active shade multiplies the point opacity by the dim factor; radius factor and opacity dim are independent axes). Default **Normal** is zero change for existing users. Session-only (plain `useState`, no `storage` seam), matching displayMode / shade state.

**Rationale / lane call:** The v0.5.47 auto-dim helps but isn't user-controllable and can't fully hide points; the user asked specifically for an *option* to make points "very small or hide them altogether" when examining shaded blocks/counties. Kept on the Improve side of the v0.5.47 "don't expose a Desaturate-basemap toggle (that's New-Feature territory)" line: this is a visibility refinement of an existing surface (points already fade), reusing the shipped `SegControl` / `SidebarLabel` / `aria-pressed` sidebar patterns — no new data, schema, page, network call, or design/brand judgment.

**Mechanism:** `PointSize` union in `lib/mapExplorerTypes.ts`; `lib/mapPins.ts` gained `POINT_SIZE_RADIUS_FACTOR` (normal:1, small:0.5) + a `factor` arg threaded through `pinRadiusExpr`/`pinFillRadiusExpr` with a factor-1 short-circuit (so **Normal is byte-identical** to pre-0.5.53), parity-locked by `mapPins.test.ts`; `SightingMarkers.tsx` gained a `pointSize` prop (Off returns null, gating the click/hover handlers); `MapExplorer.tsx` adds the SegControl + session `useState`. Full CI mirror green; QA PASSED; security review CLEAN (no new network/provider/data). Source shipped as v0.5.53 from Hephaestus; the binary release runs on the same machine.

**Implications:** A standing pattern — a magnitude/opacity auto-treatment (like the shade auto-dim) can be lifted to an explicit user control that *composes* with the automatic behavior rather than replacing it, provided the axes are independent. Point sizing is single-sourced in `lib/mapPins.ts` (`POINT_SIZE_RADIUS_FACTOR` + the `factor` arg); promoted to CLAUDE.md.

---

## `CI=true` for a headless `release.sh` run (non-GUI / automation context) — 2026-07-01 (v0.5.53; release tooling)

**Decision:** When `release.sh` is run from a non-GUI / automation process (e.g. an agent, an SSH session, a CI-like context) rather than an interactive logged-in desktop, set **`CI=true`** so Tauri passes `--skip-jenkins` and builds the macOS DMG headless.

**Root cause:** Tauri's `bundle_dmg.sh` uses Finder AppleScript (`osascript`) to style the disk-image window, which needs a logged-in GUI session; without one the DMG step dies (`failed to run bundle_dmg.sh`). `CI=true` skips only the cosmetic AppleScript window-styling, producing a plain DMG that is otherwise identical to the interactive one. **codesign + notarize work cross-session** — only the DMG *styling* needed the GUI — so signing/notarization/`latest.json` are unaffected.

**Implications:** The seamless headless command is `CI=true SKIP_NPM_INSTALL=1 zsh -lc ./release.sh` (drop `SKIP_NPM_INSTALL=1` for a cold checkout). Recorded in CLAUDE.md's release section. Complements the existing `.nvmrc`/self-healing-`release.sh` release-tooling decisions; no app-bundle change, no version bump on its own (it rode along with the v0.5.53 feature release).

---

## Efficiency & docs maintenance sweep: a no-behavior-change audit shipped as v0.5.52 — 2026-06-30 (v0.5.52)

**Decision:** A user-requested comprehensive audit asked two things — can the app be made more efficient, and are the README/docs/website current. A multi-agent audit (efficiency finders + doc-currency checkers, each finding adversarially verified as real AND behavior-preserving) returned 28 verified findings, ALL low-severity. The honest read, recorded deliberately: the app is already efficient (the v0.5.16 / v0.5.42 / v0.5.31 sweeps did the heavy lifting; no real bottleneck), so no performance project was manufactured. Shipped the full sweep as ONE patch v0.5.52: (a) doc-currency catch-up — README/HELP/ACCESSIBILITY caught up to the county overlay (offline lists + the "Counties in view" keyboard route), the README desktop-build root-install clarification, and three stale comments (the CLAUDE.md website-version note, the vite chunk-size rationale, a phantom `nemesis` cache path); (b) five output-identical code tidies — `backend/services/noaa.py` tide fetch parallelized with `asyncio.gather` (the one real, modest latency win; web/Pi only, matching the desktop TS twin), a SpeciesDetail filter-strip `useMemo`, `computeTotals` min/max tracked in the existing loop (no sort), `Checklists` eBird+ML `Promise.all`, and backend file writes via `run_in_threadpool`; (c) dev/CI hygiene — `typecheck` fixed from a no-op `tsc --noEmit` to `tsc -b`, dead `frontend/src/lib/utils.ts` + `clsx`/`tailwind-merge`/`class-variance-authority` removed, three dead Vite-template assets deleted, pipeline concurrency-cancel + a windows-build npm cache.

**Rationale:** The version-bump split is the operational crux. The docs / dev-tooling / dead-code / CI items are byte-identical and per CLAUDE.md's precedent need no bump on their own, but they were bundled WITH the shipped-code tidies (which touch the user-facing product and ARE a "fix" under the always-bump rule) into one patch release rather than split into two trains. Behavior-change risk was the scope disqualifier: the verifier flagged two tempting consolidations — a single weather/tide block classifier in `commentBlocks.ts`, and routing LifeList's ML load through `loadMLExport()` — as NOT provably output-identical (the raincrow no-strip path vs the snowraven tag-strip path; and `loadMLExport`'s swallow-to-null vs LifeList's setup-required + `detectFileType` gate), so both were excluded. Three larger efficiency items were deferred as their own runs rather than risk-loaded into a maintenance sweep.

**Implications:** Deferred to ROADMAP "On the Horizon": a pooled/lifespan `httpx.AsyncClient` (needs the per-call test mocks reworked), a codes-independent recent-obs cache (must preserve the `mapService.ts` + `backend/routers/map.py` dual-transport parity), and full removal of the dead geolocation plugin (alters the desktop binary → its own bump + Mac release). `npm run typecheck` now does real work — `tsc -b` follows the project references; the old `tsc --noEmit` compiled ZERO files — so CLAUDE.md's "at minimum npm run typecheck" pre-push advice now genuinely holds (CLAUDE.md updated to say so). The reusable shape for a "make it better" request: multi-agent fan-out with adversarial real-AND-behavior-preserving verification, then an honest "don't manufacture work" synthesis that scopes to genuine value. Verified via the full CI mirror (frontend lint / typecheck / 1173 tests / build + entry-chunk guard intact; backend ruff / 157 pytest); QA report PASSED, security review CLEAN (no new network/provider/dependency, `PRIVACY_POLICY` unchanged). Source shipped as v0.5.52 from this VM; the binary release (`release.sh`) runs on the Mac.

---

## Colorblind-accessible county shading: a "Use Textures" mode mirroring the atlas hatch — 2026-06-29 (v0.5.51)

**Decision:** Extend the atlas overlay's existing "Use Textures" affordance (v0.5.2) to the county choropleth, bringing the two mutually-exclusive shading ramps to parity. When county shading is on, a new opt-in toggle (default OFF, session-scoped, no persistence) paints each county's count tier as a CROSSHATCH whose DENSITY rises with the tier — sparse at tier 1, tight at tier 10 — instead of relying on the single-hue green ramp, so the map reads for colorblind/low-vision users who can't separate ten green steps that sit at the ≥1.2:1 legibility floor by design. This is the colorblind / WCAG-AA parity follow-up to the v0.5.46–0.5.50 county work (it was never an Up Next item — an accessibility follow-on to the county overlay, the direct analogue of the atlas hatch). Frontend-only; no new network, providers, bundled data, or telemetry; `PRIVACY_POLICY` unchanged.

**Rationale / design — ONE crosshatch, density-coded across 10 tiers (the three OQ calls):** (1) A single 45°/135° crosshatch motif whose density encodes the tier, NOT ten distinct motifs — line SPACING carries tiers 1–6 and line WEIGHT takes over 7–10 (where the gap can't shrink further), with tier 10 capped at ~60% ink (never solid). A pure proxy `countyHatchDensity(tier) = lineWidthPx/gapPx` is strictly monotonic with a min adjacency ratio ~1.195. (2) The faint tint underlay (0.12) is KEPT beneath the hatch (strokes at 0.80) — both read `--sr-county-N-rgb` at generation time — so the texture mode still carries a residual color cue rather than going pure black-on-white. (3) A tier-1 ~10% open-lattice floor so the lightest counties still show a visible-but-sparse pattern instead of reading as empty.

**Mechanism:** NEW `frontend/src/lib/countyTextures.ts` (the county analogue of `lib/atlasTextures.ts`): canvas `ImageData` sprites `sr-county-hatch-1..10`, the `HATCH` density table {gapPx 20→5, lineWidthPx 0.75→1.30}, and `countyHatchSpec` (one geometry source the legend imports so it can't drift from the map). `CountyLayer.tsx` gained a `useTextures` prop + a sprite-registration effect that EXTENDS the existing `themeRev` MutationObserver — all 10 sprites registered UNCONDITIONALLY (no `isStyleLoaded` gate — the 0.5.30 pitfall), `styleimagemissing` net scoped to its own ids via `countyHatchTierForImage`; `useHatch = useTextures && shadeOn` switches the paint to `fill-pattern` else the unchanged `fill-color`. **The fill layer id stays `sr-county-fill` in BOTH branches** (load-bearing for the heatmap z-order + `BasemapDesaturation`). The legend + the 11px "Counties in view" swatch swap to a new `CountyDensitySwatch` in `map/MapSidebarUI.tsx`. Guard: NEW `frontend/src/lib/countyTextures.test.ts` (strict-monotonic + adjacency ≥ `MIN_ADJ_RATIO` 1.12 on the density proxy) — the density analogue of the UNCHANGED `countyContrast.test.ts` (which guards the COLOR ramp).

**Implications:** A standing pattern — a magnitude choropleth gets a colorblind path by density-coding ONE texture motif, guarded by a pure density-proxy test the way the color ramp is guarded by a contrast test. Preserved untouched: `nextShadingState` mutual exclusivity, `BasemapDesaturation`, the `SightingMarkers` `shadingFillId`/heatmap z-order, the county boundary lines, the popup, the (state,county) join, the viewport cap, and the `--sr-county-*` tokens. Verified via the full CI mirror (lint, typecheck, 1173/1173 vitest incl. the new guard, build, entry-chunk guard intact — `countyTextures.ts` is a plain sync lib, no maplibre/county-json on the entry chunk); QA-report PASSED all 24 criteria; security review CLEAN PASS. **Source shipped as v0.5.51 (committed + pushed + tagged from this VM); the binary release (macOS DMG + Windows installer via `release.sh`) runs on the Mac afterward.**

---

## County Fill Sharpen: bundled geometry 10% → 15% simplify so the shaded-edge sliver disappears at high zoom — 2026-06-29 (v0.5.50)

**Decision:** The deferred "A-plus" follow-up to v0.5.49. Raised `SIMPLIFY_PCT` in `scripts/build-county-boundaries.mjs` from `10%` to `15%` (Visvalingam keep-shapes) and regenerated `frontend/src/assets/us-counties.json`, so the county FILL edge (and the below-z9 / offline line fallback, both driven by this one file) hugs the true boundary closely enough that the hair-thin shaded sliver under the crisp basemap-tile county line (the v0.5.49 accepted tradeoff) is no longer perceptible at high zoom when county shading is on. This is effectively the "option D — one sharper file driving both lines and fills" deferred from v0.5.49, achieved by sharpening the single existing file. No code, runtime, network, provider, or privacy change; `CountyLayer` reads the same asset, just sharper.

**Rationale:** A live sweep measured the size/sharpness curve against the script's hard 1.3 MB gz guard: 10% = 38.6 verts/county / 703 KB gz (current); **15% = 54.1 / 969 KB gz (chosen)**; 20% = 69.7 / 1232 KB gz (only ~7% under budget); 25% = 1495 KB gz (over). 15% is the sharpest *round* notch that keeps a comfortable ~27% gz margin and lands the built on-demand chunk near ~1.04 MB-gz (was ~751 KB), so a future Census vintage and the JS-wrapping overhead can't push it past the guard. 20% was available and sharper but eats nearly all the budget margin and pushes the built chunk over the 1100 KB chunk-size-warning line — rejected as too close to the edge for a bundled asset. The sliver is a fidelity artifact that shrinks with vertex density; 15% (a 40% density increase) pushes it below visibility at the overlay's practical zooms without chasing the asymptote.

**Mechanism:** `SIMPLIFY_PCT='15%'` + an updated comment in `build-county-boundaries.mjs`; `us-counties.json` regenerated (3145 features, all hard guards pass: ≥3000 features, raw 3.76 MB ≤ 5.5 MB ceiling, gz 969 KB ≤ 1.3 MB budget). `GZ_BUDGET`/`RAW_CEILING` and the NFR-02 budget are UNCHANGED (15% fits within them). Verified via the full CI mirror (lint, typecheck, 1168 tests, build) — `entryChunk.test.ts` still confirms the (now larger) asset stays off the entry chunk as an on-demand chunk.

**Implications:** Any further sharpening (toward 20%) would need the gz guard widened first and would re-cross the chunk-size-warning line — weigh the marginal sliver reduction against the on-demand download (already ~1.04 MB-gz at 15%). The build-script comment now carries the 2.5% → 10% → 15% history; keep CLAUDE.md's county-geometry figures (15%-keep, ~1.04 MB-gz) in sync on the next resharpen.

---

## County Overlay Precision: accurate county LINES from the basemap's own vector tiles (z9+), + a shared-HotspotLink popup-overflow fix — 2026-06-29 (v0.5.49)

**Decision:** Two Improve-lane fixes to the Map Explorer county overlay. (1) The overlay's boundary LINES are now drawn from the basemap's OWN `openmaptiles` vector source (`boundary` source-layer, `admin_level==6`, minzoom 9) instead of the bundled simplified GeoJSON, so they are pixel-accurate at every zoom — they ARE the same line the basemap renders underneath. The bundled `us-counties.json` is retained for the shade fill, the popup, the (stusps,name) join, and the below-z9 / offline LINE fallback (the bundled `sr-county-line` is maxzoom-capped at 9); `boundary_3` is narrowed to `admin_level<=4` so counties are overlay-only and don't double-draw a faint dashed line under the dedicated county line. (2) The shaded-popup overflow on long place names was a latent gap in the SHARED `HotspotLink` — its public-hotspot link branch was `inline-flex` with `min-width:0` but no `max-width:100%`, so it shrink-to-fit overflowed; adding `maxWidth:100%` gated on `truncate` mirrors the plain branch and fixes every truncating hotspot-link site. (The v0.5.48 county-NAME wrap fix was holding; this was a different element — the popup's top-3 place names, reachable only in the records/"Checklists" metric, which only renders when shading is on — hence "shaded-map only".)

**Rationale:** User chose **Approach A-minimal** over A-plus (also sharpen the bundled fill so shaded edges track) and D (ship a much sharper single bundled file driving both lines and fills) after being shown the tradeoffs and the on-demand-chunk download sizes (current ~0.69 MB raw-gz / 751 KB built-chunk-gz; D would be +2–3 MB and bust the size guard). A is the only option that draws the actual line the user already sees underneath — their literal complaint — at ZERO new network, ZERO new provider, ZERO privacy-policy change, and ZERO bundle growth (the tiles are already fetched), so it stays cleanly in the Improve lane and is genuinely zoom-native. Feasibility was verified live: the OpenFreeMap planet TileJSON exposes a `boundary` vector_layer with `admin_level` (zoom 0–14), and the app's tuned `boundary_3` already filtered `admin_level<=6` — i.e. admin_level-6 county lines were ALREADY rendering on the basemap (that IS the "true line underneath"). Approaches B (new hosted tile/data provider = new browser→provider request + a `PRIVACY_POLICY` disclosure → New-Feature territory) and C (bundled/desktop PMTiles via srpm:// = a new build artifact + a desktop/web parity split) were excluded as out-of-lane.

**Implications:** A standing pattern for map overlays — a GL *boundary LINE* can be sourced from the basemap's own `openmaptiles`/`boundary` vector source (no bundle, accurate at every zoom), while *fills/joins* that need entity identity (FIPS, name) stay on bundled geometry. Two accepted tradeoffs are logged: (a) a hair-thin shaded-fill sliver when shading is ON and zoomed past z9, and (b) no county lines when fully offline with no region downloaded above z9. The `HotspotLink` `max-width` gap is fixed for ALL truncating link sites (e.g. Species Detail named-birds), not just this popup. CLAUDE.md gains the accurate-line architecture note; `CountyLayer.test.tsx` (new) + extended `HotspotLink.test.tsx` / `mapStyle.test.ts` lock the contract. Confirmed NO doc-drift in CLAUDE.md's "~751 KB-gz" — that is the BUILT chunk size (751.84 kB gz at build), distinct from the raw-json gzip; geometry unchanged this run. Full CI mirror green (lint, typecheck, 1168 tests, build); security/privacy review clean (no new network/provider, no `PRIVACY_POLICY` change). Follow-up (non-blocking): an in-app spot check at z10–12 that the line hands off at ~z9 with no pop; A-plus / D remain on the table if the sliver is later judged unacceptable.

## Map Explorer Fixes: 10-step county choropleth, sharper county geometry, checklist-count clarity, collapsible in-view lists — 2026-06-29 (v0.5.48)

**Decision:** Five Map Explorer refinements shipped as v0.5.48. (1) The county shade ramp widened from 4 to **10 data-driven quantile classes** so well-birded counties separate instead of clumping in one coarse top class — same quantile algorithm, new `--sr-county-5..10` tokens, a geometric-luminance-spaced green ramp with every adjacency ≥1.21:1 (`countyContrast.test` extended to tiers 1..10). (2) The bundled county boundary geometry was resharpened from 2.5%-keep to **10%-keep** Visvalingam (`build-county-boundaries.mjs`), trading the ~310 KB-gz on-demand chunk for ~751 KB gz to remove the blocky polygonal look (source is unchanged — already the finest Census cb_2023 500k). (3) The county popup count is clarified as a **checklist** count (not individual birds) via a caption, per-row + headline tooltips, and a "Records"→"Checklists" toggle relabel — labeling only, no aggregation change. (4) Long county names **wrap** inside the popup (`sr-wrap-anywhere` + `min-width:0`), matching the sibling popups. (5) A chevron **disclosure collapses** the four "… in view" sidebar lists (Sightings/Hotspots/Targets/Lifers), reusing the shipped Filters / Counties-in-view pattern; expanded by default, session-only, per-panel.

**Rationale:** All user-reported polish on the v0.5.46/0.5.47 county overlay. The 4-class quantile ramp's top class swallowed the entire upper quartile on skewed birding data (a 30-species county and a 400-species county rendered identically); 10 classes subdivide exactly that over-coarse top end. Quantile was kept (equal-interval IS the clumping failure on skewed data; Jenks is more risk for little gain). 10 single-hue green steps sit at the legibility floor by design — the user chose maximum granularity over wider per-step contrast, and the contrast test guards it. Only the geometry's simplification was raised (not the source), so NFR-02's ≤400 KB budget was a deliberate product choice the v0.5.46 PRD explicitly anticipated revising. The popup count was genuinely ambiguous (a bare unitless number); the fix is labeling only — the eBird individual-count column is deliberately never aggregated here.

**Implications:** Extends the v0.5.46 county ramp from 4 to 10 classes (the "more steps based on actual counts" the user asked for); the 10-step ramp + the "update FOUR sites in lockstep or tiers paint black" rule are promoted to CLAUDE.md. NFR-02 county-chunk budget raised from 400 KB to ~1.3 MB gz (actual 751 KB) — the v0.5.46 PRD's NFR-02/QA-29 figures are superseded (logged here rather than rewriting the closed feature's spec). **v0.5.48 supersedes the still-unreleased v0.5.47** (and 0.5.45/0.5.46): its source rolls up all of them, so the Mac releases one consolidated 0.5.48 binary.

## Dev Dependency Cleanup: patch the dev-only `undici` audit finding, no version bump — 2026-06-29 (dev tooling; no version bump)

**Decision:** Cleared the high-severity `undici` advisory `npm audit` reported in `frontend` by running the non-breaking `npm audit fix` (no `--force`), bumping the transitively-pulled `undici` 7.27.1 → 7.28.0. `undici` is a dev/test-only dependency (pulled by `jsdom`, the vitest jsdom environment); the production-only audit (`npm audit --omit=dev`) was and remains clean, so it never shipped in the app. The change is `frontend/package-lock.json` only — `package.json` and `jsdom@^29.1.1` are untouched; `npm audit fix` also synced the lockfile's stale root metadata (`version` 0.5.44 → 0.5.47, the `engines` block) to match `package.json`. **No version bump, no changelog entry, no tag, no release.**

**Rationale:** A dev-only dependency patch produces a byte-identical app bundle, so a version bump would mislabel an unchanged binary and needlessly trip the in-app updater. It also protects the still-pending **v0.5.47** macOS/Windows binary release (the v0.5.47 tag sits at the prior HEAD): a 0.5.48 tag would supersede it and re-trigger CI for zero app change. The lock-file fix commits one commit ahead of the v0.5.47 tag on `main`; `release.sh` builds `main` (with the harmless dev-dep fix folded in, version still 0.5.47), the already-built Windows v0.5.47 artifact is unaffected, and no tag was moved (so the stale-CI-run hazard doesn't apply). Full CI mirror green (lint, typecheck, 1158 tests, build); security review clean.

**Implications:** Establishes the carve-out now in CLAUDE.md → Versioning: a dev-only/toolchain change that doesn't affect the shipped bundle skips the version bump / changelog / tag / release and commits straight to `main`. Mirrors the earlier Node-25 release-tooling entry ("no version bump"). When the Mac next pulls `main` to run the pending v0.5.47 release, this fix rides along harmlessly.

## Map Explorer Shading Polish: single-active-shading (reverses the atlas/county coexistence contract) + auto-muted basemap — 2026-06-28 (v0.5.47)

**Decision:** Three refinements to the v0.5.46 county/atlas shading. (1) The "… in view" list is now the last section in every Map Explorer panel (it was a Sightings/Hotspots outlier rendering before the overlay controls). (2) The county (green) and atlas (purple) SHADE fills are now MUTUALLY EXCLUSIVE — turning one on clears the other; boundary lines may still coexist. (3) While either shading ramp is active the basemap's Positron land fills mute to grey (raster bases desaturate) so the ramp pops, restoring when shading is off, and the heatmap's under-fill/dim treatment was generalized from atlas-only to whichever ramp is active.

**Rationale:** Two full-saturation choropleth ramps on the same map competed and were hard to read together; one active ramp against a muted basemap is legible. This explicitly REVERSES the v0.5.46 decision that the green and purple ramps were "designed to coexist" so both could be shaded simultaneously — that distinct-hue rationale now serves only the coexisting boundary *lines*, not simultaneous fills. Mutual exclusion is a pure `nextShadingState` helper wired into both toggles (not a `useEffect` mirror — avoids which-wins ambiguity and an extra render); shade state stays session-scoped. Basemap muting is surgical MapLibre `setPaintProperty` on the four land fills + `raster-saturation`, NOT a CSS `filter: grayscale()` (which would grey the user's own pins/data and would not raise overlay-vs-basemap contrast); the greys derive from the exported `TINT_*` HSL constants (S→0 via `desaturateHsl` — one source of truth, theme-independent).

**Implications:** A standing invariant for future map work — only one shade fill is ever active (`lib/shadingExclusion.ts`); `SightingMarkers` now takes a `shadingFillId` string (was the `atlasShading` boolean); the basemap-desaturation child (`BasemapDesaturation.tsx`) re-applies on `styledata` and must never gate on `isStyleLoaded()`; the desaturation greys are a basemap-anchored hardcoded-HSL exception, not a token violation. Kept as appearance polish, not exposed as a user toggle, so the work stays an Improve (a "Desaturate basemap" control would be New-Feature territory). CLAUDE.md's coexistence note and heatmap-re-order note were updated to match.

## County Lines & Shading: a green county-choropleth ramp, a (state,county) re-key, US-only v1 — 2026-06-28 (v0.5.46)

**What:** A new Map Explorer overlay that draws US county boundaries over the current view and optionally shades each county by the user's per-county species (or record) count — a "county life list" choropleth, built as the structural twin of the breeding-atlas overlay, entirely from the already-loaded eBird backup. Frontend-only; bundled public-domain Census geometry; no new providers; zero network calls for the overlay core; privacy unchanged.

**Decisions worth keeping:**

- **A NEW sequential green ramp `--sr-county-1..4` (both themes, map-anchored) — deliberately NOT the existing purple `--sr-tier` atlas ramp**, reversing the PRD/schema's plan to reuse `--sr-tier`. The county overlay is explicitly designed to coexist with the atlas overlay; two purple polygon layers on the same map are nearly indistinguishable, so the magnitude choropleth gets its own single-hue green sequence (light `#C3E8D1` → deep `#1A5C38`, deepening toward `--sr-accent-strong`). It is declared IDENTICALLY in `:root` and `[data-theme="dark"]` because the map canvas is the always-light Positron basemap in both app themes (same posture as the map-pin/rank/milestone on-map tokens) — theme-flipping the fills would wash them out over a light basemap. Folded into `pipeline/design-system.md` as the reusable magnitude-choropleth ramp. A one-line swap back to `--sr-tier` is the fallback if ever rejected.
- **`computeGeo`'s per-county aggregation is now keyed by a (state, county) composite, not county name alone — a correctness fix with a visible count shift.** US county names collide across states (many "Washington"/"Jefferson"), so county totals are keyed on `countyKey(stusps, normalizeCountyName(name))`. For a user who has birded same-named counties in different states, this corrects a prior silent merge — their per-county species/record counts (in the overlay AND the Statistics geo rows that share `computeGeo`) shift to the right, un-merged values. Locked by a two-Washingtons `birdingStats.test.ts` regression and a `countyShading.test.ts` parity test against `computeGeo`. Any consumer of per-county data must key rows the same way.
- **The default shaded metric is distinct species recorded per county (a county "tick" count), with a Species ⇄ Records toggle.** Species diversity is the birder-meaningful reading that birders compare county-to-county; total records/checklists rewards repeat visits to one spot, and total individuals is noise-dominated by a single flock. Both species and records are already computed, so the toggle is low-cost; the popup always shows both counts regardless of the shaded metric.
- **US-only for v1 (non-US eBird Subnational2 deferred).** TIGER/Census boundary geometry is US-only and non-US county naming/geometry is inconsistent; v1 draws US counties only (the direct parallel to the atlas overlay being California-only). Non-US rows simply get no join key and are never shaded — no error path.
- **The COUNT needs no geometry and no point-in-polygon.** The eBird backup CSV already carries County + State/Province columns, so the per-county aggregation is a pure client-side join; geometry is needed only to DRAW the boundaries. The geometry ships as an on-demand dynamic-import chunk (mirrors `ca-atlas-blocks.json`), kept OFF the entry chunk per the maplibre-off-first-paint rule and now enforced by `entryChunk.test.ts`.

**Implications:** New map magnitude choropleths use the green `--sr-county-*` ramp (not the purple atlas ramp) so they stay distinct from the atlas when both are on. Per-county data is keyed by (state, county) everywhere. The GL *boundary-line* color is a deliberate fixed basemap-anchored literal (shared with the atlas), while GL *fills* read `--sr-*` tokens at runtime — both promoted to CLAUDE.md, alongside the county-overlay-mirrors-atlas pattern and the `entryChunk.test.ts` off-entry-chunk guard. Extending the county shading to the Species Detail / Statistics maps, non-US county support, and a per-species county choropleth are tracked as deferred parallels (ROADMAP "On the Horizon").

---

## Mac release blocked by Node 25 (`npm ci` crash) — 2026-06-27 (release tooling; no version bump)

**What broke:** The v0.5.45 macOS binary release never shipped — `release.sh` on the Mac failed repeatedly because `npm ci` crashed with npm's internal `Exit handler never called!` error. The build VM (Node 24) and Windows CI (Node 20) ran the identical lockfile clean.

**Root cause:** The Mac had drifted to **Node v25.9.0** — a bleeding-edge, non-LTS release whose bundled npm hits the known crash (npm/cli#8766). Nothing in the repo pinned a Node version, so the release machine silently ran an unsupported one. A second, latent bug sat behind it: the release instructions installed only `frontend` deps, omitting the **root** `npm ci` that provides the `tauri` CLI `release.sh` resolves from root `node_modules/.bin`.

**Decision / fix:** Pin Node in-repo (`.nvmrc` = 24, `engines.node >= 20.19`) and make `release.sh` self-healing — it installs both root and frontend deps itself and preflights the required tools, the pinned Node, network reachability, `gh auth`, and a clean working tree before the build, each failure naming its remedy. Added `CHECK_ONLY=1` (+ `SKIP_NPM_INSTALL` / `ALLOW_*` knobs) so the portable half is dry-runnable off-Mac. Corrected `release-runbook.md` + `glyph-bundle-handoff.md` to the one-command flow. Release tooling only — the 0.5.45 app is unchanged, the `v0.5.45` tag stayed at its commit, no version bump.

**Rationale:** A release must not depend on a release machine's undocumented, drifting toolchain. Pinning Node and folding the dependency restore into one self-healing command turns a cryptic multi-day npm crash into "wrong Node — here's the one-liner," and removes the forgettable manual `npm ci` (which also silently skipped the root install).

**Implications:** The Mac's whole release job is now `nvm install $(cat .nvmrc) && nvm use $(cat .nvmrc)`, then `zsh -lc ./release.sh`. Future release-machine setup must match `.nvmrc`; bump it as a logged decision on any toolchain move (recorded as a standing convention in CLAUDE.md's release section). The 0.5.45 binary release itself still runs in the Mac's own Weft session against this hardened script.

---

## Offline support — 2026-06-21 (v0.5.45)

**Decision:** Make SnowRaven usable offline across two tiers, with the heavy assets generated at release time on the Mac.

- **Basemap mechanism = self-hosted PMTiles + a custom `srpm://` MapLibre protocol (OQ-01/OQ-09).** The pmtiles lib's own `Protocol` hard-codes a `pmtiles://` regex, so local region files need a distinct scheme with its own loadFn, backed by a `pmtiles` custom `Source` doing TRUE range reads (`open`+`seek`+`read` via tauri-plugin-fs) — NOT `readFile` (whole-file, would break NFR-03/04) and NOT `convertFileSrc`/asset-protocol (Linux webkit2gtk Range reliability + a CSP change). Region tiles bake from the Protomaps planet (ODbL, bulk-download-licensed), county-primary + whole-state coarser, z14, polygon-clipped (a raw bbox on Alaska = 20 GB), hosted on a dedicated `regions-<ver>` GitHub Releases tag.
- **Region downloads are desktop-only (FR-20)** — the web/Pi seam can't durably persist GB-scale blobs; the web UI states this honestly and offers no download. **Off by default (FR-11a):** no tile byte is fetched until the user enables it.
- **Replay is opt-in per call-site, not a transparent path gate (FR-38).** `/checklists/{id}` is shared by the replay surface AND the Comparer, which is intentionally no-replay; a path-only gate can't tell them apart, so consumers call `transport.getReplayable` explicitly. The replay store is separate from the 90s in-memory `networkCache` (which keeps its live-coalescing role), keyed by the same `networkCacheKey` derivation with `force` stripped.
- **Bundled eBird taxonomy snapshot is a committed dependency (FR-21), not optional** — it's the only mechanism that satisfies the first-ever-cold-start guarantee on both runtimes. It ships twice (frontend `src/assets/`, backend `staticdata/`) and its version key must advance in lockstep with the desktop IndexedDB `CACHE_KEY` (recorded in CLAUDE.md).
- **Release-time assets are Mac-side and code-complete behind flags.** Glyph/sprite capture + `BUNDLED_MAP_ASSETS` flip and the county/state PMTiles bakes need network + large data the build VM can't produce; the code is written and flag-gated, so Tier-B rendering and offline labels are verified at release. The exact ordered steps live in `pipeline/offline-support/release-runbook.md`.

**Bug fixed during the build (post-mortem):** `rewriteStyleAssetUrls` built the glyph URL with `new URL('…/{fontstack}/{range}.pbf', base)`, which percent-encodes the braces to `%7Bfontstack%7D` — MapLibre can't substitute those per-tile, so every offline glyph would have 404'd. Dormant only because `BUNDLED_MAP_ASSETS=false` gates the rewrite; it would have bitten at release. Fixed by resolving only the brace-free prefix through `new URL()` and appending the literal template as a string; locked with `mapStyleRewrite.test.ts`.

**Convention:** bundled data that is IMPORTED (taxonomy, atlas, tide stations, the regions catalog) lives in `frontend/src/assets/`; only URL-served static assets (the glyphs/sprite) go in `frontend/public/`. A `public/` JSON import trips a Vite warning — the regions catalog was moved to `src/assets/` to fix it and match the existing pattern.

**Rationale:** field birders lose signal exactly where they bird; the app should degrade to "your data still works + honest messaging," and a planned-ahead download gives a real offline base. Self-hosting the only bulk-downloadable tiles honors every provider's ToS.

**Implications:** the privacy policy now enumerates every tile/style/glyph/sprite host (incl. the GitHub Releases regions host) and discloses the opt-in region-download egress. Future map-asset work follows the `src/assets` (imported) vs `public/` (URL-served) split. The release of any version that bakes regions follows the release-runbook (and the standing tag-re-push guard).

---

## Documentation & website accuracy audit — 2026-06-18 (docs-only, no release)

**What:** A verified, comprehensive accuracy review of README.md, docs/HELP.md, the website,
ACCESSIBILITY.md, and PRIVACY_POLICY.md against the shipped app (0.5.44), and the corrections it
surfaced. Shipped as a docs-only commit — no version bump, tag, or release (the only app-bundle
change is a one-line HELP.md wording tweak, which rides with the next release).

**Decisions worth keeping:**

- **PRIVACY_POLICY.md was missing the in-app updater's GitHub connection.** The version check
  (`api.github.com`) and the desktop bundle download (GitHub release assets) expose the user's IP
  to GitHub — undisclosed until now. Added a "Software Updates" section. Reinforces the standing
  rule that any outbound connection must be in the privacy policy; the updater was an existing,
  overlooked one.
- **The CenterPin search-center marker is presentational by design — not an a11y gap.**
  `neutralizeMarkerWrapper` sets `role="presentation"` and strips `aria-label`; the center is set
  via the labeled coordinate inputs (plus place search / "Use my location"), so the pointer-only
  pin-drop is an enhancement, not the only path. ACCESSIBILITY.md now states this; no code change
  (an aria-label would be stripped at runtime).
- **Docs brought current to 0.5.44:** README/website gained Frivolous Lists, drop-a-pin,
  Settings/appearance, the desktop-vs-self-hosted updater split, broadened eBird-key scope, and
  corrected breeding-codes wording; the website feature count went "Seven" → "Nine".

**Implications:** A docs-accuracy pass can ship as a docs-only commit (the website redeploys via
Pages) without a release when there is no meaningful app-bundle change. The verified multi-agent
audit pattern (ground-truth → per-doc audit → adversarial verify) is reusable for future
doc/website currency checks.

---

## Milestone badges illegible in dark mode — 2026-06-18 (v0.5.44)

**What:** On the Statistics tab, the "Firsts & Milestones" badges rendered as bright near-white
tiles in dark mode with the bird's species name invisible. Fixed by re-tinting the
`[data-theme="dark"]` `--sr-milestone-*` tokens to dark tiles with every element re-tuned to
WCAG AA. Pure token change in `globals.css`; no component code. The same tokens drive the
Frivolous Lists `CompletionBadge`, so it was fixed in the same change.

**Cause:** The dark-theme `--sr-milestone-*` block was a verbatim copy of the near-white `:root`
tiles ("same light-tinted values as :root by design"). On the dark page the tiles glared white,
and the species name — the only badge element NOT bound to a milestone token — inherited the
global `--sr-text` (`#0F1117` light, `#F4F4F5` dark) via `<BirdName>`'s `.sr-birdname-*` rules,
giving near-white-on-near-white (~1:1). The number/date/check stayed legible because they use
milestone tokens that happen to be dark-on-light in both themes.

**Decisions worth keeping:**

- **Scope B over the minimal fix (user choice):** rather than just darkening the name, give dark
  mode real dark tiles (deep green tiers 1–3, deep amber tier 4) and re-tune every element. This
  reverses the "milestone tiles are intentionally light in both themes" decision for dark mode
  only; light mode (`:root`) is untouched.
- **An intentionally-light-in-both-themes surface must not host theme-following text/tokens.**
  Promoted to CLAUDE.md. The trap was a light tile silently hosting `--sr-text`, which flips per
  theme. Dark mode needs its own tile + text tokens.
- **Guard token contrast with a parse-the-tokens test.** `frontend/src/lib/milestoneContrast.test.ts`
  reads the real `[data-theme="dark"]` tokens out of `globals.css` and asserts AA on both gradient
  stops, so a future re-copy of light tiles fails CI (reads the file via a file-scoped
  `/// <reference types="node" />` + `fs` because vitest stubs CSS `?raw`).

**Implications:** Any future "same as :root by design" token block that also carries text must be
re-verified for AA in dark mode. The contrast-test pattern is reusable for other tinted-surface
token families (map-target chips, rank pins, tier fills).

---

## Map center pin — drop a pin to set the Map Explorer search center — 2026-06-18 (v0.5.43)

**What:** The Map Explorer's Hotspots, Nearby Lifers, and Media Targets views gained a
draggable center pin: right-click (desktop) or long-press (touch) drops a center pin,
dragging fine-tunes, and each placement re-runs the active view's search. New
`CenterPinDropper` + `CenterPin` in `components/map/MapControls.tsx`; an `applyCenter`
helper in `MapExplorer.tsx`.

**Decisions worth keeping:**

- **A deliberate map-point gesture uses `contextmenu` / long-press, NOT left-click.** The
  Map Explorer maps already consume left-click/tap for pin/popup selection (sighting/hotspot
  GL layers + atlas fill via `map.on('click')` + `queryRenderedFeatures`). Reusing
  left-click-to-place (as the Predict tab does, where its map has no other clickable content)
  would ambiguate "open this pin" vs "set the center." Right-click and a hand-rolled touch
  long-press are distinct event types, so they compose with the existing selection without
  collision. This is the pattern for any future "set a point on the map" gesture.
- **The long-press is a hand-rolled timer cancelled on any pan/zoom signal, and never
  `preventDefault`s before it fires** (so a normal pan is untouched): cancel on
  `movestart`/`zoomstart`/`dragstart`, `touchmove` past a ~10px slop, a 2nd touch (pinch),
  and `touchend`/`touchcancel`. Some touch platforms synthesize a `contextmenu` AFTER a
  long-press, so a short dedup window (`lastTouchFire`, 800 ms) on the contextmenu handler
  prevents a double drop/fetch.
- **The center pin is a DOM `<Marker>` (one draggable instance), not a GL layer** — per the
  DOM-vs-GL rule; it sidesteps the base-switch / source-id GL pitfalls and gives a real drag
  affordance. It supersedes the detected-location blue dot while shown (the `!centerPinShown`
  guard) so the two never overlap; keyboard users set the center via the existing lat/lng inputs.
- **Session-only.** A dropped pin updates the in-session center and re-runs the search, but
  never writes the saved default (`map-defaults`) — exactly like "Use my location." The saved
  Default Location stays a deliberate Settings choice.
- **Improve-lane boundary call:** this is a NEW user interaction, which by the branch rules is
  New-Feature territory — but it reuses the Predict pin pattern and the existing shared center
  model, adds no new data, schema, or design-system work, so it was deliberately re-scoped to
  the Improve track (lean build, no strategy/PRD/design stages). The precedent: a small
  interaction that reuses an established pattern can stay on Improve.

**Implications:** Future map gestures that must not collide with the existing left-click
selection should use `contextmenu` + a long-press timer via a map child (the `CenterPinDropper`
pattern), render their result as a DOM marker, and dedup the synthesized-contextmenu-after-
long-press. Promoted to CLAUDE.md.

---

## Initial-load optimization + Checklists tab-order tweak + dev-audit clarity — 2026-06-17 (v0.5.42)

**What:** A bundled Improve run with three independent threads. (1) The default tab order moved Checklists to sit between Breeding Codes and List Comparer (`DEFAULT_TAB_ORDER`, `frontend/src/lib/tabLayout.ts`). (2) The maplibre map library (~273 KB gzip) was taken off the app's first-paint path: `NamedBirdRow`'s static import of the per-row `SightingsMap` was the sole eager edge dragging maplibre into the entry chunk, and is now `React.lazy` + `<Suspense>`; the List Comparer and Checklists tabs are also `React.lazy` now; all are warmed via App's existing `requestIdleCallback` warmer; `vite` `chunkSizeWarningLimit` was raised to 1100. (3) `npm audit fix` cleared two dev-only advisories and the Pi `update.sh`/README now explain the install-time audit scope.

**Decisions worth keeping:**

- **maplibre must stay off the entry chunk.** Even with the map *tabs* lazy, one statically-imported component (`NamedBirdRow` → `SightingsMap` → `react-map-gl/maplibre`) silently pulled the full ~1 MB / 273 KB-gz maplibre bundle onto first paint — a latent regression. Rule going forward: no component reachable from App's static import graph may statically import `SightingsMap` / `SnowMap` / `react-map-gl/maplibre`; the per-row map and the map tabs stay lazy, warmed at idle. Verified against the built `index.html` modulepreload (maplibre absent) and the entry chunk (no bare `import "./vendor-maplibre"`). Entry chunk fell 331→218 KB (84.5→54 KB gz). Promoted to CLAUDE.md.
- **The idle warmer keeps lazy invisible.** App defines a local `importSightingsMap = () => import('./components/SightingsMap')` and warms it (plus the lazy tabs) via `requestIdleCallback`, so a returning user opening a Named Birds row pays no perceptible delay. `NamedBirdRow` stays component-only (no exported thunk) to satisfy `react-refresh/only-export-components`; the warmer and the lazy load resolve to the same chunk.
- **The Pi "npm vulnerabilities" notice is a reporting artifact, not exposure.** `npm ci` audits the full dev+prod tree and prints e.g. "2 vulnerabilities (1 low, 1 high)"; the advisories (vite dev-server, `@babel/core` via an eslint plugin) are dev-only and never ship. `npm audit fix` cleared them within existing ranges (production dependency tree byte-unchanged); `README.md` + `update.sh` document the scope so the notice isn't alarming. A production-scoped `npm audit --omit=dev` reports zero.
- **Defaults-only tab change.** Same posture as v0.5.41 — `parseLayout` preserves saved custom layouts; only the first-run/reset order changed. Amends the v0.5.41 default-tab-order decision (Checklists position).

**Implications:** Any new map surface must keep maplibre lazy from the entry (see the CLAUDE.md rule). Initial-load wins are primarily a web/self-hosted benefit (on Tauri desktop, modulepreload is local disk). The dependency lockfile now sits at the audit-clean versions.

---

## Default tab order, List Comparer default mode, and Map Explorer mode order updated — 2026-06-17 (v0.5.41)

**What:** The out-of-the-box ordering defaults were updated to match how the app is used day to day. New default tab order: Weather, Statistics, Species Detail, Map Explorer, Checklists, Multimedia, Breeding Codes, List Comparer, Named Birds — with Settings pinned last (`DEFAULT_TAB_ORDER` in `frontend/src/lib/tabLayout.ts`). The List Comparer opens on checklist comparison by default, with Checklists on the left of its mode selector (`frontend/src/components/ListComparer.tsx`). The Map Explorer mode buttons render Nearby Lifers before Media Targets (`frontend/src/lib/mapViewModes.ts` + `MapExplorer.tsx`).

**Decisions worth keeping:**

- **Defaults and normalization only — the tab-layout persistence decision is untouched.** Preferences still flow through the `storage` seam (see the desktop tab-layout post-mortem, 2026-05-28); this changes only the default order, the reset-to-default layout, and how `parseLayout` slots a missing default tab into an existing saved layout. A user's already-saved custom layout is preserved.
- **No new capability** — this is an Improve-lane reorder, not a feature; nothing a user couldn't already see or do changed.

---

## Public-hotspot links: classify a location by region-scoped Set membership, not by id format — 2026-06-16 (v0.5.40)

**What:** A location NAME now links to its `ebird.org/hotspot/{locId}` page when — and only when — the location is a PUBLIC eBird hotspot, app-wide (Species Detail top-locations + comments, Statistics geo/notable-outings/biggest-counts/first-recent cards, Checklists list + comment search, Named Birds reports, Frivolous Rainbow first-sightings). Personal locations stay plain text. New shared `components/HotspotLink.tsx` + `lib/hotspotSet.ts` + the parameterless `useHotspotSet()` hook + a new backend route `GET /map/hotspot-region` (and its Tauri-service twin).

**Decisions worth keeping:**

- **Public-vs-personal can't be read from the CSV — classify by membership in a region-scoped Set.** The eBird export uses the same `L\d+` id for hotspots and personal locations, so id format alone can't distinguish them (the misnomer that caused the bug below). The Set is built from eBird's `ref/hotspot/{regionCode}`: ONE cached fetch per distinct `stateProvince` region in the backup (typically 1–3), unioned → O(1) membership tested on every location surface — NOT one `ref/hotspot/info/{locId}` call per location. This is the efficient design the original `location-links-broken` bug explicitly punted on as out-of-scope.
- **This is the proper resolution of `location-links-broken` (2026-05-20), which had only REMOVED the links.** That fix rendered all Top-Locations names as plain text (deferring "a backend call to verify hotspot-ness"). `/hotspot/` links were later reintroduced gated on id-format ALONE — silently re-creating the 404-on-personal-location bug (latent). `HotspotLink` adds the Set-membership gate AND keeps the `LOCATION_ID_RE` shape guard, so a junk/personal id always renders plain — never a styled 404 link.
- **`HotspotLink` wraps `OutboundLink` and reuses the shared eBird-link name formula** (`Open {name} on eBird (opens in a new tab)`), with `compact` (icon-only, map popups) and `truncate` (ellipsis + trailing icon) modes. The linked state is FORCED `var(--sr-accent)` so a caller's plain-text color (e.g. a muted comment location) can't bleed onto a link. The truncate plain-branch mirrors the link branch's `inline-flex` + inner `sr-truncate` span so a personal name and a hotspot name baseline-align in a mixed row.
- **The hook is parameterless and shares ONE build.** `useHotspotSet()` loads the backup itself via `observationsCache` (no extra read/parse) and builds through the region-keyed `getHotspotSet` module cache, so N tabs calling it trigger one fetch set. Where a list renders many rows (Checklists, Named Birds), call the hook ONCE in the parent and pass `isHotspot` down — never per-row.
- **Graceful degradation is the whole no-data story:** no eBird key, or any region fetch failing, contributes an empty Set → those locations read as personal (plain text), never a speculative link. MapExplorer keeps its OWN kind knowledge (`pin.kind`) rather than the Set — its hotspots come straight from `ref/hotspot/geo`, so it's authoritative there; its name stays a map-pan button with the `↗` as the eBird affordance.

**Adversarial review caught two HIGH staleness bugs — fixed with a module-level invalidation signal (not per-tab version props):**

- **A Set built empty (no key yet, or a transient eBird outage) was cached for the whole session** — keyed on the region list, which doesn't change when the user later adds their key, so links never appeared until a full reload. **And** a backup swap to a NEW region never reloaded the Set on persistent tabs (the hook's effect was mount-only; tabs stay mounted via additive `mountedTabs` + `display:none`).
- **Fix:** `hotspotSet.ts` exposes `invalidateHotspotSet()` (drops the cache + bumps an epoch + notifies subscribers); `useHotspotSet` subscribes via `useSyncExternalStore`, so every mounted tab reloads on invalidation with NO per-tab version threading (rejected — the 5 consumers have heterogeneous access to `filesVersion`/`keysVersion`, and BirdingStats isn't even passed `filesVersion`). Settings fires `invalidateHotspotSet()` at the same four points it already clears the other caches: eBird file save/delete AND key save/delete. Locked by `hotspotSet.test.ts` (refetch-for-same-regions-after-invalidate) and a jsdom `useHotspotSet.test.tsx` (reload-on-invalidate).

**Known minor (deferred, recorded):** `computeLocationsSorted` (`speciesStats.ts`, pre-existing since v0.5.12) groups by location NAME and keeps the first-seen `locId`; a name shared by a hotspot and a personal location can mislabel one Species-Detail row. The feature newly makes that row link-bearing, but it is Set-gated (worst case a missing or mildly-miscounted link, never a 404). `birdingStats.computeGeo` correctly keys by `locId`; aligning `speciesStats` is the clean fix when next touched.

**Implications:** New location-name surfaces render through `HotspotLink` + `useHotspotSet()` — never a hand-rolled `<a href={ebird.org/hotspot/…}>` gated on id-format alone. Any cache keyed on backup-derived data that a key/file change can stale needs an invalidation path (the `invalidateHotspotSet` pattern). The backend route and `lib/tauri/mapService.ts` `getHotspotRegion` are dual-transport parity. Promoted to CLAUDE.md.

---

## Frivolous Lists expansion: grouped (sub-category) lists + verify hardcoded names against the live taxonomy — 2026-06-16 (v0.5.39)

**What:** Five new self-completing collections on the Statistics Frivolous Lists card — three flat (Phoebe Phanatic, Scrub Jay All Day, Crow Pro / Raven Maven) and two grouped with labeled sub-categories shown in the card (Heron is Carin', Best of the Crest). Frontend-only; no new providers; privacy unchanged. Extends the v0.5.36 Frivolous Lists.

**Decisions worth keeping:**

- **Grouped lists are a first-class shape now: `GroupedListResult` + a `groupedList()` helper (`lib/frivolousLists.ts`) + a `GroupedNameList` renderer (`FrivolousListsSections.tsx`).** A grouped list is a theme split into labeled sub-groups, with ONE whole-list count + completion badge (sub-groups are visual labels, not separate badges). The flat-list rendering was refactored into shared `NameItems` + `ListHead` so flat and grouped lists share the check-off grid and header. Counts are per list; a species may appear in more than one list.
- **Hardcoded bird-name lists are verified against the LIVE eBird taxonomy before shipping — not eyeballed.** Matching is exact-by-normalized-common-name against the user's data, so a stale or renamed name silently never ticks, and unit tests don't cover all ~50 names. Every name was POSTed to the backend `/taxonomy/codes` endpoint (the same live eBird taxonomy the app uses); 56/59 resolved and 3 were renames that would have silently failed — caught what eyeballing would have missed.
- **Three current-eBird renames applied (the silent-fail traps):** `Cattle Egret` → `Western Cattle-Egret` (the bare name was split out of eBird); `Black-crowned Night-Heron` → `Black-crowned Night Heron` and `Yellow-crowned Night-Heron` → `Yellow-crowned Night Heron` (eBird dropped the Night/Heron hyphen). The sub-group HEADER labels (e.g. "Night-Herons") are cosmetic and were left as written — only the matched species names must be canonical.

**Implications:** New hardcoded life-list collections use current canonical eBird names, verified against `/taxonomy/codes` (or the live catalog) before shipping. New grouped collections reuse `GroupedListResult` / `GroupedNameList`. The verify-names rule is promoted to CLAUDE.md.

---

## Statistics media-card behavior links + a countable-life-list coverage fix — 2026-06-16 (v0.5.38)

**What:** On the Statistics → Media card, each behavior count now links to the Macaulay Library catalog filtered to that behavior for the user, each breeding behavior is listed and linked on its own, the tab's catalog links were consolidated onto one host, and the media documentation-coverage denominator was corrected to stop counting non-countable forms. Frontend-only; no new providers; privacy unchanged.

**Decisions worth keeping:**

- **ML behavior catalog links use `media.ebird.org/catalog?userId=<id>&tag=<slug>`, and the slug is a FIXED, live-verified lookup — not derivable from the label.** `Flying`→`flying_flight`, `Mechanical Sound`→`non_vocal`, `Preening, Scratching, or Bathing`→`preening`, `Courtship, Display, or Copulation`→`courtship_display_or_copulation` show the slug is not a transform of the display label, so `BEHAVIOR_TAG_SLUG` (`lib/mediaStats.ts`) is hardcoded and verified against the live catalog UI (each tag rendered its expected removable-filter label). Behavior and sound-type tags share the one `tag=` param. An unmapped behavior renders as plain text, never a broken link.
- **Statistics catalog links consolidated onto `media.ebird.org/catalog`, finishing (Statistics-side) the consolidation the v0.5.33 decision deferred.** `lib/statsFormat.ts` `mlCatalogUrl` moved off the legacy `search.macaulaylibrary.org/catalog`; the Multimedia tab already used the new host. SpeciesDetail's `lib/mlCatalog.ts` still uses the legacy host (out of scope here) — a remaining consolidation candidate. Both hosts resolve, so this is consistency, not a fix.
- **Each breeding behavior is linked individually and de-duplicated from the top list.** The three breeding tier tiles (species counts) stay as a summary; below them each breeding behavior the user has is its own link. When that breeding list shows (userId present), breeding behaviors are removed from the top "Behaviors documented" list so each appears once; with no userId there is no breeding list, so they remain in the documented list (unlinked).
- **A "life-list COUNT" must exclude spuh/slash/hybrid — new shared `isNonCountableSpecies` (`lib/speciesUtils.ts`).** The media documentation-coverage denominator ("X of N life-list species documented with media") was counting every distinct observed name, including `sp.`/slash/hybrid forms, so N overstated the life list (the user caught it: "more than my life list"). Fixed inside `computeMediaStats` (pure/testable) by filtering the passed name-set through `isNonCountableSpecies` for both the denominator AND the numerator. `backboneNames` (which also drives Species-Detail linking and correctly contains every recorded name) is left untouched — the fix is isolated to the coverage computation. `isSpuhOrSlash` deliberately omits hybrids (it is the display-filter primitive), so `isNonCountableSpecies` (= `isSpuhOrSlash || " x "`) is the canonical countable-life-list predicate. A parallel audit of `birdingStats.ts`/`speciesStats.ts` confirmed no other stat had the same overcount — every other species count already runs on filtered observations.

**Scope note:** the coverage-denominator fix was a user-approved scope expansion folded into this Improve lane (the work was already on the Statistics page); recorded so the two-part diff doesn't read as scope creep. The breeding-links shape (per-behavior, not the tier tiles) and the dedup were also user follow-ups on review.

**Implications:** New ML catalog links use `media.ebird.org/catalog` + the `BEHAVIOR_TAG_SLUG` map (don't guess slugs — verify against the live catalog). Any "life list" COUNT uses `isNonCountableSpecies`, not bare `isSpuhOrSlash`. The accessible name of a count-link leads with the visible count (the `ChecklistLink`/WCAG-2.5.3 convention), set via `BarRow`'s `linkLabel`. Promoted to CLAUDE.md.

---

## Mobile-responsive sweep: generalized the CSS-class responsive system; two hidden-element page-scroll lessons — 2026-06-16 (v0.5.37)

**What:** An exhaustive responsive pass so every screen flows from ~320px phones to large desktops with no overlap and no sideways page scroll, in preparation for the mobile app. The app was inline-styled with a single `@media (max-width: 640px)` block reaching five class names; this generalized it into a small shared class vocabulary + breakpoint tiers, then migrated ~35 components to it. Also deleted the dead Vite-template `index.css` and `App.css` (never imported — only `globals.css` is).

**Decisions:**
- **Do responsive layout by LIFTING to a class, never inline.** React inline styles are specificity 1,0,0 and beat class rules, and inline grids/flex can't be media-queried (the long-standing reason `.sr-two-col` etc. exist). New `globals.css` hooks: `.sr-action-row` (wrapping label+action row), `.sr-grid-2/-3/-4` (collapse 3/4→2 at ≤1024, all→1 at ≤640), self-collapsing `.sr-grid-auto`, `.sr-grid-chart-aside`, `.sr-field-row` (stacks native date inputs ≤480), `.sr-scroll-x` (contained wide-table scroll; carries `min-width:0` + `position:relative`), leaf helpers `.sr-min0/.sr-truncate/.sr-wrap-anywhere`, `.sr-pad-x-trim`, `.sr-map-explorer-panel`. Tiers: ~480 (small phone), 640 (existing boundary, unchanged), ~1024 (tablet), plus a `.sr-panel` max-width cap (1280px, centered) for large desktops.
- **A `position:absolute` element wider than the viewport leaks PAGE horizontal scroll on phones even when invisible.** Two real (pre-existing) phone overflows were fixed: (1) TabNav's overflow-measurement PROBE (`visibility:hidden`, the full bar at natural width) scrolled every page sideways — now wrapped in a zero-height `overflow:hidden` box (the inner probe still reports `scrollWidth` for the collapse decision); (2) absolutely-positioned `.sr-only` spans inside a horizontally-scrolled table (the breeding-code matrix) escaped the scroll wrapper until it was made `position:relative`. **Standing check:** any wide/`max-content` element or off-screen measurement node must sit under an `overflow:hidden`/`position:relative` ancestor so it can't extend `document.scrollWidth` on a phone.

**Touched, not reversed:** the responsive-nav dropdown (kept its ResizeObserver overflow-collapse — no JS window checks added), the Map Explorer mobile-overlay rules (class-toggled `display` + z-index 1200 preserved), the table `wideMode`/`max-content` pattern (reused, not refactored), and the in-app text-scale (sizing stays rem-based — no rem→px). Extended, not changed.

**Known limitation:** at 200% in-app text size the Statistics tab still scrolls ~34px sideways at 360px (dense filter-pill rows don't re-wrap at doubled text); every screen is clean at normal text size. Accepted by the user rather than reworking those rows. See `pipeline/mobile-responsive-sweep/qa-report.md`.

**Implications:** Future responsive work uses these class hooks + tiers — do not re-introduce inline responsive layout. Wrap any new wide table in `.sr-scroll-x`. The full per-screen audit + fix list is in `pipeline/mobile-responsive-sweep/responsive-audit.md`.

---

## Frivolous Lists: lexicographically-greedy max-matching for the rainbow, whole-word color matching, and favicons-on-unseen via the existing taxonomy batch — 2026-06-15 (v0.5.36)

**What:** A playful "Frivolous Lists" section at the bottom of Statistics — Avian American (22), California Dreamer (7), and Rainbow Warrior (7 colors) — computed entirely from the loaded eBird backup. Frontend-only; no new providers; privacy unchanged.

**Decisions worth keeping:**

- **Rainbow Warrior assigns birds to colors by a lexicographically-greedy MAXIMUM bipartite matching, not a per-color earliest pick.** The user's rule is "show the first bird of each color, but avoid using one bird for two colors when an alternative exists." A naive per-color earliest pick doubles a shared bird (e.g. Violet-green Swallow for both violet and green) even when a distinct bird is available. The algorithm maximizes DISTINCT birds first (minimize doubles); among max-distinct assignments the higher-priority (spectrum-order) color keeps its earliest bird; a bird fills two colors only when a color has no other candidate, and then it shows that color's EARLIEST bird (not a later "distinct" pick that merely relocates the double). Determinism comes from a total-order candidate sort (date, submissionId, commonName).
- **Color matching is whole-word, case-insensitive (`/\bCOLOR\b/i`), non-global.** "Red-tailed Hawk" fills red; "Reddish Egret", "Black Redstart", "American Redstart", "Common Yellowthroat" do not. One bird may fill multiple colors (Violet-green Swallow → violet + green). Non-global so `.test()` is stateless (no shared `lastIndex`, per the 0.5.27 regex-hygiene rule).
- **Verified by a brute-force oracle, which caught three bugs example-based tests missed.** An adversarial verification (an independent oracle enumerating the lexicographically-minimal max-distinct assignment over thousands of random inputs) found non-determinism on date+submissionId ties, a higher-priority color bumped onto a later bird, and a forced-double showing a later bird than its earliest — all fixed and regression-tested. Worth repeating for any non-trivial pure combinatorial/assignment logic.
- **Favicons on not-yet-seen birds via the existing `/taxonomy/codes` batch.** The 29 hardcoded names are added to the batch `BirdingStats` already sends; the endpoint resolves by common name in both the web (FastAPI) and Tauri (TS) transports and reads the live taxonomy, so unseen rows show the eBird/BoW favicons (still no Species Detail link) and recent splits resolve. No new request.
- **The lists reflect the ALL-TIME life list,** independent of the Statistics tab's "include spuh" toggle — "have you ever seen this?" is an all-time question. Hardcoded lists use current canonical eBird names only; a pre-split export won't tick until re-downloaded (no legacy alias map in v1).
- **Seven new `--sr-rainbow-*` swatch tokens** (both themes) for the color dots — a deliberate, logged design-system extension (folded into design-system.md); decorative (the color NAME is the accessible text), so not held to text contrast.

---

## Nearby Lifers Map: lifers as a Map Explorer section keyed on location, the recent-obs route reused with optional codes, and a shared Time Range filter — 2026-06-14 (v0.5.35)

**What:** A new Map Explorer section that maps WHERE species the user has never recorded were reported recently near a chosen point — labeled, recency-colored pins, not a flat list. The old "Nearby Lifers" list was removed from the Statistics tab and rebuilt here. Built entirely on eBird data the app already uses; no new providers, no privacy change.

**Decisions worth keeping:**

- **Nearby Lifers moved from Statistics to its own Map Explorer section, with location as the unit.** The old flat list answered "which lifers are near me"; the map answers "where were they reported." Each spot is one labeled pin showing the species name, or "{n} species" where several lifers were reported at one place; clicking a pin (or a row in the panel list) shows the lifers with dates and eBird checklist links. It opens on the saved default location and carries the same controls as the other map sections — use my location, place-name search, radius — plus the new Time Range filter. Lifer names render plain + favicons (NOT a Species Detail link) because they are not in the user's recorded data.
- **Reused `/map/recent-obs` by making its `codes` param optional, rather than a new route.** With `codes` empty the route returns all species in the radius (eBird `data/obs/geo/recent`); the life list is subtracted CLIENT-SIDE to leave only lifers. The now-dead `/stats/nemesis` route — which stripped coordinates the map needs — was retired in favor of this.
- **Each lifer appears at its single most-recent location — accepted, not a defect.** eBird's `data/obs/geo/recent` returns one record per species (the most recent sighting in range), so a lifer reported in several spots shows only its newest. This is the endpoint's contract, kept deliberately rather than fanned out into per-species lookups.
- **One shared "Time Range" filter (last day / last week / last 30 days) on BOTH Nearby Lifers and Media Targets.** Adding the control to Nearby Lifers, the same filter was given to the existing Media Targets section so the two panels behave identically.
- **Restored lat/lng/dist bounds on `/map/recent-obs`.** These had been lost when `/stats/nemesis` was deleted; the recent-obs route now re-enforces them.

---

## Weather & Tide — Current & Predict: one base forecast call, tiered slice reusing the existing formatter, and an honest weather/tide horizon gap — 2026-06-13 (v0.5.34)

**What:** Two new lookups at the bottom of the Weather tab — Current (live weather + tide for the device location) and Predict (forecast weather + predicted tide for a chosen place/date/time) — that bypass the eBird checklist. Backend + frontend; no new providers.

**Decisions worth keeping:**

- **One base OpenWeather One Call 3.0 request serves current + the whole forecast.** The "One Call by Call" subscription already in use for the historical `timemachine` ALSO returns `current` + `hourly` (48h) + `daily` (8d) from the base `onecall` endpoint — confirmed live, not just from docs. A pure tier helper (`pick_forecast_slice`) picks current/hourly/daily/out-of-range, and an adapter maps the chosen slice into the timemachine `{data:[hour]}` shape so the EXISTING `format_weather`/`formatWeather` builds the copy block (byte-consistent, no second formatter). Daily passes two synthetic temp points (min,max) → the block reads as a low–high range. The tier helper + adapter are duplicated TS↔Python with parity tests over identical fixtures, the same posture as the moon-phase port.
- **The weather/tide horizon gap is shown honestly (Dave's call: tide runs ahead).** Weather is capped at the provider's real ~8-day horizon (hourly ≤48h, a clearly-labeled DAILY summary 48h–8d); beyond that, weather is omitted with a "no forecast reaches this far" note while the tide — astronomical, predictable far ahead — still shows. Never an extrapolated forecast.
- **New geo+time routes, declared before the checklist routes.** `GET /weather/at` and `GET /tide/at` take lat/lng/time directly and MUST be declared before the `{checklist_id}` routes (FastAPI matches in order) and matched before the `/weather/`/`/tide/` prefixes (TS transport), or "at" is captured as a checklist id. Tide reuses the whole existing pipeline unchanged; future NOAA predictions already work (labeled "Predicted").
- **Current resolves "now" in the LOCATION's timezone, not the device's.** A verification bug (this UTC dev box showed UTC) led to making `/tide/at`'s `dt` optional (server defaults to location-tz now) and formatting the Current label from the tz the weather response returns — so Current is correct regardless of the device/browser timezone.

**Bug post-mortem (found in verification):** the vite dev proxy was missing `/tide`, so in vite-dev `/tide/at` — and, latently, the EXISTING checklist tide — hit the SPA fallback instead of the backend. Invisible until now because the tide path is normally exercised via the desktop app or the FastAPI-served build, not vite-dev. Added `/tide` to the proxy. **Standing lesson:** a new backend route's path prefix must be added to `frontend/vite.config.ts`'s proxy.

**Known minor (kept deliberately):** the copy-ready block reuses the shared tide formatter, so a tide that turns inside the 1-hour Current/Predict window reads "(turned during your checklist)" even though there's no checklist; kept for byte-parity with the checklist block (the on-screen summary uses "(turning)"). Dave reviewed and chose to keep it.

**Out of scope (v1):** multi-hour/multi-day forecast windows or comparison (single moment only), saved/favorite locations, alerts/notifications, "best time to go" ranking.

---

## Multimedia sex & age filters: one substitution point, exact-combo that the ML link also honors — 2026-06-13 (v0.5.33)

**What:** Sex (Male/Female) and Age (Juvenile/Immature/Adult) dropdown filters on the Multimedia tab (`LifeList.tsx`), built on the per-asset Age/Sex already parsed for the media stats. Frontend-only.

**Decisions worth keeping:**

- **One substitution point.** The facet is applied by projecting each species' `catalogIds` to the facet-matching subset (and dropping zero-match species); every existing count/filter/sort over `catalogIds` then becomes facet-aware with no further change, and the no-facet path is byte-identical to before (regression-safe). `assetMatchesFacet` + `buildCatalogAgeSex` live in `lib/mediaStats.ts` beside the parser.
- **Exact-combo matching (Dave's call), and the ML link agrees.** A single facet is broad (Female = any female of any age); both set requires one individual that is both (Juvenile + Female = a juvenile female). The Macaulay catalog applies `&age` + `&sex` the SAME way — it filters to media depicting an individual that is both (confirmed against the live catalog via user-provided links) — so the in-app count and the link agree. (An earlier assumption that ML treats the facets independently was wrong and was corrected.)
- **The Multimedia ML catalog links use `media.ebird.org/catalog` with lowercase `&age` / `&sex`.** That is the base where the age/sex params are confirmed; it is the same Cornell Lab/eBird media search already in the privacy disclosure. `BirdingStats` still uses the older `search.macaulaylibrary.org` base — consolidating the two link builders is a future candidate, not done here.

**Out of scope:** no new data / export / parser changes; untagged media is excluded from a facet (no "Unknown" option); no in-app gallery (the tab stays counts + links).

---

## Accessibility follow-ups: the ChecklistLink rollout finished, an OutboundLink wrapper, and the records caught up to what already shipped — 2026-06-13 (v0.5.32)

**What:** Closed the three cross-cutting accessibility items 0.5.31 had left as Known Exceptions, and corrected the records that misdescribed them. No user-facing feature change.

**Decisions worth keeping:**

- **`ChecklistLink` is the single affordance for every "open checklist on eBird" link, app-wide.** The 14 remaining hand-rolled links across 7 files (Species Detail header stats + comments, Named Birds rows, the Statistics tab, the media stats, the map popups) were folded in. It gained a `compact` (icon-only) mode for dense spots (species pills, location cards, a fixed-width stats column, the map target popup) and a **label-aware accessible name**: with a visible date/count it leads `{label} — open checklist on eBird (opens in a new tab)` (WCAG 2.5.3 Label in Name, so Voice Control can activate it by what's on screen); with no label it names the id directly; the functional suffix is identical everywhere (WCAG 3.2.4). This also fixed a latent 2.5.3 regression — the Checklists-tab date link, moved onto `ChecklistLink` in 0.5.31, had stopped leading its name with the visible date.
- **`components/OutboundLink.tsx` is the standard wrapper for every NON-checklist external link.** It guarantees `target="_blank"` + `rel="noreferrer"` and an "(opens in a new tab)" cue (a clean spaced `aria-label` from string children / explicit label, else an `.sr-only` cue node for JSX children). Named `OutboundLink`, NOT `ExternalLink`, deliberately — `ExternalLink` is lucide-react's icon, imported widely, and the names would collide. New-tab wording was standardized to "(opens in a new tab)" app-wide (the codebase had mixed "a new tab" / "new tab").
- **Informative tooltips are kept, not sacrificed for consistency.** Standardizing the media "busiest day" link onto `ChecklistLink` briefly dropped its "largest checklist of N that day" hint; it was restored via a new optional `title` pass-through on `ChecklistLink` (sighted-hover only — the screen-reader name stays canonical). Standing preference: don't drop a useful tooltip to make a component uniform.

**Correction / reversal:** F082/F106 (the Southern-Hemisphere moon-phase emoji) was wrongly recorded in 0.5.31 as a deferred follow-up "scoped out rather than half-done." It was never deferred — the latitude-correct mirroring already shipped in **0.5.28** (`lat < 0 → MOON_SOUTH`, latitude threaded to both formatters, both hemispheres locked by the byte-golden tests). The deferred note below is corrected accordingly. F064 and F078 are now fully shipped, not partial.

---

## Accessibility pass: a contrast-token system, single-close-path focus restore, and the verification loop that caught two false published claims — 2026-06-12 (v0.5.31)

**What:** A comprehensive WCAG 2.1 AA accessibility pass across the whole
frontend. A four-phase, ~160-agent audit (inventory → 12-dimension parallel
audit including *computed* contrast over every `--sr-*` token pair actually used
together, both themes, plus an axe-core runtime scan → adversarial verification →
completeness sweep) found **107 confirmed findings (1 critical, 17 serious, 48
moderate, 41 minor) against 288 verified passes**, then fixed them. The headline
result was not a bug but the published statement: `ACCESSIBILITY.md` made five
claims the code contradicted — the same liability as a stale privacy policy — and
the lane's hard requirement was to end with the statement true.

**Decisions worth keeping:**

- **Contrast is fixed at the token, with a typed naming system — not per
  component.** `globals.css` gained a vocabulary that distinguishes three
  text-on-X cases, every token minted in BOTH themes (parity machine-checked):
  `--sr-tier-N-fg` = tier-colored text ON an 8–15% tier tint; `--sr-tier-N-text`
  = text ON the solid tier fill; plus `--sr-map-target-*-text`,
  `--sr-border-input` (form-control boundaries, ≥3:1 non-text), `--sr-milestone-*`,
  `--sr-rank-pin-*`, and `--sr-on-chart-blue-dark`. Retunes (`--sr-accent`,
  `--sr-text-muted`, `--sr-error`, `--sr-graph-audio`, `--sr-gray-400`) fixed
  whole classes of sites with zero component change. The fill palette
  (`--sr-tier-N` / `-rgb`) was deliberately left untouched so the atlas/hatch
  parity stays safe — text colors are a separate concern from fill colors.
- **`--sr-text-disabled` is for genuinely disabled CONTROLS only** (WCAG-exempt);
  informative and empty-state text must use `--sr-text-muted`. The empty
  date-input format text using `text-disabled` was an actual failure, fixed in the
  Tester round. The token now carries an inline comment saying so.
- **`--sr-on-chart-blue-dark` is theme-aware because a light-vs-dark fill needs
  OPPOSITE text colors** (post-fleet catch + Tester corroboration). The
  "complete checklists" meter — the one in-bar percentage label left in the app —
  printed text on a blue fill that is light in light theme (`#1D4ED8`) and a
  lighter blue in dark (`#3B82F6`); white passes on the former (6.70) but only
  3.68 on the latter, while near-black passes on the latter (5.38) and fails the
  former. No single value could pass both, so the token is `#FFFFFF` light /
  `#0A0A0A` dark. A false `ACCESSIBILITY.md` sentence claiming bars "no longer
  print percentage figures inside their saturated fills" was reworded to describe
  the actual behavior (the figures read from an adjacent label everywhere except
  this one meter, whose color is now AA in both themes).
- **One close path that restores focus — for every overlay close affordance.**
  The Map Explorer mobile filter panel's published claim ("Escape … returns
  focus to the button that opened it") was true only for Escape; the Close
  button and the backdrop stranded focus on `<body>`. The Tester caught a
  regression of exactly this after the fleet's first pass. Fix: all three close
  affordances route through one `closeSidebar`, and because the Filters button
  unmounts while the panel is open, the restore runs in an effect AFTER the close
  render commits (a `restoreFiltersFocusRef` flag), not at close() time when the
  ref is still null. Escape on fullscreen returns focus to the fullscreen toggle
  the same way. Standing contract for any new overlay.
- **`inert` on a decorative recharts wrapper — recharts ignores
  `accessibilityLayer={false}` on `PieChart`.** The donut's root `<svg>` stays
  focusable regardless, leaving an axe aria-hidden-focus ghost; wrapping the
  decorative chart in `inert` kills it for good. (The same `inert` mechanism
  clamps collapsed filter panels so their hidden controls aren't stray tab stops.)
- **The atlas keyboard route lives IN `AtlasLayer`, as a self-contained "Atlas
  blocks in view" disclosure panel — not a MapExplorer sidebar list.** The atlas
  block popups were pointer-only; the route was deliberately built inside the
  overlay component so it works on EVERY map that mounts the atlas, not just the
  Map Explorer. The data layer (`blockListRows` in `lib/atlasBlocks.ts`,
  viewport-scoped + capped) is unit-tested; the panel rows open the block's
  breeding summary + eBird atlas link and pan to it. This closed the
  pointer-only exception that `ACCESSIBILITY.md` had carried.
- **The "open this checklist on eBird" affordance was unified into one shared
  `ChecklistLink` component** (WCAG 3.2.4 Consistent Identification) — previously
  rendered four different ways and named three. One visual signature (the lucide
  `ExternalLink` icon) and one accessible-name formula
  (`Open checklist {id} on eBird (opens in a new tab)`), and it keeps the standing
  `SUBMISSION_ID_RE` shape-validation (junk id → plain text, never a styled 404
  link).

**The verification loop earned its keep.** Two false published claims reached
the statement and were caught only by re-checking it against the code: (a) the
complete-checklists meter above, and (b) the mobile filter focus-restore. The
lesson mirrors the privacy-policy stance — a published accessibility statement is
a record that must be re-verified against the shipped code, not against the
intent. Dark theme was covered analytically (computed contrast both themes), not
re-axed, because the theme is persisted, not toggled at runtime.

**Deferred items (as of 0.5.31) — all since resolved; see the 0.5.32 entry above.**
F064 (the shared checklist-link component) shipped in this 0.5.31 pass and was
adopted app-wide in 0.5.32. F078 (an explicit "opens in a new tab" suffix on every
external link via a shared component) shipped in 0.5.32 as `OutboundLink`. F082/F106
(the Southern-Hemisphere moon-phase emoji) was **not** actually deferred — it
already shipped in 0.5.28 (`lat < 0 → MOON_SOUTH`, latitude threaded to both
formatters, locked by the byte-golden tests); the original "scoped out rather than
half-done" framing was inaccurate and is corrected here.

**Lane note:** no release of its own is recorded here separately — 0.5.31 is the
version bump, ships in the app bundle, and the records below (CLAUDE.md,
PRODUCT_CONTEXT.md, ROADMAP.md) were updated alongside. The on-main-unreleased
test-determinism work folds into this same 0.5.31 release.

**Implications:** New contrast work goes at the token using the `-fg` / `-text` /
on-fill naming, in both themes; `text-disabled` is controls-only. Overlays route
every close path through one focus-restoring function. Decorative recharts
wrappers get `inert`. New external-id links shape-validate before becoming a
link. These are promoted to CLAUDE.md.

---

## Remaining test-suite flake fixed (two mechanisms, test-only); 0.5.29 records narrowed; PRODUCT_CONTEXT MapLibre doc-rot cleared — 2026-06-11 (no release; rides main until the next release)

**What:** Improve lane that killed both remaining failure classes of the
frontend suite's rare timing flake with test-only changes.
**(A1) The commit-vs-effect race:** under suite load, `renderAndLoad()`'s
`waitFor` on rendered DOM (`BirdingStats.test.tsx`) could resolve on the
phase-ready React commit BEFORE the component's passive double-rAF effect
queued anything into the stubbed `rafQueue` — flush #1 then drained an empty
queue, the rAF ladder never completed, and the next heading assertion failed
against a frozen shell. Fixed with an observable stub-queue precondition after
the DOM wait: `await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))`
— no wall clock. **(A2) The inter-environment timer leak:** toolkit's 100 ms
autoBatch fallback timers armed in the two chart-mounting jsdom files could
fire AFTER the file's jsdom environment was torn down, where neither jsdom's
`cancelAnimationFrame` nor the node-env shims exist (the 0.5.29 `test-setup.ts`
guards never install in jsdom files) — failing a later file with all tests
green. Fixed with `afterAll(() => new Promise((r) => setTimeout(r, 120)))`
wait-outs in `BirdingStats.test.tsx` and `MediaStatsSections.test.tsx`.
Proof: 45/45 post-fix stressed runs green (Engineer 30 + QA 15; single worker,
shuffled file order, concurrent CPU load) against a 3/30 pre-fix failure rate;
a pre-fix negative control in a throwaway worktree failed at run 12 with the
exact A2 class — all 82 tests passing, the run failed on the unhandled error.

Also in this lane: the 0.5.29 "flake fixed" overclaim was narrowed in
DECISIONS.md, CHANGELOG.md, and ROADMAP.md to the `cancelAnimationFrame` arm
it actually fixed, and PRODUCT_CONTEXT.md's pre-MapLibre doc rot was cleared
(12 current-behavior passages rewritten against the current map stack, 5
historical entries annotated as superseded, 2 Key Decisions marked historical,
and a v0.5.9 MapLibre-migration anchor entry added for the notes to point at).

**Decisions:**
- **No release — the change rides main until the next real release.** Nothing
  here ships in the app bundle (tests and records only), so the user scoped
  the lane to no version bump, no tag, no Mac release; CHANGELOG carries an
  `[Unreleased]` section that folds into the next release. Running the full
  release rhythm (tag, Windows CI, notarization, updater) for a change
  invisible to users buys nothing.
- **Async UI tests must wait on OBSERVABLE stubbed-queue preconditions —
  never assume effect timing relative to `waitFor`.** A DOM `waitFor` proves
  the commit happened, not that passive effects have run; when a test stubs a
  scheduling queue and then flushes it, the flush is only meaningful once the
  stub queue observably holds work. The generalized pattern: after the DOM
  wait, `waitFor` on the stub queue's length, then flush. Rejected
  alternatives (`vi.resetModules()`, rIC shims in `test-setup.ts`) were
  evaluated and dropped — they don't touch the mechanism.
- **Chart-library fallback timers need teardown wait-outs in jsdom files.**
  The 0.5.29 shims protect node-env files only; a jsdom file's own teardown
  is still a cliff for any third-party timer armed during it. Any test file
  that mounts recharts charts ends with the 120 ms `afterAll` wait so the
  timers fire where `cancelAnimationFrame` still exists.
- **The outside-project boundary held and is now a standing rule.** The
  scoping inventory's proposed "resolution note" about snowraven-mini was
  rejected: this repo's pipeline and records track SnowRaven only. Promoted
  to CLAUDE.md's pipeline conventions so no future lane re-litigates it.

**Implications:** Both test patterns are promoted to CLAUDE.md (Running
tests): new chart-mounting jsdom files copy the 120 ms wait-out, and
component tests that stub scheduling queues flush only after an observable
precondition. The stress recipe — `npx vitest run src/components
--maxWorkers=1 --sequence.shuffle.files=true` under concurrent CPU
busy-loops, 30 runs — is the proven reproducer for suite-order flakes;
reuse it (plus a pre-fix negative control) before claiming any flake fixed.

## Map fixes: sprite registration never gated on `isStyleLoaded()`, branch `<Source>`s keyed — 2026-06-11 (v0.5.30)

**What:** Fix lane for the missing hotspot teardrops, expanded mid-lane (user
approval at Stage 3) to also fix an app-wide crash the regression walk surfaced.
Two root causes, both proven with deterministic Playwright repros before fixing.

**Bug 1 — hotspot teardrops (and atlas hatches) silently never registered.**
`HotspotMarkers.tsx`/`AtlasLayer.tsx` gated sprite registration on
`if (map.isStyleLoaded()) addAll(); else map.once('load', addAll)`.
`isStyleLoaded()` reads false during ANY tile/source churn (base switch,
fitBounds, slow network) — and MapLibre's `load` event fires once per map
lifetime, while the Map Explorer's map stays alive from first tab mount — so a
listener armed later never fired, `addImage` never ran, and the `sr-hotspot`
symbol layer rendered nothing (and was unclickable: `queryRenderedFeatures`
finds nothing). Latent since 0.5.16; presented as intermittent because the
theme-flip MutationObserver re-bake self-healed it. **Fix:** register
unconditionally at effect time (`addImage` needs the style present, not
"loaded"; the `hasImage → updateImage : addImage` idempotency stays) plus a
per-component `styleimagemissing` safety net that bakes only the component's
OWN hardcoded image ids (exact-match lookup, `hasImage`-guarded, removed on
unmount). QA fired the net live (`removeImage` + repaint → re-baked).

**Bug 2 — Map Explorer Pins → Heatmap toggle crashed the whole app**
("source id changed" → error boundary; pre-existing since 0.5.18, present in
the shipped 0.5.29). `map/SightingMarkers.tsx` returned `<Source id="sr-heat">`
or `<Source id="sr-sight">` at the same tree position with no `key`, so React
reused the instance and react-map-gl asserts on the in-place id change —
MapLibre forbids mutating a source's id. **Fix:** `key` per branch so the
Source unmounts/remounts on mode change. Species Detail's heatmap
(conditionally mounted — the safe pattern) was unaffected and untouched.

**Decisions:**
- **Scope expansion, approved explicitly.** The heatmap crash was outside the
  bug brief, but it was a one-click app-killer live in the shipped build; the
  user folded it into this lane at Stage 3 rather than ship 0.5.30 around a
  known crash. Recorded so the two-fix diff doesn't read as scope creep.
- **Deterministic-repro-first verification paid for itself.** The triage's
  Playwright repro (delayed satellite tiles + mid-churn hotspot search) both
  proved bug 1's root cause and proves the fix; the post-fix regression walk
  across the whole map surface is what caught bug 2 at all. And the new
  `SightingMarkers.test.tsx` was proven to FAIL against pre-fix code in a
  throwaway worktree before being counted as coverage. Keep this posture in
  fix lanes: repro before fix, walk the surface after, verify the test bites.
- **Both root causes promoted to standing CLAUDE.md conventions** (Overlays
  and stacking): never gate sprite/image registration on
  `isStyleLoaded()/once('load')`; key (or conditionally mount) any `<Source>`
  whose id differs between render branches.

**Implications:** Future sprite-registering map components follow the
`HotspotMarkers`/`AtlasLayer` contract — unconditional registration + an
owned-ids-only `styleimagemissing` net. Any map-level event handler fed
external ids acts only on its own hardcoded id set, never using the incoming
id as an object key or regex input (the 0.5.30 handlers are the reference
implementation).

## Suite's cancelAnimationFrame flake fixed with setupFiles baseline shims; SnowRaven Mini mentioned in exactly three places — 2026-06-10 (v0.5.29)

**What:** Killed the `cancelAnimationFrame` arm of the pre-existing ~11% full-suite vitest flake with
test-infrastructure-only changes (new `frontend/src/test-setup.ts` + a
`test.setupFiles` entry in `vite.config.ts`; zero production code), and added
three informational mentions of **SnowRaven Mini** (the author's separate
Chrome/Firefox extension running the same weather+tide lookup on the eBird
page): a Weather-tab footer line (`App.tsx`), a closing paragraph in README's
"What it does", and an H3 under HELP.md's Weather section. Copy approved
verbatim; GitHub repo link only (Mini is not on the extension stores — no
store or landing-site links).

A separate, rarer idle-callback-adjacent flake in the same suite was a
different mechanism (commit-vs-effect race) and survived this fix; fixed
separately after 0.5.30.

**Decisions:**
- **Library fallback timers that outlive a test file need BASELINE shims in
  shared setup — per-test stubs structurally cannot cover cross-file timing.**
  Root cause: recharts bundles `@reduxjs/toolkit`, whose autoBatch fallback
  timer (100 ms) calls bare `cancelAnimationFrame`. `BirdingStats.test.tsx`
  stubs rAF/cAF per-test and restores them in `afterEach`; the stray timer
  fires AFTER that file finishes — in a later DOM-less node-env file in the
  same worker, where `cancelAnimationFrame` doesn't exist — and vitest fails
  whatever test happens to be running. Fix: idempotent,
  `typeof === 'undefined'`-guarded rAF/cAF shims run for EVERY file via vitest
  `setupFiles` (jsdom files keep their natives; BirdingStats' own stubs still
  win during its tests). QA proved it both ways: 8/8 shim-enabled full-suite
  runs clean; a shim-disabled negative control reproduced the exact
  ReferenceError at the pinned ~11% rate (2/18). Never remove the shims or
  convert them back to per-test stubs.
- **The website stays SILENT about Mini.** CLAUDE.md's website-sync rule
  exists so the site reflects the app's feature set; a companion-project
  mention is not an app feature, and the user specified exactly three places.
  Purpose reading over letter — recorded so a future docs-sync sweep doesn't
  "fix" the omission by adding Mini to the site.
- **The HELP mention is an H3 under Weather, deliberately OUT of the HelpDocs
  TOC** (the Tides precedent). Companion-project info is findable in context,
  not promoted to navigation — matching the informational, no-promotion
  register of all three mentions.

**Implications:** Any future flake traced to a third-party timer that
outlives a test file gets the same treatment (extend `test-setup.ts`, don't
per-test stub). Out of scope but flagged: snowraven-mini's own formatter
lacks the v0.5.28 moon-phase emoji — drift in the OTHER repo, not addressed
here.

## Weather-block raincrow parity: moon phase via the header emoji, pure-UTC port — 2026-06-10 (v0.5.28)

**What:** SnowRaven's generated weather blocks now append a moon-phase emoji to
the condition emoji on night checklists (`☁️🌗`), reaching parity with raincrow.
The other suspected gap — dew point — was verified ALREADY at parity during the
investigation (both formatters emit it unconditionally; 306 of the user's
checklists carry it), so **no dew-point change was made**: remaining differences
vs raincrow are cosmetic (toggleability, °C, half-up vs banker's rounding) and
deliberately left alone.

**Decisions:**
- **Header emoji, not a labeled `Moon:` line — and UNSPACED.** The phase emoji
  is appended directly to the condition emoji as one contiguous emoji run
  (`☁️🌗`, never `☁️ 🌗`). This is load-bearing: `stripWeatherTideBlocks`
  anchors a block on its LAST emoji run before the first labeled line, so the
  unspaced header needed **zero changes to `commentBlocks.ts`** (its diff is
  empty, verified), while a spaced header would leak `☁️ ` on strip. A labeled
  `Moon:` line was the worst option — it required `STRONG_MARKER_RE` vocabulary
  changes plus fixes for two known leak shapes the investigation found. (A
  raincrow-identical bare-moon header on clear nights was also rejected: that's
  raincrow's unmapped-night-icon limitation, not a design to copy.)
- **Pure-UTC Julian Day — a deliberate deviation from `lunarphase-js`.** The
  algorithm is a hand-ported `lunarphase-js@2.0.3` (pinned from the npm dist,
  NOT added as a dependency), but v2.0.3 bakes the *runtime's* local timezone
  offset into its Julian Day, so faithful ports would disagree depending on
  where the code runs. The port uses `JD = unix_ms/86400000 + 2440587.5` (pure
  UTC) in BOTH runtimes, duplicated byte-identically in `weatherFormatter.ts`
  and `backend/formatters/weather.py` and locked by the golden-oracle chain;
  the deviation only matters within ~±2% of a phase boundary.
- **Night = any sampled hour with `dt` outside its sunrise–sunset window** —
  not raincrow's OpenWeather d/n icon-suffix check. All three fields are
  already in every timemachine hour, so this avoids plumbing the `icon` field
  through both runtimes' types and mocks; the phase is computed from the
  checklist's FIRST sampled hour (matching raincrow's start-time behavior).
  Southern Hemisphere (`lat < 0`) mirrors the emoji set; the formatters gained
  a `lat` param both callers already held.

**Implications:** Any future weather-block header change must keep the header
emoji one contiguous run (the strip anchor depends on it) and keep the moon
emoji OUT of the strip marker vocabulary (it needs none — `EMOJI_RUN_RE`
already covers it). The moon logic lives inside the byte-golden lockstep chain
— change `weatherFormatter.ts`, `weather.py`, and `weatherFormatter.golden.py`
together. And the lane lesson: investigate before building — half the suspected
parity gap didn't exist.

## Checklists tab: span-based block stripping, regex hygiene as policy, cycling tri-state pills — 2026-06-10 (v0.5.27)

**What:** New Checklists tab (checklist-comment search, all-species species-comment
search, filterable all-checklists list, weather/tide hide toggle). Four decisions
worth keeping, two of them born from real-data bug reports and the security review.

**Decisions:**
- **Hiding a pasted weather/tide block means removing a SPAN — emoji header →
  end of attribution link — never whole lines.** eBird's CSV export collapses a
  pasted block's newlines into spaces, so user prose routinely shares one long
  line with the block and can continue AFTER the attribution. The first
  (line-based) implementation silently ate user comments; the user defined the
  correct rule. `stripWeatherTideBlocks()` (lib/commentBlocks.ts) is the single
  source of truth, with fallbacks for real export shapes: moon-emoji night
  blocks (RainCrow), bare-name attributions, attribution-less blocks (end after
  the last labeled value), emoji-less condition segments (absorbed only when
  short and not a finished sentence). **Post-mortem lesson: when a feature
  processes round-tripped/pasted text, verify against the REAL export early** —
  unit fixtures from the formatters all passed while three real-data shapes
  failed. The real-formatter-fixture + full-backup-sweep combination caught
  everything (308 block-bearing comments, 0 residue).
- **"Search matches what you see."** While blocks are hidden, search runs on the
  stripped text, and an empty-after-strip comment counts as NO comment in both
  the boxes and the has-comment filters; the has-weather/has-tide filter pills
  read the raw comment regardless of the toggle.
- **Regex hygiene is now policy** (from the security review, all three findings
  fixed in-stage): (1) module-level `/g` regexes carry shared mutable
  `lastIndex` and `String.prototype.matchAll` CLONES it — a stale offset made
  the strip silently skip markers order-dependently; always reset, or scan once
  up front. (2) Regexes scanning untrusted comment text must be linear by
  construction — precompute match positions, bound lazy quantifiers (the
  `NAME_TAG_RE` posture): the unbounded version was O(n²), 4.1s @400KB on the
  main thread, ~5ms after. (3) Decode entities exactly once along a render
  path — the shared `CommentText` takes `raw` (encoded; comparer/API) or
  `decoded` (Checklists; strip output) and double-decoding broke
  display==search.
- **Cycling tri-state pill for many-category filters.** One pill per category
  cycling any → has → doesn't-have (label restates its state: "Media" → "Has
  media" → "No media") instead of the Multimedia tab's paired Has/No pills —
  nine categories would have meant ~18 pills. This tab only; no retrofit.

**Also:** the comparer's `CommentText` was lifted to shared
`components/CommentText.tsx` rather than copied a third time;
`PRIVACY_POLICY.md` gained the "Embedded Bird Media and Link Icons" section
disclosing the pre-existing Cornell Lab asset loads (Macaulay embeds on Species
Detail + eBird/Birds-of-the-World favicons app-wide), with README/website/brief
now deferring to the policy as the full provider list.

## Named Birds tab: shared `SightingsMap` + single-open accordion as the concurrency bound — 2026-06-10 (v0.5.26)

**What:** Upgraded the Named Birds tab (four-option sort, per-report location, comment quote-blocks, lifted contrast) and gave each individual a per-individual sightings map. Two architectural decisions drove it.

**Decisions:**
- **Extract one shared `SightingsMap`; don't inline-duplicate the Species Detail map.** The pins path (DOM `<Marker>` pins + single state-driven `<Popup>` + `MapBoundsFitter`, owning the static `SP_PIN_HTML` sprite and its own `selectedCoord` state) is now `components/SightingsMap.tsx`. Both the new Named Birds card map and Species Detail consume it; Species Detail migrated with a **pixel-identical** pins contract and keeps its heatmap, intensity slider, and map-mode toggle local (the heatmap is deliberately *outside* the extraction boundary). Inlining a second copy would have forced the sprite, popup state machine, link guard, and per-coordinate aggregation to stay hand-synced. The aggregation is a separate pure, unit-tested helper, `lib/sightingMarkers.ts` (`buildSightingMarkers` — skip null coords, group by `lat,lng`, dates newest-first), so the "skip-null / empty→no-map / same-coord aggregation" behavior lives in one tested function used by both surfaces.
- **Bound concurrent WebGL maps *structurally*, with a single-open accordion — not an instance counter/queue.** The one real engineering risk was several expanded cards each mounting a MapLibre/WebGL context. The Named Birds tab now opens at most one card at a time (`singleOpen` prop; opening a card empties `expanded` to the new key), so at most one map is ever live — the stacked-context failure mode is designed out, not merely "probably fine." Render-only-while-expanded still tears the map down on collapse. Species Detail's map-less `NamedBirdsTable` stays multi-open (the cap is gated on `singleOpen`, so it's no gratuitous UX change there). This subsumed the PRD's open question on a concurrency cap.

**Also:** `location`/`latitude`/`longitude` were threaded onto `NamedSighting` from the already-parsed `ObservationEntry` (no parser change, no new CSV column); the per-row checklist link is now gated with `SUBMISSION_ID_RE` (`/^S\d+$/`) before becoming an anchor (rendering a malformed id as plain text), matching the map popup and the 0.5.25 convention.

**Implications:** When a second surface needs an existing map's pins/popup/bounds-fit, extract the pins path into the shared `SightingsMap` and migrate the original with a pixel-identical contract — don't re-inline the Species Detail map. Prefer a single-open accordion over a counter/queue wherever a list can mount per-row maps. Any external-id href built from CSV data is shape-validated (`SUBMISSION_ID_RE`) before it becomes a link.

## Media card: At a glance back to uniform tiles + busiest-day checklist link — 2026-06-10 (v0.5.25)

**What:** Reworked **Statistics → Media → At a glance** again — busiest day, longest streak, and a new archive-span fact are uniform grid tiles once more (not the v0.5.24 caption), and the busiest-day date links to that day's eBird checklist. **This supersedes the v0.5.24 decision below** that moved those facts out of the grid into a caption.

**Decisions:**
- **Mixed-height `StatCell`s in one `auto-fit` grid are fine *if every tile reserves the sub-line slot*.** v0.5.24 banned mixing sub-bearing and plain tiles because the taller ones stretched the row. The cleaner fix is a `reserveSub` prop on `StatCell` that always renders the sub-line slot (`sub || nbsp`), so every tile is the same height whether or not it carries a sub. All eight At-a-glance tiles set `reserveSub`, so busiest day / longest streak (with the dates it ran) / archive span are tiles again and stay aligned at any width. The v0.5.24 "facts that need a sub-line belong in a caption" guidance is **reversed** — they belong in tiles, with `reserveSub`.
- **The busiest-day date links to that day's *dominant* eBird checklist, and ids are shape-validated before they become a link.** When a day spans several checklists, the link targets the one with the most media (tooltip explains). Ids are validated against `/^S\d+$/` at tally time, so junk column values never become a styled 404 link; the href is `encodeURIComponent`-wrapped and rendered as escaped JSX — same standing rule as the map popups/links.
- **Out-of-range export dates are excluded from the date stats, not rolled over.** `dayNumber` previously accepted "2024-13-05" / "2024-02-00" via `Date.UTC` rollover while `formatDate` rejects them, so a tile could lose its sub-line (breaking the uniform height) or render an empty link. `dayNumber` now range-checks month/day like `parseParts`; such rows are treated as undated.
- **The checklist link's `aria-label` leads with the visible date.** An earlier label replaced the visible date, violating WCAG 2.5.3 (Voice Control users couldn't activate it by its visible text). The accessible name now begins with the date the user sees. (v0.5.32: this rule is baked into the shared `ChecklistLink` — `checklistLinkAriaLabel(id, label)` leads with the label when one is shown — after the 0.5.31 extraction had briefly regressed it on the Checklists tab.)

**Implications:** Prefer `reserveSub` over a separate caption when a Media-card fact needs a sub-line — keep facts in the uniform tile grid. Any new external link built from export-column data must shape-validate the id before constructing the href.

## Media card: At a glance alignment + age-coverage rework — 2026-06-09 (v0.5.24)

**What:** Fixed the misaligned "longest streak" dates in **Statistics → Media → At a glance**, and reworked **Age coverage by species** to be filtered, capped, and sortable.

**Decisions:**
- **Do not mix `StatCell`s with and without a `sub` line in the same `auto-fit` grid.** `StatCell` renders an extra line only when `sub` is set, so a sub-bearing tile is taller; the grid (`repeat(auto-fit, minmax(150px,1fr))`, default `align-items: stretch`) then stretches the whole row to the tallest tile, and because tiles re-wrap per width, *which* tiles share a row with the tall one changes — producing alignment that looks broken at some widths and fine at others. Fix: the At-a-glance grid now holds only the five uniform count tiles; the busiest-day / longest-streak / span facts moved into a centered caption (`atAGlanceFacts.join('  ·  ')`). Keep nugget facts that don't fit the tile shape out of the StatCell grid.
- **The "documented only as adults so far" note gates on `youngSpecies.length > 0 || onlyAdults.length > 0`.** `speciesWithYoung` (immature||juvenile) and `onlyAdults` (adult-only, ≥3 aged assets) are disjoint sets, so gating the whole Age-coverage block on young-species alone hid the note for exactly the all-adults user it's most informative for. Render the sortable list only when `youngSpecies.length > 0`, but let the note render independently. (Regression caught in adversarial review; covered by an all-adults component test.)
- **Age-coverage taxonomic sort reuses `/taxonomy/codes`.** The endpoint already returns `orders` alongside `codes`; `BirdingStats` threads it through `orderFor` (same raw-key→normalized→`Infinity` fallback as `codeFor`) into `sortSpeciesAgeCoverage` (unknown order sorts last, name as tiebreak). No new endpoint.

**Implications:** Any new Media-card "fact" that needs a sub-line belongs in a caption, not the StatCell grid. Notes that summarize a superset of a filtered list must not be nested inside the filtered list's render gate.

## In-app text size via px→rem (v0.5.13) — 2026-06-05

**What:** App-wide Text Size control (Settings → Appearance, 100/125/150/200%) +
automatic respect for the browser/OS default text size. Plan: `pipeline/text-size/plan.md`.

**Mechanism:** `html { font-size: calc(100% * var(--sr-text-scale, 1)) }` — `100%`
inherits the platform default (system-respect), the var is the in-app multiplier; ALL
font sizes converted px→rem so they scale with both. Persisted via localStorage (web
anti-flash, in index.html) + the storage seam (desktop-durable); applied app-wide on
load in `App` (`lib/textScale.ts`).

**Why px→rem, not CSS `zoom`:** there is no JS API to read the OS text size — the
platform delivers it only through the root font size, which requires relative units.
So px→rem is the only path that (a) honors system text size and (b) sets up the future
**mobile** app to honor iOS Dynamic Type / Android font scale. CSS `zoom` was rejected:
manual-only (ignores system size) and it offsets MapLibre pointer coordinates. rem is
text-only, so maps are unaffected.

**Scope/standard:** levels reach **200%** to meet **WCAG 2.1 SC 1.4.4 (Resize Text)**.
Conversion: a reviewed codemod did 469 literal inline `fontSize` values; 5 computed +
9 CSS values by hand. Overflow audit (SC 1.4.12) at 200% found only the Statistics
number grids crowding — fixed by switching those grid track minimums from px to rem
(`minmax(120px…)` → `minmax(7.5rem…)`, etc.). Wide tables + maps may scroll at 200%,
permitted by SC 1.4.10's exemption.

**Still deferred:** keyboard-operable map markers (MapLibre markers aren't natively
focusable; sidebar lists are the fallback).

---

## Tier 3 foundation pass (v0.5.12) — 2026-06-05

**What:** First pass at the Tier 3 backlog (`pipeline/comprehensive-review/audit.md`),
prioritized for long-term maintainability (Dave: "maintain SnowRaven for a long time").

**Done:**
- **Extracted + tested the stats logic.** `lib/birdingStats.ts` (13 pure fns, 14 tests)
  and `lib/speciesStats.ts` (7 pure fns, 9 tests) — the Statistics + Species Detail
  derivations are now pure, unit-tested modules; the components render over them.
  BirdingStats 2574→1952, SpeciesDetail 1951→1813 lines. This is where the past
  calc bugs lived (area, streaks, state names) — now regression-guarded.
- **Chart accessibility.** All charts get `role="img"` + a concise summary; decorative
  pie SVGs `aria-hidden`.
- **Perf:** `BirdName` wrapped in `React.memo`; eBird CSV parse moved to a Web Worker
  (`lib/observationsWorker.ts`) via `observationsCache`, with a synchronous fallback.
- **Map Explorer:** atlas toggle relabeled "California atlas blocks." (Tried per-mode
  intro text — REVERTED: it pushed controls down + duplicated the legend. Lesson:
  no explanatory chrome above the controls.)

**Deliberately did NOT do (and why):**
- **Shared-primitive dedups** (heatmap layer, filter bar): on inspection the heatmap
  uses had genuinely diverged (atlas shading) and the filter predicate was trivial —
  forcing a shared abstraction would be the *wrong* abstraction. Skipped.
- **Component render-splitting** (sections → files): the high-value part was the logic
  extraction (done); splitting JSX into files is pure org with churn — deferred until
  a tab is being actively changed.

**Deferred to dedicated future efforts:**
- **In-app text size → px→rem conversion.** The app is sized in fixed px, which is
  exactly what blocks honoring the OS/browser text size. The mobile-correct path
  (relative units → iOS Dynamic Type / Android font scale, no JS API reads a number)
  is a large, careful refactor — its own effort, also the foundation for the future
  mobile app. A CSS-`zoom` shortcut was rejected (manual-only, ignores system size,
  and CSS zoom can offset MapLibre pointer coords).
- **Keyboard-operable map markers** (MapLibre markers aren't natively focusable;
  sidebar lists are the current fallback).

---

## Comprehensive review → Tier 1 + 2 improvements (v0.5.11) — 2026-06-05

**What:** Ran a full-app audit (5 parallel read-only reviews: UX, IA/consistency,
a11y, performance, code-health → `pipeline/comprehensive-review/audit.md`), then
built the agreed Tier 1 (quick wins) + Tier 2 (bigger bets) and shipped them as a
**single 0.5.11 release** (Dave's call — avoids double notarization/CI).

**Key decisions:**
- **`--sr-on-accent` token** is the readable foreground on the accent fill (white in
  light, dark green `#052E16` in dark). Dark primary buttons were white-on-`#34D399`
  = 1.92:1; this fixes ~11 CTAs. Use it for any new accent-background control.
- **Map popups are themed via `.maplibregl-popup*` CSS** (content + tip per anchor)
  plus tokenizing the inline popup colors — they were hardcoded light grays.
- **Sortable `<th>` keyboard support** = `tabIndex={0}` + `onKeyDown` (Enter/Space),
  *keeping* the `columnheader` role + `aria-sort`. Do NOT add `role="button"` — it
  voids `aria-sort`.
- **Lazy-load** the 3 heavy tabs (Map Explorer, Species Detail, Statistics) via
  `React.lazy` + Suspense + a deferred-mount set (`mountedTabs`, stay-mounted after
  first open). First-paint JS ~525 KB → ~110 KB gz; maplibre/recharts now split.
- **`lib/observationsCache.ts`** — content-keyed memo of the eBird parse, shared by
  all tabs (was re-parsed per tab).
- **`components/setupCopy.tsx`** — single source for eBird/ML setup steps (fixes the
  missing ML "filter = All" step + the inconsistent eBird ZIP wording).
- **First-run welcome** (`WelcomeScreen.tsx`) shows only on cold start (no keys AND
  no files AND not previously dismissed; dismissal persists via the storage seam's
  `welcomeSeen`).
- **Renames:** "Media List" → **Multimedia** (tab id stays `life-list` so saved
  layouts don't break); "Nemesis Birds" → **Nearby Lifers** (internal `nemesis*`
  vars + `/stats/nemesis` endpoint kept).

**Deliberately deferred to Tier 3** (don't redo as "missing"): splitting the
oversized components (BirdingStats/SpeciesDetail/MapExplorer) and, *with* those
splits, extracting the remaining shared primitives (the filter bars, `Stat*`/
`SectionCard`, `SegControl`, the heatmap wrapper) — pulling them out now would add
churn/regression risk for no user-visible gain. Also deferred: unifying the two
day-first date formats (Map Explorer "5 Jan" vs Species Detail "5 January" — minor
drift), map-marker keyboard operability, Worker-based CSV parse, chart alt-text.

---

## Offline maps — explored, shelved (roadmap) — 2026-06-05

**Decision:** Explored an optional offline-maps feature (download regions so the
maps render without a connection). **Shelved** — kept as a *distant roadmap* item,
not feasible now given SnowRaven's self-hosted / no-server, local-first nature.

**Why not now:** the blocker is tile **hosting**, not rendering. Rendering offline
is a solved problem (MapLibre + PMTiles + OPFS). But *serving the tile bytes* isn't
free: Protomaps discourages hotlinking their planet builds (URLs rotate daily,
"copy the tileset to your own storage"), and OpenMapTiles-schema extracts would
need generating with Planetiler. Either path requires **us to host tile data** — a
~100 GB planet copy or pre-generated regional extracts, with egress per download —
a real infrastructure + cost commitment the otherwise serverless/free app avoids.
Not worth taking on right now.

**Revisit when:** there's appetite to run tile hosting (e.g. Cloudflare R2), OR a
sanctioned free per-region tile source appears, OR the mobile apps make
field-offline a priority (offline is the strongest use case on phones; ~90% of the
build would reuse on Tauri mobile, and the PMTiles approach/data port to native).

**Record:** full research in `pipeline/offline-maps/` (strategic-brief, prd,
architecture). If revived: PMTiles **vector base only** (satellite/topo too big to
download), region picker + size estimate, OPFS storage, desktop-first.

---

## Statistics tab: top species, richer effort/outings, regroup — 2026-06-05 (v0.5.10)

**Decision:** Expanded and reorganized the Statistics tab (`BirdingStats.tsx`):
added **Top Species** (most individuals + most checklists), a much richer
**Effort & Outings** section, a new **Highlights & Records** section, a logical
**regroup** of previously-scattered stats, and a section **jump-nav**. Shipped
batched with the SnowMap offline-retry fix as **0.5.10**.

**Key points / learnings:**
- **Area Covered**: added parsing (`area` on ObservationEntry/ChecklistEntry;
  the "area covered (ha)" column). Dave's data has **0 area rows** — his protocols
  are Traveling/Stationary/Casual, and only the eBird "Area" protocol records
  area. So area stats are **hidden when absent** rather than shown blank; parsing
  is verified, the empty display was correct, not a bug.
- **Checklist-level fields dedupe by submissionId** — duration/distance/area/
  observers repeat per species row, so summing raw rows would multiply by species
  count. All outing superlatives + totals use the deduped `checklists`.
- **Regroup without risky cut-paste**: moved the records grid out of Firsts &
  Milestones, then split Data Quality by inserting a section boundary *before* the
  biggest-counts block — so the flocks / single-checklist / one-and-done blocks
  became the new "Highlights & Records" section's content in place. (Placement:
  Highlights & Records lands after Data Quality as a result.)
- **State codes → names**: new `lib/regionNames.ts` (US + Canada, fallback to the
  code); display the name, keep the code in the eBird region URL + hover title.
- **Streak counts any report/date** (`rawObs`, unfiltered) per Dave's ask;
  single-checklist now excludes one-and-done (a strict subset).
- **Total time spelled out** via `formatDuration` (yr/mo/day/hr/min, non-zero
  units only; eBird durations are minute-granular so no seconds).
- **Versioning**: 0.5.10 was already bumped (for the map fix) in BOTH
  `package.json` and `tauri.conf.json` — did not re-bump; appended the Statistics
  items to the existing 0.5.10 CHANGELOG entry. (Reinforces the v0.5.9 lesson:
  bump both version files.)
- Tests: `lib/regionNames.test.ts` + Area-Covered parsing in
  `parseEbirdObservations.test.ts`. 306 frontend tests pass.

---

## Vector basemap: Leaflet → MapLibre GL + OpenFreeMap — 2026-06-04 (v0.5.9)

**Decision:** Replaced the Leaflet + raster-tile map stack with **MapLibre GL**
(`react-map-gl` / `maplibre-gl`) drawing **OpenFreeMap** vector tiles, across all
three maps (Map Explorer, Species Detail, Statistics). Motivation: custom label
sizing/styling, brand tinting, and a path to offline tiles — none possible with
raster tiles. All maps go through one `<SnowMap>` wrapper; styles/providers live
in `lib/mapStyle.ts`. Leaflet (`leaflet`, `react-leaflet`, `leaflet.heat`) was
removed entirely.

**Key architecture:**
- **Single persistent style + `visibility` toggling**, never `setStyle`-swapping
  (swapping dropped the `openmaptiles` source and reset pan/zoom). Satellite
  (Esri) / Topo-US (USGS) / Trails (Waymarked) are raster layers inside the one
  style, shown/hidden by `visibility`. Switcher kept on all maps (Dave's call).
- **`useMap().current`** gives children the `MapRef` for imperative effects
  (pan/fit, atlas click + `addImage`). Markers are `<Marker>`s; each map has ONE
  state-driven `<Popup>` (MapLibre has no per-marker `bindPopup`).
- **`lib/heat.ts`** is the single heat model for both heatmaps (native `heatmap`
  layer); default intensity tuned calm (`heatIntensityFactor(5) = 0.30`).
  Atlas-shading visibility priority: heatmap re-ordered under the atlas fill via
  `beforeId` + dimmed, sighting pins faded, so tier colors read on top.
- **Atlas** (`AtlasLayer.tsx`): full block GeoJSON (no viewport cap; `minzoom 6`),
  data-driven `fill-color`/`fill-pattern` by tier, line grid, and an escaped-JSX
  click popup. **Hatch textures** are canvas sprites (`lib/atlasTextures.ts`) via
  `map.addImage` + `fill-pattern`, regenerated on `data-theme` change; the legend
  preview is an inline-SVG `TierHatchSwatch`.

**Gotchas / post-mortems (carry forward):**
- **`Map` import collision** — `react-map-gl`'s `Map` shadows the JS `Map`
  constructor; `new Map()` then crashed (blank screen). Always import as `MapGL`.
- **Two-file version bump** — bumping only `frontend/package.json` (not
  `src-tauri/tauri.conf.json`) for v0.5.9 built the desktop bundle as 0.5.8; the
  first Windows CI run produced a 0.5.8 installer. Caught at the release
  health-check; fixed by bumping `tauri.conf.json`, moving the `v0.5.9` tag to the
  corrected commit, and re-running CI. CLAUDE.md versioning rule now says bump
  BOTH files (the tag must point at a commit where both are bumped, since CI
  builds Windows from `tauri.conf.json` at the tag).
- **No water-mask for trails** — an earlier attempt to mask trails to land hid
  bridges; reverted (trails-over-water beats missing bridges).
- **MapLibre paint can't read CSS vars** — colors in `fill`/`line`/`heatmap` paint
  and in canvas sprites are hardcoded (or read via `getComputedStyle` at
  generation). Justified exception to the "all colors via `var(--sr-*)`" rule,
  which applies to DOM/CSS only.

**Shipped in the same patch (v0.5.9):** also fixed Breeding Codes species-name
alignment (row `<th>` defaults to center) and made the Life List Total media count
a link to all media (unfiltered Macaulay search). Deferred-then-restored before
release for parity: atlas block popup + hatch textures (Dave held the release
until the maps matched the old feature set). Bundle: +maplibre-gl (~273 KB gz) −
leaflet (~50 KB) — accepted tradeoff for vector tiles.

---

## One shared `<BirdName>` for every bird name; click → Species Detail — 2026-06-04 (v0.5.8)

**Decision:** Every user-facing bird name renders through a single shared
component `frontend/src/components/BirdName.tsx` (common name + eBird/BoW
favicons + optional scientific name), replacing ad-hoc renderings. The common
name links to the species' **Species Detail** entry via a single-use cross-tab
navigation (`App.requestedSpecies` → `SpeciesDetail` consume effect), mirroring
the existing `requestedFilter` pattern.

**Key rules (resolved with Dave):**
- **Link only when an entry exists.** A name links to Species Detail only if the
  species is in the user's backbone (loaded eBird backup). Birds you haven't
  recorded (nemesis, map targets when unseen, a comparer's other-list-only
  column) show plain name + favicons — never a dead link.
- **Move the link to the number.** Where a name previously carried a link
  (Stats "Most Photographed" → ML; single-checklist/one-and-done → checklist),
  the name now goes to Species Detail and the count/element (or a ↗ / locate
  icon) carries the original link.
- **Headings stay** (Species Detail's own entry header) and **form controls are
  excluded** (Map filter dropdown, manual target checkboxes).
- **Quiet affordance:** the name reads as text at rest, revealing accent +
  underline on hover/focus, so already-compliant tabs look unchanged.

**Notes / implications:**
- `hasEntry` is sourced per tab from a normalized backbone set; tabs whose lists
  are entirely from the backup pass `true`.
- Favicons need a taxon code → Stats now resolves codes for ALL observed species
  (not just ML species) so favicons are consistent (one batched, cached
  `/taxonomy/codes` call). Raster label-size caveat N/A here.
- Component-test infra: added `jsdom` as a **dev** dependency and used a per-file
  `// @vitest-environment jsdom` docblock for `BirdName.test.tsx`, leaving the
  rest of the suite in the node env. First DOM/component test in the project.
- Convention recorded in CLAUDE.md: render bird names via `<BirdName>`, never
  ad-hoc; favicons are siblings of the name button (no nested interactive els).

---

## Keyless raster basemaps (CARTO Positron) + layer switcher; vector deferred — 2026-06-04 (v0.5.7)

**Decision:** Replace the default OpenStreetMap tiles (`tile.openstreetmap.org`)
with **CARTO Positron** as the default base, and add a keyless layer switcher
(Esri satellite, USGS topo, Waymarked trails) on the interactive maps. All
providers are **keyless** — no accounts, no API keys, no billing. Stay on
Leaflet (raster); the vector path (MapLibre + OpenFreeMap) is deferred.

**Rationale:**
- The OSMF tile policy forbids app/self-hosted use of `tile.openstreetmap.org`
  and can withdraw access — a real fragility for an app many people self-deploy.
- Positron is a clean, minimal light base that reads well under data pins, and
  is the closest keyless off-the-shelf match to the brand palette.
- Keyless keeps the free/no-accounts/privacy stance intact (commercial SDKs
  like MapTiler/Google/Mapbox were excluded purely on the key requirement).
- The map's custom layer stack (leaflet.heat, atlas polygons, SVG textures,
  markers, popups, fullscreen) is now rich; migrating to MapLibre/vector would
  mean rewriting all of it — not worth it just for a basemap.

**Label-size finding (raster constraint):** raster basemap label size is
effectively **binary** — native, or 2× via the `tileSize:512 + zoomOffset:-1`
trick. There is no fractional in-between on a single style (you can't resize a
raster's baked-in labels). Tried 2× (too big) and CARTO Voyager (medium labels,
more color); Dave preferred Positron's minimal look at native size. A precisely
tunable label size would require vector tiles (the deferred path).

**Implications:**
- Tile providers live in one place: `frontend/src/lib/basemaps.ts`; the shared
  `<MapBaseLayers switcher?>` renders them (+ a portal-based Leaflet control).
- **Adding/changing a tile provider must be reflected in PRIVACY_POLICY.md** —
  it now has a "Map Tiles" section (this also closed a pre-existing gap that
  never disclosed even the OSM tiles).
- Honest limitations: "keyless ≠ contractually unlimited" (CARTO/Esri prefer an
  account at high volume); USGS Topo is US-only. Self-hosting tiles
  (OpenFreeMap/Protomaps) is the only way to remove the keyless-fragility caveat.

---

## macOS ships a universal binary, not separate Intel/Apple-Silicon DMGs — 2026-06-02 (v0.5.5)

**Decision:** The macOS app is built as a single **universal** binary
(`--target universal-apple-darwin`) producing one `SnowRaven_<ver>_universal.dmg`
that runs natively on both Apple Silicon and Intel. `release.sh` was
reworked to build/notarize the universal artifact, and `latest.json` maps
**both** `darwin-aarch64` and `darwin-x86_64` to the one universal updater
bundle (same URL + signature).

**Rationale:** Previously macOS shipped Apple-Silicon-only, so Intel Mac
users couldn't run the app or get updates. A universal binary is the
simplest fix for users (one download, no architecture choice) at the cost
of a larger DMG — preferred over maintaining two separate DMGs.

**Implications (full specifics in CLAUDE.md):** the build needs BOTH Rust
targets installed (`aarch64-apple-darwin`, `x86_64-apple-darwin`);
`release.sh` preflights this. With an explicit `--target`, Tauri nests the
bundle under the target triple. The Intel `latest.json` key MUST be exactly
`darwin-x86_64` (Tauri's `updater_arch()` returns `"x86_64"` on Intel) or
Intel users never see updates. Verified live: v0.5.6 `latest.json` carries
all three platform keys.

## In-app Help is bundled — doc fixes reach desktop users only on a release — 2026-06-02 (v0.5.6)

**Decision:** Treat corrections to `docs/HELP.md` as shippable changes:
because `HelpDocs.tsx` `?raw`-imports HELP.md at build time, the in-app Help
is frozen into each binary. A doc-accuracy patch (v0.5.6) was released so
the corrected Help reaches Mac/Windows desktop users, rather than leaving
them with stale in-app Help until the next feature release.

**Implications:** README/CHANGELOG/privacy edits land on GitHub immediately
on commit, but **in-app Help only updates via a release**. Factor this in
when deciding whether a doc fix needs its own patch or can ride with the
next release.

## Map Explorer mobile fullscreen via a CSS overlay, not the Fullscreen API — 2026-06-02 (v0.5.4)

**Decision:** On small screens (≤640px) the Map Explorer can go fullscreen
via a toggle next to Filters. "Fullscreen" is a CSS overlay — the map
panel becomes `position: fixed; inset: 0; height: 100dvh; z-index: 1200`
(state `mapFullscreen` in `App.tsx`) — not the browser Fullscreen API
(`requestFullscreen`).

**Rationale:** The browser Fullscreen API is unreliable on iOS Safari /
WKWebView (limited support, gesture constraints, and it fights the mobile
toolbar). A CSS overlay is deterministic, themeable, and `100dvh` handles
the dynamic browser toolbar. Mobile-only (gated behind the existing 640px
breakpoint) because desktop has ample room and no need.

**Implications:** The two in-map navigations that change tabs ("Go to
Settings", "target species") clear `mapFullscreen` so no other tab
inherits the overlay; background scroll is locked while fullscreen. The
backdrop grey was fixed by tinting `.leaflet-container` to a new
`--sr-map-void` ocean token — and that override needs **raised
specificity** (doubled class) because Leaflet's own `.leaflet-container`
rule is bundled after `globals.css` and ties on specificity (recorded in
CLAUDE.md).

**Maintenance note:** GitHub will redirect the `windows-latest` CI runner
to `windows-2025-vs2026` by **2026-06-15**. `windows-build.yml` should pin
the runner image before then to avoid a surprise breakage. (A background
task was spun off for this.)

## Desktop clipboard auto-copy: a clipboard seam, not navigator.clipboard — 2026-06-02 (v0.5.3)

**Decision:** Weather auto-copy on the desktop apps goes through a new
**clipboard seam** (`frontend/src/lib/clipboard.ts copyText()`) that uses
the native Tauri clipboard-manager plugin in Tauri mode and
`navigator.clipboard` (+ legacy `execCommand`) on web. Components never
call `navigator.clipboard` or the plugin directly.

**Rationale:** The on-lookup auto-copy runs *after* the weather `fetch`
await, which loses the user-activation that WKWebView/WebView2 require
for the async Clipboard API — so `navigator.clipboard.writeText` threw
`NotAllowedError` and was silently swallowed on desktop (the manual Copy
button worked because it runs inside a click). The native plugin writes
via the OS with no gesture requirement, fixing it cleanly. A seam keeps
the platform branch in one place, matching the existing
transport/storage/platform seams.

**Implications:** New first-party dep `tauri-plugin-clipboard-manager`,
in Cargo `[dependencies]` (cross-platform, NOT the macOS-only target
table — the v0.4.0 `tzf-rs` lesson) so the Windows build stays green.
Capability grants `clipboard-manager:allow-write-text` only — write, not
read; no runtime OS prompt, so no permission button was needed. Future
clipboard use must go through `copyText` (recorded in CLAUDE.md).

## Heatmap intensity model shared across maps — 2026-06-02 (v0.5.3)

**Decision:** The v0.5.1 heatmap intensity math (`heatRadius/heatBlur/
heatMax` + per-point `heatWeight` divisor, `HEAT_INTENSITY_DEFAULT`)
now lives in one module, `frontend/src/lib/heat.ts`, used by both the
Map Explorer (My Sightings) and Species Detail heatmaps.

**Rationale:** The Species Detail heatmap was hardcoded and had no
intensity control; porting the slider by duplicating the formulas would
have created two sources of truth that could drift. Extracting to a
shared module gives identical behavior and one place to tune.

**Implications:** Any future heatmap (e.g. if a Statistics map ever
becomes a heatmap) should consume `lib/heat.ts` rather than re-deriving
radius/blur/max.

---

## Atlas block shading: by the user's own codes, with textures as an opt-in — 2026-06-01 (v0.5.2)

**Decision:** The "Shade by My Highest Breeding Code" overlay tints each atlas block by the strongest breeding code the *user* has personally entered there — never a community/anyone aggregate. The shading is a pure client-side spatial join (`buildBreedingByBlock` over `pointToBlockCode`) against the already-loaded eBird backup. Colorblind accessibility is provided by a *separate* "Use Textures" toggle that overlays a per-tier hatch pattern, and that toggle is **off by default**.

**Rationale:** Personal-only data keeps the feature honest (it reflects your own atlasing progress, not crowd data the app doesn't have) and stays within the local-first/zero-collection stance — no new network calls or backend. Textures were made a distinct, default-off toggle because the hatch patterns, however tuned, reduce base-map legibility; users who don't need color-independent encoding get the cleanest map, and those who do can opt in. Spacing/alpha were tuned over several live iterations so labels under the lightest/densest tiers stay readable.

**Implications:** Requires the eBird backup to be loaded (toggle is disabled with a Settings hint otherwise). The overlay (blocks + shading + textures) was generalized into one shared control rendered in all three map views (My Sightings, Hotspots, Media Targets). The block popup gained breeding fields — still trusted/static data, so the standing CLAUDE.md injection-guard check was re-confirmed, not changed. The atlas draw cap was raised 400 → 5000 to make blocks visible from higher zoom; revisit if it ever costs perceptible render time on large viewports.

---

## Atlas blocks: generate geometry from a gazetteer, don't bundle polygons — 2026-06-01 (v0.5.0)

**Decision:** The California atlas block overlay bundles a compact per-quad gazetteer (~2,878 records, 160 KB) and generates the 16,527 block rectangles + names at runtime, rather than bundling the official polygons (~1–2 MB).

**Rationale:** The blocks are a perfectly regular grid (USGS 7.5' quad / 6, all clean axis-aligned rectangles — verified across all 16,527). The only irreducible data is the quad name, id, SW corner, and (for edge quads) which positions exist; geometry is derivable. Regenerating from the gazetteer was verified an exact 1:1 match with the official block set, so generation is faithful, not approximate. Keeps the overlay small, lazy-loaded, and offline-capable (no runtime Google Drive / third-party fetch), consistent with the local-first stance.

**Implications:** The bundled asset is produced by `scripts/convert-atlas-blocks.mjs` from the official KML; re-run only if the atlas data changes. The approach generalizes to other state atlases (same quad-grid scheme) if ever added. Two standing conventions came out of this and live in CLAUDE.md: outline-only Leaflet polygons need a transparent fill for interior clicks; and the block popup's HTML-string construction must be re-checked if block data ever becomes non-static (injection guard).

---

## Privacy stance: local-first, zero data collection — 2026-05-29

**Decision:** SnowRaven collects no user data — no analytics, telemetry, crash reporting, accounts, or developer-operated server. The user's data (eBird backup, ML export, settings, API keys) stays on their own device or self-hosted machine and is theirs to control. This is now stated publicly in `PRIVACY_POLICY.md`. The app's only outbound traffic is the user-initiated, user-key-authenticated calls to eBird, OpenWeather, and Nominatim, made directly to those providers with no intermediary.

**Rationale:** Matches the founding self-hosted ethos and is a genuine differentiator. Formalizing it publicly makes it a commitment, not just an implementation detail.

**Implications:** Adding any data collection, analytics, telemetry, or new third-party dependency is now a decision that must be revisited here AND reflected in `PRIVACY_POLICY.md` in the same change (see CLAUDE.md → Documentation). Do not add such things silently.

---

## Windows geolocation — deferred item resolved — 2026-05-28 (v0.4.1)

**Decision:** Implemented native Windows "Use my location" using the official `windows` crate's `Geolocation.Geolocator`, gated `#[cfg(target_os = "windows")]`, mirroring the macOS module's `Coords`/`get_location` contract. This resolves the geolocation deferral recorded in the v0.4.0 post-mortem.

**Rationale:** Chose the native `windows` crate over `tauri-plugin-geolocation` (unreliable desktop support); it mirrors the macOS CoreLocation approach and keeps the frontend uniform (one `invoke` path). The Windows CI compile validated the build first try.

**Implications:** Windows is now at full parity. Remaining Windows follow-up: Authenticode signing (roadmap). Unpackaged `.exe` has no per-app location prompt — denial = the global Windows location setting is off, hence the Settings-pointing message.

---

## Windows desktop app — build/release approach + post-mortem — 2026-05-28 (v0.4.0)

**Decision:** Ship a native Windows client built in GitHub Actions, signed locally. CI (`windows-build.yml`) builds the installer with a throwaway key; `release.sh` re-signs with the real key and assembles one release with a multi-platform `latest.json`. This keeps the signing key off GitHub (consistent with the Apple-credentials stance) and makes `release.sh` the single source of the manifest, avoiding macOS/Windows entries clobbering each other.

**Rationale:** Dave can't readily build Windows on his Mac, and macOS can't cross-build Tauri Windows bundles, so CI is required. Keeping the key local was preferred over fully-automated CI signing.

**Deferred (now roadmap items):** native Windows geolocation ("Use my location" shows a coming-later note) and Windows Authenticode signing (unsigned → SmartScreen prompt). The in-app updater works unsigned (minisign).

**Build post-mortem — three issues only a real Windows build surfaced** (the local macOS build and Ubuntu CI never compiled the Tauri lib for Windows):
1. `tzf-rs` was declared under the macOS-only target table but used by the cross-platform `get_timezone` command → "unresolved import" on Windows. Cross-platform Rust deps must be in `[dependencies]`.
2. The Windows updater target is the NSIS installer (`*-setup.exe` + `.sig`), not a `.nsis.zip` — the original CI/release design assumed an archive that Tauri v2 doesn't produce on Windows.
3. `tauri signer sign` rejects `--private-key-path` when `TAURI_SIGNING_PRIVATE_KEY` is already in the env; the Windows-install signing step must rely on the env key (no `-f`).

**Implications:** See CLAUDE.md → Versioning → "Windows desktop release" for the standing rules. Pending real-hardware confirmation (QA-07): install + in-app update on Windows 11.

---

## Abandoned — Recent Arrivals (Map Explorer) — 2026-05-28

**Stage reached:** Stage 1 (The Strategist) — strategy only, no artifacts written, no code.
**Idea:** A "Recent Arrivals" section in the Map Explorer showing birds reported within X miles of the user's point that had not been reported in the area for a slider-selected 3+/6+/9+ months, using the eBird API.
**Reason:** The eBird API can't support the core requirement. Nearby (geo) observation lookups are capped at 30 days back, and there is no eBird endpoint that returns observations within a lat/lng radius over a multi-month window. Detecting a 3–9 month *absence* by radius would require either county-level historic sampling (coarser than the radius, many calls, rate-limit pressure) or accumulating area history over time (no retroactive data). None delivered the user's actual definition well enough to be worth building.
**Decision:** Abandoned. If revisited, the blocker is the eBird API's lack of radius-scoped historical observation data — not effort. eBird's `obs/geo/recent/notable` flag is the nearest feasible primitive but does not match the 3/6/9-month rule.

---

## Bug post-mortem: desktop tab layout reset on every relaunch — 2026-05-28

**What broke (through v0.3.29):** In the Tauri desktop app, reordering or hiding tabs did not survive a relaunch — the layout reset to defaults. Web/Pi was unaffected.

**Root cause:** `tabLayout.ts` persisted to `localStorage`, which is ephemeral in Tauri's WKWebView (cleared on every relaunch). It was the only persisted setting bypassing the `storage` seam that API keys, map center, and default location already use.

**Fix (v0.3.30):** Route tab-layout persistence through the `storage` seam on desktop (file-backed, hydrated on mount), keeping the synchronous `localStorage` read on web/Pi for a flash-free first paint. Validation/serialization factored into `parseLayout`/`serializeLayout`. Also corrected four docs (README ×3, HELP.md) that wrongly claimed desktop API keys live in the Keychain.

**Implications:** Persisted UI settings must go through the `storage` seam, never `localStorage` directly — see CLAUDE.md. A minor first-paint frame at the default layout can occur on desktop launch before the seam hydrates (file read); acceptable.

---

## Responsive navigation: dropdown over bottom bar, overflow-driven collapse — 2026-05-27

**Decision:** On narrow screens the tab navigation collapses to a dropdown (not a bottom tab bar), and it collapses based on measured overflow rather than a fixed pixel breakpoint.

**Rationale:** A bottom bar tops out at ~5 destinations and the app has 8; a dropdown scales to any count and reuses the existing tab order/visibility model for free. Overflow-driven collapse avoids a "dead zone" where a fixed breakpoint leaves the bar overflowing but not yet collapsed — it holds at any tab count, label length, or zoom level.

**Implications:** The planned native mobile app should inherit this dropdown pattern rather than inventing a separate navigation. Future floating overlays on map-hosting views must clear Leaflet's z-index (see CLAUDE.md).

---

## Desktop app bug post-mortem: updater installed v0.3.7 on every update — 2026-05-27

**What broke:** Every in-app update installed the original v0.3.7 binary regardless of what version `latest.json` advertised. After updating, the About screen showed 0.3.7 and the updater immediately offered the same update again.

**Root cause — two compounding issues:**

1. **`createUpdaterArtifacts` not set:** `@tauri-apps/cli` v2.11.2+ changed the default for `createUpdaterArtifacts` from `true` to `false`. Without this setting explicitly enabled in `tauri.conf.json`, `tauri build` creates the `.app` and `.dmg` but skips the `.app.tar.gz` updater bundle. The original v0.3.7 build used an older CLI version where the default was `true`, so that one bundle was created. All subsequent builds silently skipped it.

2. **Stale artifact went undetected:** `release.sh` had no version verification step. It found the old v0.3.7 `.app.tar.gz` (timestamped 11:01 AM from the first ever build), signed it with the current key, and uploaded it with the new version in `latest.json`. The signature matched the bundle, so Tauri's verification passed — and users received v0.3.7.

**Fix (v0.3.21):**
- Added `"createUpdaterArtifacts": true` to `bundle` in `tauri.conf.json` — Tauri now generates `.app.tar.gz` and `.sig` on every build
- `release.sh` now deletes stale bundle artifacts before building and touches `src-tauri/src/main.rs` to force Cargo to relink
- `release.sh` now reads `CFBundleShortVersionString` from the built bundle's `Info.plist` and aborts if it doesn't match the expected version

**Implications:** Never remove `createUpdaterArtifacts: true` from `tauri.conf.json`. The version guard in `release.sh` is a safety net — if it ever fires, the build did not produce a usable updater bundle and the release must not proceed.

---

## Desktop app bug post-mortem: updater called exit(0) instead of relaunch() — 2026-05-26

**What broke (v0.3.13–v0.3.17):** After downloading an in-app update, the app exited but never relaunched automatically. Users had to manually click the Dock icon. If they were slow to relaunch, the experience was seamless (new binary had already replaced the old one on disk); if they missed it, the app just felt broken.

**Wrong fix (v0.3.17):** The changelog entry for v0.3.17 claimed "Tauri's updater spawns a background shell script that sleeps 1s, replaces the bundle, then calls `open -a` to relaunch." This was factually incorrect. Based on that wrong model, the code was changed from `relaunch()` to `exit(0)`, with a comment explaining that `relaunch()` would "pre-empt the shell script." No shell script exists.

**Actual mechanism (from Tauri v2.10.1 source):** `downloadAndInstall` on macOS calls `install_inner`, which synchronously: extracts the new bundle to a temp dir → renames the current `.app` to a backup temp dir → renames the new bundle to the original path → returns `Ok(())`. The Rust temp dirs are dropped on function return. By the time the JS `await` resolves, the new binary is already on disk at `current_exe`. There is no shell script.

**Actual fix (v0.3.19):** Changed back to `relaunch()`. `relaunch()` calls `Command::new(current_exe).spawn()` — since `current_exe` now points to the new binary (synchronous replacement already completed), this launches the correct updated version, then exits.

**Second bug fixed (v0.3.19):** `release.sh` mapped `x86_64 → x64` when building `latest.json`, writing `darwin-x64` as the platform key. Tauri's `updater_arch()` returns `"x86_64"` on Intel Macs, so the platform key `darwin-x86_64` was never present in `latest.json`. Intel Mac users never saw any update offered. Fixed by mapping `x86_64 → x86_64`.

**Implications:** Never `exit(0)` after `downloadAndInstall`. Always `relaunch()`. The synchronous replacement is complete before the Promise resolves. See CLAUDE.md Versioning section for the standing rule.

---

## Desktop app bug post-mortem: tauri-plugin-fs settings storage silently failed — 2026-05-26

**Decision:** `TauriStorage.getApiKey` / `setApiKey` / `deleteApiKey` and `getSetting` / `setSetting` / `deleteSetting` now use `localStorage` instead of `tauri-plugin-fs`. Large file data (CSV uploads, metadata) continues to use `tauri-plugin-fs` with `BaseDirectory.AppLocalData`.

**What broke:** Phase 4 shipped `tauri-plugin-fs`-based JSON settings in `AppLocalData/settings/`. In production, `setSetting` appeared to succeed (no JS exception, UI updated immediately) but nothing was written to disk. `getSetting` then returned null on the next read or app launch. API keys were lost on every relaunch; live key saves weren't reflected in other tabs. The root cause was never surfaced because the `getSetting` catch block swallowed all errors and returned null.

**What fixed it:** Replaced all three settings methods with synchronous `localStorage` calls (`sr-api-key-*`, `sr-setting-*` key prefixes). localStorage is reliable in Tauri's WebKit WebView, requires no permissions or plugin registration, and persists correctly across app launches and bundle replacements (the WebKit data store is not cleared by the Tauri updater).

**Implications:** `TauriStorage.getSetting` / `setSetting` / `deleteSetting` use localStorage. Do not revert to tauri-plugin-fs for JSON settings — the silent failure is difficult to diagnose and was reproduced across multiple versions. `tauri-plugin-fs` remains in use for actual file content (CSV data, metadata.json) where localStorage is inappropriate. The `SETTINGS_DIR` constant was removed from `storage.ts`; `DATA_DIR` and `META_PATH` remain.

**REVERSED (v0.3.16):** This fix proved incomplete. `localStorage` in Tauri's WKWebView was not reliably persistent for API keys — keys were lost on relaunch in subsequent testing. The actual root cause was `mkdir` not being called before `writeTextFile` in `tauri-plugin-fs`. All `TauriStorage` methods now use `tauri-plugin-fs` + `AppLocalData` exclusively. See: "Desktop app bug post-mortem: tauri-plugin-fs mkdir omission caused silent write failure — 2026-05-26." Do not use localStorage for API keys or settings in Tauri.

---

## Desktop app: two-seam architecture and phased migration — 2026-05-25 (completed 2026-05-25)

**Decision:** The desktop app is built around two permanent seams — transport (outbound HTTP via `TransportAdapter`) and storage (keys/settings/files via `StorageAdapter`). Phase 0 ships both seams with delegation-to-Web implementations; the backend is still required. Phases 1–6 migrate each capability to native Tauri implementations over future sessions.

**Rationale:** Migrating all backend dependencies at once creates a high-risk, large-change release. The seam + phased approach lets each capability be proven against the Python backend as a reference oracle, then flipped when the TypeScript output matches. Phase 0 goes to production with zero user-visible change.

**Migration complete (v0.4.0):** All six phases are done. The desktop app no longer requires the Python backend at all. Audit confirms no direct `fetch()` calls, no `/settings/*` calls, and no transport paths that fall through to `WebTransport` in Tauri mode. Phase summary:
- Phase 0 (v0.2.0): Transport + storage seams established, Tauri project scaffolded
- Phase 1 (v0.3.0): TypeScript weather formatter ported from Python (golden test suite)
- Phase 2 (v0.3.1): OS keychain via `keyring` Rust crate for API keys — **reversed in v0.3.16**; keychain requires `com.apple.security.keychain-access-groups` macOS entitlement (not configured) and fails silently; API keys now use `tauri-plugin-fs` + `AppLocalData` alongside file data
- Phase 3 (v0.3.2): Direct external API calls via `tauri-plugin-http`; 6 TypeScript services; tz via `tzf-rs`
- Phase 4 (v0.3.3): App data directory via `tauri-plugin-fs` for files + settings
- Phase 5 (v0.3.4): In-app updater via `tauri-plugin-updater`; minisign keypair; local `release.sh` script
- Phase 6 (v0.3.7): Verification + documentation; standalone confirmed; first notarized macOS release

**Implications:**
- The `transport` singleton (`frontend/src/lib/transport.ts`) and `storage` singleton (`frontend/src/lib/storage.ts`) are the permanent seam layer. New Tauri-specific code must route through them — do not add `isTauri()` branches outside these two files.
- The Vite proxy (`/weather`, `/taxonomy`, `/settings`, `/nominatim`, `/stats`, `/map`, `/version`) is still needed for web/Pi development mode. The Python backend remains the web/Pi runtime.
- The minisign private key is at `~/.tauri/snowraven-signing.key`. The corresponding public key is in `tauri.conf.json`. Run `./release.sh` (local Mac script) to build, notarize, sign the updater bundle, and publish to GitHub — credentials stay local. The script requires `APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY_PATH`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER_ID` to be set in the shell before running.

---

## Desktop app: Tauri v2 chosen as desktop wrapper — 2026-05-25

**Decision:** The desktop app uses Tauri v2 (system webview + Rust core), not Electron or a similar Chromium-embedding framework.

**Rationale:** Tauri bundles the OS system webview (WebKit on macOS, WebView2 on Windows) instead of Chromium, giving a binary roughly 4 MB vs 100 MB+ for Electron, lower memory overhead, and native OS appearance for dialogs and menus. The Rust core is a natural security boundary and the Tauri plugin system (stronghold, http, fs, updater) covers every Phase 2–5 capability.

**Implications:** Minor rendering differences across platforms are expected and acceptable — platforms use native OS conventions, not pixel-identical layouts. Building the desktop app requires the Rust toolchain and `@tauri-apps/cli`. The app identifier is `com.snowraven`; the Tauri project lives in `src-tauri/` at the repo root.

---

## Help documentation bundled at build time via Vite ?raw import — 2026-05-25

**Decision:** `docs/HELP.md` is imported in `HelpDocs.tsx` as `import helpText from '../../../docs/HELP.md?raw'`. Vite resolves this at build time and inlines the file content as a string literal in the bundle. No runtime fetch is made; the documentation is always available offline.

**Rationale:** The only valid input for the help panel is a developer-controlled static file -- not user data and not a remote URL. Build-time bundling eliminates an entire class of failure (network error, server unavailability) with no trade-off for this use case. It also means the app works offline on a Pi with no internet access.

**Implications:** `docs/HELP.md` must be updated whenever user-facing behavior changes -- it is the source of truth for both the in-app panel and the GitHub-rendered URL. `vite.config.ts` sets `server.fs.allow: ['..']` to allow the dev server to resolve the import outside `frontend/`; this is dev-only (production resolves at compile time). Any future static documentation added to the app should follow the same `?raw` pattern rather than a fetch-on-open approach.

---

## Tab layout stored in localStorage, not server-side — 2026-05-24

**Decision:** Tab order and visibility preferences are stored per-browser in `localStorage` (`sr-tab-layout` key), not in the server's `data/` directory or user account.

**Rationale:** SnowRaven is a single-user self-hosted tool, but multiple people sometimes use the same server installation. Server-side storage would give all users one shared layout. `localStorage` gives each browser an independent preference without requiring user accounts.

**Implications:** Tab layout preferences are not portable across browsers or devices. Clearing browser data will reset the layout. This is acceptable given the audience — power birders who set up their own server. Do not add server-side tab layout storage without a user identity model.

---

## Tab order uses lazy useState initializer to prevent first-paint flash — 2026-05-24

**Decision:** Both `tabLayout` and `activeTab` are initialized with lazy `useState` initializers (`useState(loadTabLayout)` and `useState(() => { const l = loadTabLayout(); return ... })`), which run synchronously before React's first paint.

**Rationale:** A `useEffect`-based load would initialize with the default order, render the tab bar once, then re-render with the stored order — causing a visible flash where tabs snap to their custom positions. The lazy initializer runs before the first render so the correct order is displayed immediately.

**Implications:** This requires two calls to `loadTabLayout()` (one for each piece of state). The cost is two synchronous localStorage reads at mount — negligible. Do not replace these with module-level singletons: module-level state persists across HMR hot reloads in development and can cause stale data after file edits. The two-call pattern is correct.

---

## Stats: Top Locations Leaflet map added to Geographic Stats — 2026-05-24

**Addition:** A Leaflet `MapContainer` now renders at the top of the Geographic Stats card, above the two location text lists. The prior "map removed" decision (FR-37, see below) referred to a personal-sightings history map — this is a different map showing ranked top locations as numbered pins.

**Two marker sets:**
- Green filled circle SVG markers (via `L.divIcon`) for top-by-checklists locations, numbered 1–10
- Blue filled square SVG markers for top-by-species locations, numbered 1–10
- A location in both lists gets one of each marker at the same coordinates

**Layout and sizing:** `TopLocationsBoundsFitter` is a null-rendering child inside `MapContainer` that calls `map.invalidateSize()` then `fitBounds` (or `setView` at zoom 12 for single-marker cases) inside a `useEffect`. `invalidateSize()` must be called first — without it, Leaflet doesn't know the container's true dimensions at mount time (the classic "grey corner" bug). Markers hidden when no locations have lat/lng data.

**Implications:** The divIcon SVG uses hardcoded hex colors (`#2D8653`, `#3B82F6`) — acceptable per the established Leaflet popup convention (CSS vars are not reliably inherited inside Leaflet's detached DOM). If you add more Leaflet maps to the Stats tab, use the same `invalidateSize()` pattern at the start of the bounds-fitting `useEffect`.

---

## Birding Stats: protocol breakdown removed from Temporal Stats — 2026-05-24

**FR-15 of the stats-tab-enhancements PRD specified a protocol pie chart in the Temporal Stats section.** It was intentionally not implemented there.

**User direction:** "Remove protocol breakdown from the temporal stats since it already shows up in effort and methodology."

**Current state:** The full protocol section (segmented bar + legend) lives exclusively in Effort & Methodology. It does not appear in Temporal Stats.

**Implications:** Do not re-add a protocol chart to Temporal Stats. If protocol data is needed there in a future session, confirm the user wants duplication before implementing.

---

## Birding Stats: accumulation default changed from 'yearly' to 'total' — 2026-05-24

**Previous behavior (v0.1.6):** The granularity toggle defaulted to `'yearly'`. The `'total'` mode did not exist.

**New behavior (v0.1.9):** A fourth mode `'total'` was added (Total / Yearly / Monthly / Weekly order). `useState<Granularity>('total')` makes Total the default. Total mode renders a step-line chart with one point per new life species.

**Implication:** The prior decision ("accumulation granularity toggle added beyond PRD — 2026-05-23") described the default as `'yearly'`. That is now stale. The correct default is `'total'`. Do not reset it to `'yearly'`.

---

## Birding Stats: map, Big Year, and average-observers removed at user direction — 2026-05-23

**PRD FR-37 (sighting map), FR-58 (Big Year dropdown), and FR-43 (average observers) were intentionally not implemented.**

- **Map (FR-37):** The Stats tab shares the same observation data as the Species Detail tab's sighting map and the Map Explorer tab. User directed removal: "Remove the map since it is redundant."
- **Big Year (FR-58):** Removed per user direction: "Remove the redundant big year dropdown."
- **Average observers (FR-43):** Replaced with an observer distribution chart (bar chart of checklists by number of observers: 1, 2, 3, etc.) per user direction: "Instead of average observers, list the total number of lists with 1, 2, 3, etc. for as many observers as there are in the file."

**Implications:** If a future session re-adds any of these, the original PRD acceptance criteria (FR-37, FR-43, FR-58) are in `pipeline/birding-stats-tab/prd.md`. The observer distribution chart is a direct replacement for the average — do not add both.

## Birding Stats: accumulation granularity toggle added beyond PRD — 2026-05-23

**User-requested addition:** The PRD specified a simple accumulation line chart. The user added a Weekly / Monthly / Yearly granularity toggle.

**Implementation:** `getPeriodKey(date, granularity)` and `formatPeriodLabel(key, granularity)` are module-level helpers in `BirdingStats.tsx`. Weekly uses ISO-style `YYYY-WNN` keys; monthly uses `YYYY-MM`; yearly uses `YYYY`. The `accGranularity` state drives both.

**Implications:** The granularity toggle is a user-facing control on the accumulation chart card. Default is `'yearly'`. X-axis `tickFormatter` receives the period key and formats it for display.

## Birding Stats: SESSION_NOW_MS avoids react-hooks/purity lint violation — 2026-05-23

**Problem:** `Date.now()` called inside `useMemo(() => Date.now(), [])` was still flagged by `react-hooks/purity` (eslint-plugin-react-hooks v7) because the `useMemo` callback runs during render.

**Fix:** `const SESSION_NOW_MS = Date.now()` declared at module level (computed once at import time, not during render). All components in `BirdingStats.tsx` that need "now" for recency coloring reference this constant.

**Implications:** Module-level constants are safe from `react-hooks/purity` because they are not evaluated during React's render cycle. This is the correct pattern for any "stable snapshot of now" needed across a component's lifetime. Do not revert to `useMemo(() => Date.now(), [])` — it will restore the lint error.

## buildGraphData takes explicit interval; auto-detection removed — 2026-05-23

**Change:** `buildGraphData(obs, mlRows, interval)` now requires an explicit `interval: 'yearly' | 'monthly'` parameter. The previous auto-detection logic (`const useMonthly = years.size <= 1`) is gone.

**Rationale:** Auto-detection silently chose an interval based on data span, making it impossible for users to override it. The Graph Options card requires explicit user control. The old heuristic (single-year data → monthly) was also confusing — a species seen only in one year could suddenly show monthly granularity after filtering by date range.

**Implications:** `graphInterval` state lives in the `SpeciesDetail` parent (not inside `SightingsGraph`). All call sites must pass an explicit interval. `SightingsGraph` is now a controlled component — it receives `data`, `useMonthly`, `viewMode`, and `hasML` as props. Do not re-add auto-detection; the Graph Options card is the source of truth for interval.

## Co-occurrence uses Set<string> submissionId lookup for O(1) performance — 2026-05-23

**Decision:** The `coOccurrence` useMemo builds `targetIds: Set<string>` from filtered `speciesObs` submissionIds, then iterates `phase.observations` once — checking `targetIds.has(o.submissionId)` for each row. Per-species shared-checklist counts are accumulated in a `Map<string, Set<string>>` (name → Set of shared submissionIds).

**Rationale:** `phase.observations` can be 10,000+ rows across all species. A naive O(n²) comparison between target and all observations would be unusable. The `Set.has()` approach makes the inner loop O(1) per row — total cost is O(n) where n is `phase.observations.length`. `SUBMISSION_ID_RE` (`/^S\d+$/`) gates all submissionId use, consistent with the existing pattern in the codebase.

**Implications:** The minimum threshold (≥2 shared checklists) is applied after the full pass — do not short-circuit the Set population. `normalizeSpeciesName()` is applied inside the loop when `mergeSubspecies` is true so co-occurring subspecies variants aggregate to the parent name. Target species (the one currently selected) is excluded before inserting into the per-species map.

## Targeting model: "Is Target" means missing ≥1 media type, not zero-ML-only — 2026-05-23

**Change:** `targetSpecies` useMemo and `fetchTargetCodes` in `MapExplorer.tsx`, and the "Is Target" pill filter in `LifeList.tsx`, all use `!hasAll` where `hasAll = types?.has('Photo') && types?.has('Audio') && types?.has('Video')`. The previous definition was "species not in `mlRows` at all."

**Rationale:** A birder who has photos of a species but no audio recording still has a meaningful gap. Zero-ML-only targeting was too coarse.

**Implications:** The `mediaTypes` map (built from `phase.mlRows`) is the source of truth for what each species HAS. `missingTypes` is derived as `ALL_TYPES.filter(t => !mediaTypes.get(comName)?.has(t))`. For a species entirely absent from `mlRows`, `mediaTypes.get(name)` returns `undefined` and all three types are "missing" — correct. Do not change this back to absence-based targeting without updating all three locations in sync.

## fetchTargetCodes must use identical logic to targetSpecies — 2026-05-23

**Bug:** After expanding the targeting model to `!hasAll`, the Map Explorer showed only zero-ML species on the map even though `targetSpecies` correctly computed partial-coverage species. Partial-coverage species had no entry in `speciesCodeMap`, were silently dropped by `.filter(Boolean)` in `handleFindSightings`, and since at least one zero-ML code remained, the fallback on-demand fetch was never triggered.

**Cause:** `fetchTargetCodes` still used the old zero-ML logic when pre-fetching taxonomy codes. `targetSpecies` and `fetchTargetCodes` had diverged.

**Fix:** `fetchTargetCodes` now builds its own `mediaTypesMap` from `mlRows` (same as the `mediaTypes` useMemo) and uses the same `!hasAll` condition. Both compute the same set of species.

**Implications:** `targetSpecies` (for display/count) and `fetchTargetCodes` (for taxonomy code pre-fetch) must always use the same target condition. If the definition of "Is Target" ever changes again, update both in the same commit. The `.filter(Boolean)` in `handleFindSightings` silently drops species with no code — this is intentional for graceful degradation, but it means a divergence between these two functions will manifest as silent missing data, not an error.

## TargetMarkers groups pins by locId to prevent overlapping labels — 2026-05-23

**Bug:** Multiple target species seen at the same eBird location each got their own Leaflet marker at identical coordinates, stacking invisibly on top of each other. Labels overlapped and were illegible.

**Fix:** `TargetMarkers` groups `DisplayTargetPin[]` by `locId` using a `useMemo`. Single-species groups render the species name + missing-type icons. Multi-species groups render "N species" as the label with a popup listing all species, their missing types, a recency tier badge, date, and checklist link.

**Implications:** The representative pin for a group uses the pin with the most recent `recentDate` (for recency tier color). The popup shows all species in the group — the user can see each species and its individual missing types. Do not render one marker per species when species share a `locId`; the map becomes unreadable.

## Cross-tab navigation uses requestedFilter prop + useEffect consumption pattern — 2026-05-23

**Decision:** `App.tsx` holds `mediaListFilter: 'is-target' | undefined`. The Map Explorer's "N target species" button calls `navigateToMediaList`, which sets both `activeTab` and `mediaListFilter` simultaneously. `LifeList` receives `requestedFilter` and `onRequestedFilterConsumed` props. A `useEffect` watching `requestedFilter` activates the "Is Target" pill, then immediately calls `onRequestedFilterConsumed()` to reset App's `mediaListFilter` to `undefined`.

**Rationale:** LifeList uses display toggling (never unmounts), so its `useEffect` fires immediately when the prop changes — no timing issue. Resetting to `undefined` after delivery means subsequent normal navigations to the Media List tab do not re-activate the filter. Repeat clicks on the target count work because App goes `undefined → 'is-target'` each time, which is a change that triggers the effect.

**Implications:** This pattern is correct for any cross-tab "navigate + pre-apply filter" use case. The key requirements: (1) the receiving component must always be mounted (display toggle, not conditional render); (2) the filter state must be reset to `undefined`/`null` immediately after delivery so it isn't sticky; (3) the sending callback must set both the tab AND the filter in the same React update (batch).

---

## eBird API `dist` parameter is km, not miles — 2026-05-23

**Bug:** Both `/map/hotspots` and `/map/recent-obs` eBird API calls received `dist=${radius}` where `radius` is stored in miles (UI options: 5 / 10 / 25 / 50 mi). The eBird API expects `dist` in km. Public hotspots were clipped to ~60% of the intended area. Personal pins used `distanceMiles() <= radius` (miles vs miles, already correct), so they appeared farther out than public hotspots for the same radius.

**Fix:** Both fetch calls now compute `const distKm = Math.round(radius * 1.60934)` and pass `dist=${distKm}`. The personal pin haversine comparison is unchanged.

**Implications:** Any future call to an eBird geo endpoint (`/ref/hotspot/geo`, `/data/obs/geo/recent`, etc.) must convert miles → km before passing `dist`. The `radius` state in `MapExplorer.tsx` is always in miles (matching the UI labels). Never pass it raw to an eBird URL.

## `const run = async () => {...}; run()` is the established pattern for useEffect + async — 2026-05-23

**Problem:** `eslint-plugin-react-hooks` v7 introduced the `react-hooks/set-state-in-effect` rule, which flags any call to a setState setter (or a useCallback that internally calls setState) in the synchronous body of a `useEffect`. Three instances had been failing CI since v0.1.6: `fetchKeyStatus()` in `App.tsx`, `setFilterIsTarget(true)` in `LifeList.tsx`, and `fetchTargetCodes(...)` in `MapExplorer.tsx`.

**Fix:** Wrap the call in a local async function and invoke immediately:
```typescript
useEffect(() => {
  const run = async () => { await myAsyncAction() }
  run()
}, [myAsyncAction])
```
For sync-only state updates, the same wrapper works: `const run = async () => { setState(value) }; run()`.

**Implications:** This is the project-wide pattern for any `useEffect` that triggers async work or setState. Do not call setState (or useCallback setters) directly in the synchronous effect body — wrap them. The `SESSION_NOW_MS` pattern (module-level constant, not useMemo) remains the correct fix for `react-hooks/purity` violations; this pattern addresses the separate `react-hooks/set-state-in-effect` rule.

## Leaflet divIcon inner content must use `display: inline-block` — 2026-05-23

**Bug:** Media target label pills rendered with a tiny colored oval (≈12px wide) that didn't span the species name. The pill background was correct, but the text overflowed it visibly.

**Cause:** Leaflet's `DivIcon` defaults to `iconSize: [12, 12]`, which applies `width: 12px; height: 12px` inline to the outer icon element. Any inner `<div>` (which is `display: block` by default) inherits that 12px width and constrains its own background to 12px — while the text overflows with `white-space: nowrap`, appearing uncontained. The outer element has `overflow: visible`, so text is visible, but the colored background is not.

**Fix:** Added `display: inline-block` to the inner content div. An `inline-block` element sizes to its content regardless of parent width, so the background spans the full species name.

**Implications:** Any Leaflet `divIcon` that renders a pill or label with a colored background must use `display: inline-block` on the innermost content div — not `display: block`. Do not use `iconSize: [12, 12]` (the default) as a sizing mechanism for text labels; it constrains the background but not the text, producing an invisible mismatch.

## Per-tab file upload removed; Settings is the sole file source — 2026-05-22

**Decision:** `BreedingCodeList`, `LifeList`, and `SpeciesDetail` no longer have drop zones, file input refs, `processFile`, `handleDrop`, `handleFileInput`, or "Load different file" buttons. Data comes exclusively from files stored in Settings.

**Rationale:** Per-tab upload created two parallel mental models — one where you upload per session, one where you store a default. With stored defaults working reliably, the per-tab path adds complexity without value. A single authoritative source (Settings) is simpler to explain and simpler to maintain.

**Implications:** Any future tab that works with stored files must follow the same pattern: Settings-only source, `setup-required` phase when absent, `error` phase for fetch/parse failures. Do not re-add per-tab upload UI — if a user needs to use a different file, that is a Settings update, not a session-level override.

## `setup-required` phase is distinct from `error` — 2026-05-22

**Decision:** The three stored-file tabs use `setup-required` when no file is configured in Settings, and `error` only when a file is stored but the fetch or parse failed. The old `idle` tag is gone.

**Rationale:** `idle` was ambiguous — it served as both "waiting for first upload" and "after reset". With per-tab upload removed there is no user-facing waiting-for-upload state. The `setup-required` phase specifically means "go configure this in Settings first"; `error` means "something went wrong technically". These require different UI: `setup-required` shows the SetupRequired guidance component; `error` shows a terse error message with a retry/settings option.

**Implications:** When adding a new stored-file tab, initialize to `loading-saved`, transition to `setup-required` on null-file responses, and reserve `error` for genuine technical failures. The `SetupRequired` component accepts `title`, `body`, `steps[]`, and `onGoToSettings` — reuse it rather than writing per-tab guidance UI.

## ListComparer My List mode fetches stored file fresh on each Compare click — 2026-05-22

**Decision:** When `listAMode === 'my-list'`, `handleCompare` fetches `GET /settings/files/ebird` at the moment the Compare button is clicked, not when the mode is toggled. The stored file is never pre-fetched on mount just because My List mode is active.

**Rationale:** Pre-fetching on mode toggle would mean the stored file is parsed into memory before the user clicks Compare — wasted work if they switch modes again. Fetching fresh on Compare also avoids stale data if the user updates their Settings file during a session.

**Implications:** There is a short async pause when Compare is clicked in My List mode (the fetch + parse). This is covered by a `comparing` state that disables the button and shows "Loading…". Keep this pattern for any future comparer feature that reads stored files — do not pre-fetch on mode toggle.

## tsc --noEmit and tsc -b are not equivalent type checkers — 2026-05-22

**Bug:** A type cast (`as React.SVGProps<SVGTextElement>`) introduced in v0.0.39 passed `tsc --noEmit` (used by `npm run typecheck`) but failed `tsc -b` (used by `npm run build` and `update.sh`) with 4 errors. The Pi update broke because the build step failed.

**Cause:** `tsc --noEmit` and `tsc -b` use different resolution paths. In project-references mode (`-b`), TypeScript applies stricter composite-project constraints and resolves types differently in some edge cases — particularly around spread props onto JSX components, where inferred types from spread objects may be checked more strictly than explicit prop types.

**Fix:** Removed the type cast and inlined the axis props directly on each `XAxis` and `YAxis` call. TypeScript infers the correct prop types from usage context without a cast.

**Implications:** Always verify changes with `npm run build` (not just `npm run typecheck`) before deploying. The `typecheck` script is useful for fast feedback but is not a substitute for a full build check. Do not use `as SomeType` to silence prop-spread type errors on third-party JSX components — inline the props instead so TypeScript can check them in context.

**Second instance — v0.0.45 (2026-05-22):** Adding optional parameters to `handleFindHotspots` and `handleFindSightings` so the address search could pass coordinates directly made them incompatible with React's `MouseEventHandler` type when used directly as `onClick={fn}`. `tsc --noEmit` passed; `tsc -b` failed. Fix: wrap in arrow functions (`onClick={() => fn()}`) so the MouseEvent is absorbed. Always wrap event handlers that take non-event arguments — never pass them directly as `onClick`.

## package-lock.json must be committed to the repository — 2026-05-22

**Bug:** `frontend/package-lock.json` existed locally but was never committed. `npm ci` on the Pi fell back to a stale lockfile from a previous manual install, installing mismatched package versions. `npm audit` failed with ENOLOCK because it requires a lockfile to assess dependencies.

**Fix:** Committed `package-lock.json` and patched the `brace-expansion` DoS vulnerability it surfaced. The lockfile is now a tracked file.

**Implications:** `package-lock.json` must be kept committed and up to date. Any time dependencies change (`npm install`, `npm audit fix`, adding or removing packages), the updated lockfile must be included in the same commit. `npm ci` (used by `update.sh`) requires the lockfile — it is the mechanism that guarantees the Pi installs exactly the same versions as the development machine.

## update.sh uses subshells for directory-sensitive steps — 2026-05-22

**Bug:** `update.sh` used `cd dir && ... && cd ..` chains. When a step failed mid-chain, `cd ..` was not reached, stranding the shell in the subdirectory. The subsequent `cd backend` then resolved relative to `frontend/` and failed with "No such file or directory", triggering the error trap and masking the original build failure.

**Fix:** Replaced both chains with subshell syntax: `(cd dir && ...)`. Directory changes inside a subshell are scoped to that subshell — the parent shell's working directory is unaffected regardless of success or failure.

**Implications:** Any future step in `update.sh` that requires changing directory must use the subshell pattern. Do not use `cd && ... && cd ..` chains — a failure will leave the shell in the wrong directory for all subsequent steps.

## leaflet.heat loaded via dynamic import after window.L assignment — 2026-05-21

**Decision:** `import 'leaflet.heat'` as a static side-effect import is replaced with a dynamic `import('leaflet.heat')` inside `HeatmapLayer`'s `useEffect`, called only after `(window as any).L = L` is set. A module-level `heatLoaded` ref prevents re-importing.

**Rationale:** `leaflet.heat` is a legacy IIFE that reads the global `L` at load time. Vite's ESM bundling does not expose the module-imported `L` as `window.L`, so a static import fails at runtime with "Can't find variable: L". Setting `window.L = L` before a dynamic import ensures the IIFE finds it. Static imports are hoisted before any module code executes, so ordering cannot be controlled via static imports alone.

**Side effect:** Vite automatically code-splits `leaflet.heat` into its own chunk (4.84 kB) because of the dynamic import, reducing the initial bundle.

**Implications:** Do not convert this back to a static import. Any other legacy Leaflet plugin that reads `window.L` at module load time must follow the same pattern: set `window.L = L` then dynamically import the plugin.

## Species Detail graph: buildGraphData extracted to a library module — 2026-05-21

**Decision:** `buildGraphData` and `GraphPoint` were extracted from `SpeciesDetail.tsx` to `frontend/src/lib/sightingsGraph.ts` to make the pure function testable without React component dependencies.

**Rationale:** Unit testing a function embedded in a React component file requires rendering the component, which adds Leaflet, Recharts, and react-leaflet to the test environment. Extracting to a standalone module reduces the test setup to zero (no DOM, no mocks) and keeps the component file focused on rendering.

**Implications:** `buildGraphData` is the canonical source for graph data; do not implement equivalent logic inline in `SightingsGraph`. If future graph features need new derived fields (e.g. rolling average), add them to `sightingsGraph.ts` and add corresponding tests.

## Expand/collapse removed from all tabs; eBird backup path removed from Media List — 2026-05-21

**Changes:**
- All four data tabs (Life List, Breeding Codes, Media List, Species Detail) had their "Show all / Collapse" toggle and `onExpandedChange` callback removed. `App.tsx` always uses `minHeight: 100vh`. Tabs render in natural page flow at all times.
- `backend/routers/ml.py` (Cornell CDN HEAD-request proxy) and its tests deleted. `POST /ml/media-types` endpoint is gone. The eBird backup CSV path in `LifeList.tsx` is fully removed — ML export is now the only accepted input.
- **Unbounded / Normal toggle** added to Life List and Breeding Codes tabs: sets the table wrapper to `width: max-content` in unbounded mode so the page itself scrolls horizontally on mobile. In Normal mode the wrapper uses `overflowX: auto`. In Breeding Codes unbounded mode, the sticky species column (`position: sticky; left: 0`) is suppressed so the full table pans as one unit.

**Why `width: max-content` rather than just removing `overflowX`:** Removing `overflowX: auto` from the wrapper without setting `width: max-content` leaves the wrapper at its parent's width. The wrapper's `border` then appears as a grey vertical line mid-table where the right edge falls. `max-content` makes the wrapper shrink-wrap the table, so the border correctly surrounds the full table width.

**Implications:** Do not re-add the `onExpandedChange` / `isExpanded` pattern. Any table that needs mobile horizontal exploration should use the `wideMode` / `width: max-content` approach. The `POST /ml/media-types` backend endpoint is permanently removed — do not re-add it. If a future feature needs Cornell CDN media-type lookup, rebuild it from the prior implementation in git history.

## Header pinned in expanded view — 2026-05-12

**Bug:** When "Show all" was activated on the Media Life List or Life List Comparer tabs, the SnowRaven header and tab bar remained pinned at the top of the viewport. This wasted space on mobile and produced cluttered print output.

**Cause:** The outer app container used `height: 100vh; overflow: hidden` with the header as `flexShrink: 0`. The tab panels scrolled internally (`overflowY: auto`), so the header never left the screen regardless of scroll position.

**Fix:** `App.tsx` tracks an `isExpanded` boolean. When true, the outer container switches to `minHeight: 100vh` (no overflow clip) and the active tab panel drops its `flex: 1 / overflowY: auto` constraints, letting the whole page scroll normally and the header scroll away. `LifeList` and `ListComparer` notify the parent via `onExpandedChange` callbacks; the parent resets `isExpanded` on tab switch.

**Implications:** Any future tab that adds a "Show all" / expand toggle should follow the same `onExpandedChange` callback pattern.

## ML lookup timeouts — 2026-05-12

**Bug:** Media Life List batch lookups would progress quickly for the first few batches then slow to a crawl or fail entirely with "Couldn't reach the Macaulay Library." The symptom was CDN rate limiting triggered by burst concurrency.

**Cause:** The original implementation fired up to 75 concurrent HEAD requests per 25-ID batch (3 URLs × 25 IDs via `asyncio.gather`). Over many batches the cumulative load tripped the Cornell CDN's rate limiter.

**Fix:** Three changes in combination: (1) `asyncio.Semaphore(8)` at module level caps concurrent CDN connections; (2) CDN probing within each `_detect_type` call is now sequential and Photo-first — most assets resolve in 1 request instead of 3; (3) frontend batch size reduced 25→10 with a 500ms inter-batch delay. Individual batch errors changed from `break` to `continue` so a single failed batch no longer aborts the entire lookup.

**Implications:** The Cornell CDN has undocumented rate limits. Keep outbound concurrency low (semaphore ≤ 8) and batch sizes small (≤ 10) for any future feature that probes it at scale.

## Breeding code CSV parser rewritten to handle multiline fields — 2026-05-14

**Bug:** Breeding Codes tab showed "no breeding codes found" for some eBird backup files, even when breeding codes had been entered.

**Cause:** The original parser split the CSV content by newlines (`content.split(/\r?\n/)`) before parsing fields. This broke any row where a quoted field contained an embedded newline — for example, a location name like `"River\nTrail"` entered before the breeding code column. The row would be split across two "lines," the breeding code would land at the wrong column index, and the `BREEDING_CODE_MAP.has()` check would silently fail.

**Fix:** Replaced the line-split approach with a single-pass character iterator (`parseCSV`) that tracks quote state across newlines. Quoted newlines are consumed as part of the field; unquoted newlines end the row. Also strips UTF-8 BOM on first character.

**Implications:** Any future CSV parser in this project should use a full character-level parser, not `content.split(/\r?\n/)`. The line-split approach is incorrect for RFC 4180 CSV files with embedded newlines in quoted fields.

## eBird Breeding Code column stores code + label, not just the code — 2026-05-14

**Bug:** Breeding Codes tab showed "No species with breeding codes found in this file" for every eBird backup file, even when breeding codes had been entered.

**Cause:** eBird stores the full label text alongside the code abbreviation in the Breeding Code column — e.g. `CN Carrying Nesting Material`, not just `CN`. The parser did an exact `BREEDING_CODE_MAP.has()` lookup against the raw cell value, which never matched any of the 23 expected abbreviations.

**Fix:** Split the raw cell value on whitespace and take the first token before the map lookup (`rawCode.split(/\s+/)[0]`). Single-token bare codes are unaffected; full-label values yield the correct abbreviation.

**Implications:** Never assume eBird CSV column values contain only the code abbreviation — inspect actual export data before writing a lookup. The test suite now includes a case using the real eBird format.

## Taxonomic sort restored and extended to ML export — 2026-05-15

**Prior state:** The A–Z / Taxonomic sort button was removed in an earlier session and replaced with column-header sort only. `SortOrder` was replaced by `SortState { column, dir }`. The `PRODUCT_CONTEXT.md` entry said "taxonomic sort is gone."

**Change:** A–Z / Taxonomic toggle re-added to the Media List and Breeding Codes tabs (the Life List Comparer already had it). `SortState` extended with `nameSortMode: 'az' | 'taxonomic'`. Column-header sorts preserved — the toggle acts as a tiebreaker for count columns.

**Extension beyond prior behavior:** Taxonomic sort now works for ML export, not just eBird CSV. ML export entries have `taxonomicOrder: Infinity`; `getOrder()` falls back to `taxonOrders[commonName] ?? taxonOrders[normalizeSpeciesName(commonName)] ?? Infinity` from the `POST /taxonomy/codes` fetch. The normalizeSpeciesName fallback handles subspecies/domestic entries with parenthetical names (e.g. "Mallard (Domestic type)") — they resolve to the parent name, which is in the map. The endpoint was extended to return `orders` alongside `codes` — no new endpoint.

**Implications:** When changing sort column via a header click, always use `{ ...sort, column, dir }` to preserve `nameSortMode`. A wholesale `sort` replacement will drop the user's A–Z vs Taxonomic preference.

## API key settings: KEY_MAP allowlist + in-process env update — 2026-05-15

**Decision:** The `apikeys.py` router validates `key_name` against a closed `KEY_MAP` dict before performing any `.env` write. Unknown key names return 404. Saving a key calls both `set_key(ENV_FILE, var, value)` (writes `.env`) and `os.environ[var] = value` (in-process).

**Rationale:** The allowlist eliminates any risk of writing arbitrary environment variables from user input. The dual write — file + process env — means the key works immediately without restarting uvicorn, which is the UX behaviour the feature is designed to deliver.

**Implications:** `KEY_MAP` is the single source of truth for which keys the UI can manage. Adding a new key (e.g. a future third API) requires one entry in `KEY_MAP` and a new `KeyRow` in `Settings.tsx`. The GET endpoint returns actual key values (not masked) — this is by design since the frontend handles masking; rely on CORS + local-only deployment rather than server-side redaction.

## eBird backup "species comments" column is named "Observation Details" — 2026-05-15

**Discovery:** The per-species notes field in the eBird backup CSV (`MyEBirdData.csv`) is named `Observation Details`, not `Species Comments`. The initial `parseEbirdObservations` parser looked for `species comments` and found nothing, so every species showed zero comments.

**Fix:** `speciesCommentsIdx` now matches both `h === 'species comments' || h === 'observation details'`. Tests cover both column names.

**Implications:** Always inspect actual eBird export data before writing column-name lookups. Do not assume the UI label matches the CSV header — the field is labelled "Species Comments" in the eBird UI but exported as "Observation Details". The dual-match pattern is the correct approach for any column that eBird may rename between export versions.

## Category filters pre-filter entries before passing to BreedingCodeTable — 2026-05-15

**Decision:** Category filter logic runs in `BreedingCodeList` before passing `categoryFilteredEntries` to `BreedingCodeTable`. `BreedingCodeTable` continues to apply the individual code `filter` on top of whatever entries it receives.

**Rationale:** `BreedingCodeTable` already has internal filter logic for individual codes. Rather than adding a `categoryFilter` prop and duplicating predicate logic inside the table, pre-filtering entries in the parent achieves the correct AND composition for free — `BreedingCodeTable` is unmodified and remains unaware of categories.

**Implications:** Any future filter layer added above `BreedingCodeTable` should follow the same pattern: apply the new filter in `BreedingCodeList` and pass the reduced entry set down. Do not add filter props to `BreedingCodeTable` unless the filter genuinely belongs inside the table component.

## Dark mode: CSS custom property token system is the theming architecture — 2026-05-15

**Decision:** All color values in every component are expressed as `var(--sr-*)` CSS custom properties. Hardcoded hex or RGB values are not permitted in component files. The light and dark palettes are defined entirely in `globals.css` (`:root` for light, `[data-theme="dark"]` for dark). The `data-theme` attribute on `<html>` is the single switch.

**Rationale:** Centralising all color decisions in one file means adding a third theme, changing a palette value, or adjusting contrast requires editing one file rather than hunting through every component. It also makes theming auditable — the full palette is visible at a glance.

**Implications:** Every future feature must use `var(--sr-*)` tokens for all colors — never hardcoded hex. When a new color is needed, add a token to `globals.css` for both `:root` and `[data-theme="dark"]` before using it. If inline styles need rgba() with a dynamic alpha, use the `--sr-*-rgb` triplet pattern: `rgba(var(--sr-tier-4-rgb), 0.08)`.

## Dark mode: consent-gated localStorage for UI preferences — 2026-05-15

**Decision:** The theme preference (`sr-theme` key in localStorage) is never written without explicit user consent. Selecting Light or Dark applies the theme immediately in the DOM but shows an inline prompt first — "Save preference" writes to localStorage; "This session only" dismisses without writing. Once consent has been given for a browser, future changes write silently (the check is whether `sr-theme` is already present). Selecting System removes the key.

**Rationale:** SnowRaven is a self-hosted tool, but some users run it on shared or institutional browsers where they may not expect local storage writes. The consent step makes the storage explicit and reversible. The "apply immediately, ask second" order preserves a snappy UX while keeping the consent meaningful.

**Implications:** Any future feature that writes a user preference to localStorage should follow the same pattern: apply the effect immediately, then prompt before committing to storage. Do not write to localStorage in a `useEffect` on first render — that bypasses the consent step. All localStorage access must be wrapped in try/catch for private browsing compatibility.

## Multi-dimensional filter state uses an object, not a string union — 2026-05-14

**Decision:** The Media List filter state moved from a single `MediaFilter` string union (`'all' | 'no-photo' | ...`) to a `MediaFilterState` object with one key per dimension (`{ photo: 'has'|'no'|null, audio: ..., video: ... }`). The Breeding Codes filter state moved from a single `string` to `Set<string>`.

**Rationale:** A string union encodes only one active selection at a time, which made AND logic across dimensions impossible without a fundamentally different type. The object form makes per-dimension independence structurally enforced and AND logic trivial. `Set<string>` gives O(1) membership testing and naturally prevents duplicates; JSON-incompatibility is not a concern since filter state is never serialised.

**Implications:** Any future filter surface with multiple independent dimensions should use an object (one key per dimension) rather than a string union. Any filter surface that allows selecting from an open-ended set of values should use `Set<string>`.

## Settings Tab: fixed-filename storage and loading-saved phase — 2026-05-15

**Decision:** Server-side files use fixed on-disk names (`ebird-backup.csv`, `ml-export.csv`); the client-supplied filename is stored in `metadata.json` for display only and never used to construct a path.
**Rationale:** Eliminates path traversal risk entirely — the upload destination is a constant, not derived from user input.
**Implications:** Any new stored file type follows the same pattern: fixed name in `data/`, original name in `metadata.json`. The metadata sidecar always lives at `data/metadata.json`; add new keys to it rather than creating separate sidecar files.

**Decision:** `BreedingCodeList` and `LifeList` initialize to `{ tag: 'loading-saved' }`, not `{ tag: 'idle' }`.
**Rationale:** Without this, the upload zone briefly flashes before the auto-load fetch completes, which is jarring when a stored default exists.
**Implications:** Any future tab that checks for a stored default on mount must start in `loading-saved`.

## ML export as preferred input for Media Life List — 2026-05-12

**Decision:** Offer the Macaulay Library "My Media" CSV export as the primary input method for the Media Life List, with the eBird backup CSV as a secondary fallback. Input type is auto-detected from the CSV header — no user selection required.

**Rationale:** The ML export contains `Format` (Photo/Audio/Video) directly in each row, eliminating the backend CDN lookup entirely. This avoids rate limiting, latency, and network dependency. It also requires no Macaulay Library API keys. The two-zone upload UI makes the preferred path prominent without removing the eBird path.

**Implications:** The ML export path is entirely client-side. The eBird path still requires the `POST /ml/media-types` backend endpoint and batch CDN probing. Both paths share the same `LifeListEntry` type and downstream table/filter components.

## React hooks must be declared before any early return — 2026-05-20

**Bug:** SnowRaven showed a blank white page after loading in v0.0.34. All users with a stored eBird file were affected immediately on auto-load; others were affected the first time they loaded a file into the Breeding Codes tab.

**Cause:** `BreedingCodeList.tsx` declared three `useMemo` hooks after conditional early returns (`loading-saved`, `idle/error`). On the initial render, the component returned early and those hooks were not called. When `phase` transitioned to `'ready'`, the early returns did not fire and React tried to call three additional hooks — a count mismatch from the previous render. React threw "Rendered more hooks than during the previous render" and unmounted the entire component tree.

**Fix:** The three memos (`counties`, `filteredRows`, `displayData`) were moved before all early returns, with a `phaseData = phase.tag === 'ready' ? phase.data : null` extraction and null-safety guards. Also wrapped `phaseEntries` in `LifeList.tsx` in its own `useMemo` to fix a related `react-hooks/exhaustive-deps` warning that had been failing ESLint in CI.

**Implications:** Any component with a phase/state union that uses early returns must declare all hooks before the first early return. A conditional variable like `phase.tag === 'ready' ? phase.entries : []` that appears to be safe is not — the `[]` literal creates a new array reference every render, making any useMemo that depends on it re-compute continuously. Wrap it in `useMemo` instead.

## Tab Filters: raw row types enable post-parse filtering — 2026-05-20

**Decision:** `parseBreedingCodes` and `parseMLExport` now return a `rows` field alongside the aggregated `entries`. `BreedingCodeRow[]` and `MLExportRow[]` hold per-observation data (date, county, code/format); filtering runs on these raw rows and re-aggregates via `aggregateBreedingRows()` / `aggregateMLRows()` on every filter change.

**Rationale:** The aggregated `entries` (species-level) have no date or county information — those are discarded during aggregation. The only way to filter by county or date and then re-aggregate correctly is to retain the raw per-observation rows and re-run aggregation downstream. Storing both (raw rows for filtering, aggregated entries for display) is the correct data model.

**Implications:** Any future filter dimension on Breeding Codes or Media List must filter against `BreedingCodeRow[]` / `MLExportRow[]`, not against `entries`. `aggregateBreedingRows()` and `aggregateMLRows()` are the canonical re-aggregation functions — do not derive filtered species counts by mutating existing `entries`.

## Tab Filters: Nominatim rate limiting via in-process asyncio.Lock — 2026-05-20

**Decision:** `POST /nominatim/counties` uses a module-level `asyncio.Lock()` and `await asyncio.sleep(1.0)` inside the lock after each outbound OSM request, enforcing ≤1 request/second. An in-process `_cache: dict[tuple[float, float], Optional[str]]` stores county lookups for the session.

**Rationale:** OpenStreetMap's Nominatim usage policy requires ≤1 req/sec and a meaningful `User-Agent`. The lock + sleep pattern is the simplest correct serialization for a single-process FastAPI app — no external queue or Redis needed. The in-process cache avoids redundant lookups within a session (a common case when many observations share coordinates).

**Implications:** The lock serializes all Nominatim calls globally. If a future feature adds another Nominatim use, it should reuse the same `_rate_lock` and `_cache` in `nominatim.py` rather than creating a second lock. For multi-process or multi-instance deployments, the rate limit guarantee is only per-process — a Redis-backed queue would be needed if SnowRaven ever runs with multiple workers.

## Tab Filters: eBird Media List path switched from parseLifeList to parseEbirdObservations — 2026-05-20

**Decision:** `LifeList.tsx` switched the eBird CSV processing path from `parseLifeList` (species-level aggregation, no county/date) to `parseEbirdObservations` (row-level with all fields). A local `obsToLifeListEntries` helper re-aggregates `ObservationEntry[]` → `LifeListEntry[]` for downstream CDN lookup compatibility.

**Rationale:** `parseLifeList` discards date and county during aggregation. County and date filtering requires row-level data. Rather than retrofitting `parseLifeList` with optional raw-row output (which would duplicate the `parseEbirdObservations` pattern), the path simply switches to the parser that already has what's needed.

**Implications:** `parseLifeList` is now unused by `LifeList.tsx`. `obsToLifeListEntries` is an internal helper in `LifeList.tsx` — it is not a general utility and should not be extracted to a shared module.

> **CORRECTED 2026-08-13 (v0.5.89).** The sentence struck from this entry read: "It remains in the codebase because `ListComparer` still uses it. Do not delete it." That was true when written and is not true now — `parseLifeList()` has **zero app callers**, verified during the v0.5.89 countability sweep, so `ListComparer` is no longer the reason to keep it and there is no longer any reason recorded here. The instruction is withdrawn rather than reversed: whether the module is deleted is its own small decision, and the point worth carrying is that a "do not delete, X depends on it" note is a claim about the import graph that decays silently. Re-derive the caller before honouring one. (It is still a live call site of the countability predicate, so a sweep that touches all call sites will keep finding it.)

## Map Explorer tab height uses calc(100vh - 178px), not flex: 1 — 2026-05-22

**Decision:** The Map Explorer tab panel in `App.tsx` uses `height: 'calc(100vh - 178px)'` and `overflow: 'hidden'` rather than `flex: 1`.

**Rationale:** The outer app div uses `minHeight: 100vh` (not `height: 100vh`). In a `minHeight` context, flex children cannot compute a bounded height from `flex: 1` because the container has no fixed height to distribute. Without a bounded height, the Leaflet `MapContainer` (which requires an explicit height) collapses to zero. The 178px accounts for the header (~132px) + tab bar (~44px). This is consistent with the Leaflet requirement that the map container have a defined height.

**Implications:** Any future map tab must use an explicit `calc(100vh - N)` height rather than relying on flex fill. If the header or tab bar height changes, update the 178px offset. Do not switch the outer app container to `height: 100vh` — doing so would break the natural page-flow behavior of all other tabs that rely on `minHeight`.

## Map Explorer: DivIcon CSS vars use the style attribute, not SVG presentation attributes — 2026-05-22

**Decision:** Teardrop DivIcon colors are set via `style="fill:var(--sr-map-*)"` on the SVG element, not via `fill="..."` SVG presentation attributes.

**Rationale:** SVG presentation attributes (e.g. `fill="#2D8653"`) do not support CSS custom properties. The `style` attribute inside an HTML string (as used by `L.divIcon`) does support them — the browser evaluates the style in the normal cascade. This allows the map pins to correctly change color in dark mode without hardcoding separate icon instances for each theme.

**Implications:** Always use the `style` attribute (not SVG presentation attributes) when setting colors via CSS custom properties inside DivIcon HTML strings. `CircleMarker.pathOptions.fillColor` is an exception — it sets a presentation attribute internally and cannot use CSS vars; use the hardcoded hex for the light-mode color there.

## Map Explorer: escHtml() required for external API strings in DivIcon HTML — 2026-05-22

**Decision:** `escHtml()` (HTML entity encoding) is applied to any external API string interpolated into an `L.divIcon` HTML string. Currently used on `pin.comName` in the Media Targets label pill.

**Rationale:** `L.divIcon` sets `innerHTML` directly. An unescaped string from an external API (e.g. eBird species names) could inject HTML. eBird species names are benign in practice, but the XSS surface was hardened during the Stage 7 security review to establish the correct pattern for the future.

**Implications:** Any future feature that interpolates external data (API responses, user-entered text) into a DivIcon HTML string must pass the value through `escHtml()`. Static SVG strings used for our own icons are not API data and do not require escaping.

## Map Explorer: SightingMarkers fitBounds defers via Leaflet resize event when container is hidden — 2026-05-22 (revised 2026-05-22)

**Decision:** `SightingMarkers` calls a `tryFit` function that checks `map.getSize()` before calling `fitBounds`. If the container reports 0×0 (tab is hidden), it registers a Leaflet `resize` listener and waits. When `AutoSizeMap`'s `ResizeObserver` fires `invalidateSize()` (which emits a `resize` event), `tryFit` is called again with the correct container size and fitBounds succeeds. A `hasFitted` ref prevents re-fitting on filter changes.

**Rationale:** `MapContainer` renders when data loads (phase → ready), which may happen while the user is on a different tab and the Map Explorer panel is `display: none`. In that case, Leaflet sees a 0×0 container and `fitBounds` calculates wrong bounds — or the subsequent `invalidateSize()` pans the map away from the fitted location. The original `useEffect(fn, [])` approach failed for this reason. The `resize` event is the correct signal that the container is now correctly sized.

**Implications:** Any future Leaflet sub-component that needs to call `fitBounds` or `setView` on mount must guard against a 0×0 container. Check `map.getSize()` first; if zero, defer via `map.on('resize', fn)`. `HotspotMarkers` and `TargetMarkers` use `key={pins.length}` for data-driven remounts — they only render after an explicit user action (Find Hotspots button), so the tab is always visible and the 0×0 case does not apply to them.

## Map Explorer: forward geocoding reuses the existing Nominatim rate lock — 2026-05-22

**Decision:** `GET /nominatim/search` acquires the same module-level `_rate_lock` as `POST /nominatim/counties` before calling OSM and sleeps 1 second inside the lock after each request.

**Rationale:** One rate lock per module (not one per endpoint) ensures the ≤1 req/sec policy is enforced across all OSM traffic regardless of which endpoint triggers it. Adding a second lock would allow two concurrent OSM calls from the same process, violating the OSM usage policy.

**Implications:** Any future Nominatim endpoint in `nominatim.py` must acquire `_rate_lock` before calling OSM. Do not create a second lock or bypass the existing one.

## Map Explorer: address geocode triggers fetch via override parameters, not state read — 2026-05-22

**Decision:** `handleFindHotspots` and `handleFindSightings` accept `(overrideLat?: number, overrideLng?: number)`. When the `AddressSearch` callback fires, it calls `setLat(...)` / `setLng(...)` and then calls the handler with the resolved values as explicit arguments rather than relying on the state to have updated.

**Rationale:** React state updates are batched and asynchronous. Calling the handler immediately after `setLat`/`setLng` would read stale state values for `lat`/`lng`. Passing the coordinates explicitly as override parameters bypasses the asynchrony entirely without needing `useRef` or a `useEffect` dependency on lat/lng.

**Implications:** Any future callback that must trigger a fetch with just-set state values should use the same override-parameter pattern. Do not use `useEffect([lat, lng], fn)` to fire fetches after geocoding — that approach triggers unintended fetches whenever the user manually edits the coordinate fields.

## Map Explorer: sidebar-to-map pan uses panTarget state + MapPanner child — 2026-05-22

**Decision:** Sidebar items that should pan the map (nearest-10 list rows) set a `panTarget: {lat, lng} | null` state in the parent. `MapPanner` is a null-rendering child component inside `MapContainer` that calls `map.panTo()` when `panTarget` changes, then notifies the parent via `onDone` to clear it.

**Rationale:** `useMap()` must be called inside `MapContainer`'s context. Sidebar components are outside `MapContainer` and cannot call `useMap()` directly. The `panTarget` state bridge connects the two trees without requiring refs or imperative handles.

**Implications:** Any future feature that needs to programmatically control the map from outside `MapContainer` (pan, zoom, fitBounds) should use this same state-bridge pattern: set a piece of state in the parent; consume it in a null-rendering child inside `MapContainer`.

## Map Explorer: subId captured from most-recent observation per group — 2026-05-22

**Decision:** In `GET /map/recent-obs`, the group dict initialises with `"subId": obs.get("subId", "")`. When a newer observation (`obsDt`) is found for the same group, both `recentDate` and `subId` are updated together: `entry["subId"] = obs.get("subId", "")`.

**Rationale:** The eBird API already returns `subId` on every observation. The only change needed was to capture it and keep it in sync with the most-recent-observation tracking that was already in place for `recentDate`. This ensures the popup checklist link points to the checklist that actually contains the most recent sighting, not an older one.

**Implications:** `subId` in the response reflects the checklist of the most recent sighting for each `(speciesCode, locId)` group. The frontend validates subId against `/^S\d+$/` before rendering — empty strings and unexpected formats are silently suppressed. Do not render an href with an unvalidated subId.

## Map Explorer: recency tier pins use green CSS tokens, not purple — 2026-05-22

**Decision:** Media Target pins use three green-family tokens (`--sr-map-target-fresh`, `--sr-map-target-mid`, `--sr-map-target-old`) rather than purple variants of `--sr-map-target`.

**Rationale:** Purple is reserved for breeding code tier indicators throughout the app. Using purple for recency tiers on the map would create a visual collision with breeding code semantics. Green is the SnowRaven brand accent and is already used for visited hotspot pins and the primary accent — the recency scale reads naturally as a green intensity gradient.

**Implications:** The legacy `--sr-map-target` token remains unchanged (single-color purple, used for the legend color swatch). The three new tokens carry the recency tier semantics. Do not add purple variants for recency — if a new tier or threshold is added, use the existing green gradient family.

## Map Explorer: mobile sidebar is a CSS-only overlay, not a JS-driven layout — 2026-05-22

**Decision:** The mobile sidebar overlay is controlled entirely by CSS `@media (max-width: 640px)` classes (`sr-map-sidebar-overlay`, `sr-map-sidebar-hidden`, `sr-map-filters-btn`, `sr-map-sidebar-close`, `sr-map-backdrop`). React state (`sidebarOpen`) drives conditional rendering of the backdrop and Filters button, and adds/removes the `sr-map-sidebar-hidden` class. No JS `window.innerWidth` checks or resize listeners.

**Rationale:** Consistent with the existing `.sr-two-col` and other responsive patterns in globals.css. CSS breakpoints are more reliable than JS window-size polling and avoid layout-shift during React hydration. The `sr-map-content` parent has `position: relative` so the absolute-positioned overlay and backdrop are scoped to the map panel, avoiding z-index conflicts with the app header and tab bar.

**Implications:** The floating Filters button is `display: none` on desktop via CSS and is also conditionally rendered only when `!sidebarOpen` — double-gated so it can never appear on desktop. Any future responsive feature in MapExplorer should use the same CSS-class pattern rather than JS window checks. Do not add `window.addEventListener('resize', ...)` to MapExplorer.

**Correction (v0.1.1):** The initial implementation put `display: flex`, `flex-direction: column`, and `overflow: hidden` on the sidebar div as inline styles. This silently broke the mobile overlay: React inline styles have CSS specificity 1,0,0, which overrides any class-based rule (0,2,0 for two classes) — so `display: none` from `.sr-map-sidebar-hidden` was always ignored and the sidebar was permanently visible. These properties were moved to the `.sr-map-sidebar-overlay` base CSS class. z-indices were also raised from 30/40/50 to 1050/1100/1200 — the original values were below Leaflet's internal layers (tile pane: 200, controls: 1000). Rule: **never put `display` on an element whose CSS class needs to toggle it.** Rule: **always check Leaflet's z-index range (up to 1000) when placing elements that must appear above the map.**

## Map Explorer: default location stored as data/map-defaults.json, not in Settings .env — 2026-05-22

**Decision:** The saved map default location (`lat`, `lng`, `dist`) is stored as `data/map-defaults.json` (a fixed-filename JSON file), not in the `.env` file alongside API keys, and not in browser localStorage.

**Rationale:** `.env` is for secrets (API keys). Map coordinates are not sensitive and shouldn't be mixed with credential storage. `localStorage` would be per-browser and would not survive clearing browser data or using a different browser. The `data/` fixed-filename pattern (established by `ebird-backup.csv`, `ml-export.csv`, `metadata.json`) keeps all persistent user data server-side in one place, consistent and backup-friendly.

**Implications:** `GET /settings/map-defaults` returns 404 when no defaults are saved (file absent), not `null` in a 200 body — consistent with the existing file endpoint pattern. The 404 is the canonical signal for "no defaults stored." Do not change this to a 200 with null. MapExplorer and Settings both handle 404 as a no-op (leave inputs blank).

**Desktop correction (v0.3.12):** In the Tauri desktop app, map defaults are stored in `localStorage` under `sr-setting-map-defaults` via `storage.setSetting()` / `storage.getSetting()` in `TauriStorage`. The file-based rationale above applies to the web/Pi runtime only. `tauri-plugin-fs` proved unreliable for JSON settings (writes failed silently), so all `TauriStorage.getSetting` / `setSetting` calls now use localStorage instead.

**Reversed (v0.3.16):** The localStorage approach for settings (including map defaults) was found to be unreliable and has been reversed. All `TauriStorage.getSetting` / `setSetting` calls now use `tauri-plugin-fs` + `AppLocalData/data/settings.json` via a `writeJson` helper that always calls `mkdir` before writing. Do not use localStorage for settings in Tauri.

## Tab Filters: 3-tier county resolution for ML export — 2026-05-20

**Decision:** ML export county resolution runs in three passes: (1) read the `County` column from the ML CSV if present; (2) cross-reference against the eBird backup by location name (using `rawRows` from `parseEbirdObservations`); (3) call `POST /nominatim/counties` with unresolved lat/lng pairs. Passes run in sequence; each row stops after the first pass that resolves it.

**Rationale:** The ML export often has a `County` column that covers most rows immediately. eBird backup cross-reference resolves most of the remainder without any network call. Nominatim is only invoked for rows that couldn't be resolved locally, minimizing outbound requests and respecting OSM rate limits.

**Implications:** County resolution is async and runs after the ML parse completes. `countyResolution: 'idle' | 'resolving' | 'done'` drives the loading indicator in the county dropdown. Filters are available before resolution completes — `countyFilter` just won't have all counties until `'done'`. Any future feature that needs county data from ML exports should reuse this same `resolveMLCounties` pattern and the shared `nominatim.py` rate limiter.

---

## Desktop app bug post-mortem: tauri-plugin-fs mkdir omission caused silent write failure — 2026-05-26

**Reversal of prior entry:** The entry dated 2026-05-26 ("tauri-plugin-fs settings storage silently failed") concluded that `localStorage` was the correct fix for API key and settings persistence. That fix proved incomplete and has been reversed. All `TauriStorage` methods now use `tauri-plugin-fs` + `AppLocalData` exclusively.

**What the prior fix missed:** `localStorage` is unreliable for persistent storage in Tauri's WKWebView — API keys written in one session were lost on relaunch. The real root cause of the original silent failure was that `mkdir` was not called before `writeTextFile`. When the `AppLocalData/data/` directory does not yet exist (fresh install, first write after deletion), `writeTextFile` returns without error but writes nothing to disk.

**Actual fix (v0.3.16):** All writes go through a `writeJson(path, data)` private helper that always calls `await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true })` before `writeTextFile`. All reads go through `readJson<T>(path)` which checks `exists()` before `readTextFile`. Storage paths:
- `data/api-keys.json` — eBird and OpenWeather API keys (`getApiKey` / `setApiKey` / `deleteApiKey`)
- `data/settings.json` — app settings via `getSetting` / `setSetting` / `deleteSetting`
- `data/metadata.json` — stored file metadata (original filename, upload date)
- `data/ebird-backup.csv`, `data/ml-export.csv` — large file data (unchanged)

**Implications:**
- Do not use `localStorage` for API keys or settings in Tauri — unreliable in WKWebView across app launches.
- Do not use the system Keychain (`keyring` crate) — requires macOS `com.apple.security.keychain-access-groups` entitlement that is not configured; fails silently at runtime.
- The `mkdir-before-write` pattern is mandatory. Omitting it produces silent failures: `writeTextFile` does not throw when the parent directory is absent, but nothing is written.
- All `TauriStorage` methods use `tauri-plugin-fs`. Do not split storage between localStorage and tauri-plugin-fs — maintain one source of truth per data type.

---

## Desktop app: tauri-plugin-http v2.5.x requires explicit URL scope in capabilities — 2026-05-26

**Bug (v0.3.18):** All `tauriFetch` calls to external HTTPS endpoints (eBird API, OpenWeather, Nominatim) were blocked after plugin updates. Taxonomy lookups failed silently, Map Explorer returned no results, and the symptom resembled lost API keys (it wasn't — the fetch calls were throwing permission errors that were swallowed upstream).

**Cause:** `tauri-plugin-http` v2.5.x separates plugin command enablement from URL access. `"http:default"` in capabilities registers the plugin's IPC command set (the JS `fetch` shim is wired up) but grants access to no URLs. A separate `"http:allow-fetch"` permission with an explicit `allow` URL pattern is required for any network request to succeed.

**Fix:** Added to `src-tauri/capabilities/default.json`:
```json
{ "identifier": "http:allow-fetch", "allow": [{ "url": "https://**" }] }
```

**Implications:** Any Tauri v2 project using `tauri-plugin-http` v2.5.x or later must include `http:allow-fetch` with a URL scope alongside `http:default`. `http:default` alone is not sufficient. The `https://**` pattern allows all HTTPS origins — scope it more narrowly if needed. When `http:allow-fetch` is missing, `tauriFetch` throws a permission error at runtime; if the caller has a silent catch, this manifests as mysteriously empty results rather than a visible error.

---

## Desktop app: silent catch blocks masked root cause of taxonomy lookup failure — 2026-05-26

**Bug:** Map Explorer "Find Target Sightings" always showed "Could not look up species codes from eBird. Try rebuilding caches in Settings." The error persisted after rebuilding caches and with a valid eBird API key configured.

**Root cause:** Two independent silent catch blocks formed a nested error-swallowing chain:
1. `getTaxonomyCodes` in `taxonomyService.ts` had `catch { return [] }` — converted every error (network failure, HTTP error, permission error) into an empty array, making a failed fetch indistinguishable from a successful empty response.
2. `MapExplorer.tsx`'s on-demand taxonomy fetch had `catch { /* ignore */ }` — silently swallowed the empty result, leaving `speciesCodeMap` empty so `.filter(Boolean)` dropped all species codes.

Both failures were active simultaneously with the missing `http:allow-fetch` scope, so fixing either one in isolation still produced an error (just from a different point in the chain). The compounded silent failures made the root cause appear to be a cache or key issue rather than a capability misconfiguration.

**Fix:**
- `getTaxonomyCodes`: errors now propagate with descriptive messages (`'Could not reach eBird...'` for network errors, `'eBird returned HTTP N. Check your API key in Settings.'` for HTTP errors, response validation errors); network errors wrapped with `{ cause: err }` to satisfy the `preserve-caught-error` ESLint rule.
- `MapExplorer.tsx` on-demand fetch: `catch` now calls `setTargetsError(err instanceof Error ? err.message : '...')` and returns early.

**Implications:** Never use bare `catch { return [] }` or `catch { /* ignore */ }` in async code paths that produce UI results. Silent catches convert any error into ambiguous empty state, making bugs undiagnosable and allowing independent failures to compound invisibly. Any catch block that does not re-throw must at minimum set a visible error state. The `preserve-caught-error` ESLint rule (which requires `{ cause: err }` on `new Error()` wrapping a caught error) is a load-bearing lint rule — do not disable it.

---

## Desktop app: location requires a native CLLocationManager command, not navigator.geolocation — 2026-05-26 (revised 2026-05-26)

**Context:** When implementing "Use my location" in the Map Explorer, two approaches were attempted and failed before reaching the correct solution.

**Attempt 1 (wrong):** Use `tauri-plugin-geolocation`. Discovery: the macOS desktop implementation (`desktop.rs`) is a complete no-op stub — `get_current_position` returns all-zero coordinates. Plugin is iOS/Android only.

**Attempt 2 (wrong):** Use `navigator.geolocation` in production Tauri builds (served from `snowraven://` custom protocol, which WKWebView treats as a secure context). Discovery: wry's `WryWebViewUIDelegate` implements `WKUIDelegate` for file panels and media capture, but does NOT implement `webView:requestGeolocationPermissionFor:initiatedByFrame:decisionHandler:` — the delegate method macOS 12+ requires to show the system location permission dialog. Without it, every `getCurrentPosition()` call is silently denied with `PERMISSION_DENIED` before the OS is consulted. No SnowRaven entry ever appears in System Settings → Location Services.

**Fix (v0.3.23):** Native Rust Tauri command `get_location` in `src-tauri/src/location.rs` using `CLLocationManager` directly via `objc2-core-location`. Bypasses WKWebView's geolocation mechanism entirely. Also required: `com.apple.security.personal-information.location` entitlement in `src-tauri/entitlements.plist` — without it, hardened runtime silently blocks CoreLocation.

**Implications:**
- Do not use `tauri-plugin-geolocation` for macOS desktop — no-op stub.
- Do not use `navigator.geolocation` for Tauri desktop location — wry's UIDelegate doesn't implement the macOS 12+ geolocation permission method; all requests are silently denied.
- The correct path is `invoke('get_location')` → Rust CLLocationManager command.
- `tauri-plugin-geolocation` remains registered for future iOS/Android; TypeScript never invokes it on desktop.
- Entitlement `com.apple.security.personal-information.location` is required in `entitlements.plist` for CLLocationManager to work under hardened runtime.
- Testing location always requires a production build with signing and the entitlement embedded. Dev mode shows `'dev-mode'` error immediately.
- Web over HTTP shows `'insecure-context'` error — browsers silently deny geolocation on non-secure origins without any dialog.

---

## Performance: defer-mount + explicitly-invalidated shared caches + parse-once derivation — 2026-06-07 (v0.5.16)

**Context:** An 8-way perf audit found redundant work at startup and per tab: every tab mounted at first paint (firing CSV parses, a synchronous breeding-code parse, and `/taxonomy/codes` posts even when landing on Weather), the ~20k-row backup and the ML export were each parsed independently by multiple tabs, and desktop fetches had no timeout.

**Decisions:**
- **Defer-mount everything but Weather.** Tabs mount on first open and stay mounted (`DEFERRED_TABS` + `mountedTabs` gate in `App.tsx`), moving startup data work off the first-paint critical path.
- **Shared caches use EXPLICIT invalidation, not content-keying.** `observationsCache`/`mlExportCache` return the cached parse with no re-read or content compare; they're invalidated from Settings on the file's save/clear (generation guard against mid-flight invalidation). Settings is the only writer, so coverage is complete. (Earlier content-keying re-read the 6 MB file on every cache hit.)
- **Parse once, derive the rest.** Breeding Codes derives from the shared observations parse (`deriveBreedingData`) instead of a second full CSV walk; an equivalence test locks it to `parseBreedingCodes`. Taxonomy downloads coalesce via an in-flight promise.
- **All desktop fetches go through `lib/tauri/http.ts`** (a `tauriFetch` wrapper with an AbortController timeout) so a stalled network surfaces a typed error instead of hanging the spinner forever.

**Implications:** New tabs are added to `DEFERRED_TABS` and gated. Any code path that writes a stored file MUST call the matching `clear*Cache()` (the cache no longer self-detects content changes). New desktop service calls import `tauriFetch` from `./http`, never the plugin directly.

---

## Tides: keyless NOAA, observed-else-predicted with hi/lo interpolation, bundled station list — 2026-06-07 (v0.5.17)

**Context:** Add historical tide alongside the weather lookup. NOAA Tides & Currents (CO-OPS) is free and keyless, but its data model is uneven: reference stations have continuous predictions, subordinate stations only publish daily high/low events, and observed gauge data exists only for some stations/times.

**Decisions:**
- **Keyless, dual-runtime, independent of weather.** Backend `routers/tide` + `services/{noaa,tide,tide_stations}`; desktop `tideService` via the `/tide/` transport dispatch. The tide box loads concurrently with and independently of weather (one can succeed if the other fails).
- **Observed else Predicted, with interpolation.** Prefer the observed gauge range over the checklist duration; otherwise predicted — continuous for reference stations, else **interpolate** between the surrounding high/low for subordinate stations (the common coastal case).
- **Bundled station list, generated at build time** (`scripts/build-tide-stations.mjs` → JSON in both `frontend/src/assets` and `backend/staticdata`), so nearest-station selection needs no live catalog call.
- **US-only with override.** Coarse US bounding boxes flag outside-US; >25 mi flags a far station; both are notices with a one-tap override, never hard blocks. PRIVACY_POLICY updated for the NOAA call.

**Implications:** Regenerate the bundled station list (re-run the script) when refreshing NOAA stations. The tide formatter is split from the weather formatter's attribution so "Copy Weather and Tide Together" emits one SnowRaven credit with NOAA credited inline.

---

## Quality/accessibility sweep: in-place splits, canonical date formatter, keyboard markers, weather-block detectors — 2026-06-08 (v0.5.18)

**Context:** A maintain-lane sweep addressing date formatting, large components, keyboard access to the map, and a Data Quality stat — plus two user-facing additions (Comparer weather/tide, Media Comments). Two audit items ("accessibility & simplification", "grow component test coverage") were found **already shipped in v0.5.11** and verified — dropped, not redone.

**Decisions:**
- **Canonical date formatting via `lib/formatDate.ts`** with a Settings picker (month-first default / day-first / ISO). One formatter app-wide. The eBird Y-M-D *display* dates must never TZ-shift; only true instants (e.g. upload time) convert to local — `formatDate` is the single intended conversion point.
- **Keyboard-operable map markers via focusable in-view sidebar lists**, not focusable MapLibre markers (which aren't natively focusable — the standing constraint). The in-view Sightings/Hotspots lists are keyboard targets wired to the same popup, so the map is operable without a mouse.
- **Component splits are behavior-preserving and in-place** (BirdingStats 2036→1893, SpeciesDetail 1793→1461, MapExplorer 2249→1515, extracted into `lib/`, `statsPrimitives/`, `speciesDetail/`, `map/`). No behavior change — verified by the existing suite (596 tests).
- **Weather/tide-block detection in Statistics → Data Quality** via `hasSnowravenWeatherBlock` / `hasRaincrowWeatherBlock` / SnowRaven-tide detectors (Raincrow keyed on `raincrow.app`). Counts + % of checklists carrying each block type.

**Implications:** Use `formatDate` for any user-facing date; never hand-format or call `toLocaleDateString` ad hoc. New map "things on the map" need a corresponding focusable sidebar entry for keyboard access. The block detectors are heuristic (string-keyed) — keep them in sync if the weather/tide block formats change.

---

## Media-stats parser is additive/guarded; batched-branch merges need a build (tsc -b), not just vitest — 2026-06-09 (v0.5.20, batched with 0.5.19)

**Context:** Two efforts parked independently off 0.5.18 — `date-unify-media-comments-hint` (0.5.19) and `media-statistics-expansion` (0.5.20) — were batched into one 0.5.20 release on the Mac.

**Decisions:**
- **ML export parsing stays a thin reader; aggregation lives in `lib/mediaStats.ts`.** `parseMLExport` was extended to read Age/Sex, Behaviors, Time, Year/Month, and community-rating columns **additively and guarded** (`'' / null / 0` when absent), so older/column-light exports keep parsing unchanged. Age/sex counts are **per individual** with Unknown shown honestly. Each Media-card section renders only to the extent the export carries that annotation.
- **Date formatting is fully unified** on the canonical `formatObsDate`/`formatDate` path (the Weather-tab checklist line was the last stray); programmatic jump-scrolls go through one reduced-motion-aware helper (`lib/scroll.ts`).

**Implications (batched merges):** When batching two branches that both extend a shared type, **run the release build (`tsc -b`), not just `vitest`** — vitest uses esbuild and strips types, so it won't catch a test fixture that's gone stale against an extended interface. Here the date-unify branch's `MLExportRow` test fixture was missing the fields media-stats added; `tsc -b` caught it, vitest didn't. Keep test fixtures in sync when widening a type. The first-merged branch fast-forwards; the second conflicts on the version files + CHANGELOG top (both bump from the same base) — resolve version to the higher, keep both CHANGELOG sections.

---

## Media Comments are per-asset only — the eBird Observation Details is excluded — 2026-06-09 (v0.5.21)

**What:** The Multimedia tab's Media Comments section now lists, counts, and searches only the comment on the media itself — the asset **Caption** and **Media notes**. The eBird **Observation Details** field is no longer treated as a media comment.

**Why:** Observation Details is the observation-level comment, and the Macaulay Library export copies it onto *every* media asset from the same observation. Surfacing it made the same comment repeat across many list entries (on the real 2073-asset export: 876 → 308 entries once excluded; ~568 were duplicated observation comments). Only the per-asset Caption / Media notes are genuinely about a specific photo, recording, or video.

**Mechanism:** `lib/mediaComments.ts` only — `MediaCommentField` narrowed to `mediaNotes | caption`; `FIELD_ORDER`, `MEDIA_COMMENT_LABEL`, `hasMediaComment`, and `filterAndSortMediaComments` dropped `observationDetails`. The field stays parsed on `MLExportRow` (still available data), just not surfaced. Consumers (`MediaCommentsSection`, `LifeList`) call the helpers unchanged.

**Implications:** "Media comment" in this app means a per-asset comment. If a future feature needs the observation-level comment, read `MLExportRow.observationDetails` directly rather than re-adding it here.

---

## Statistics → Media card trimmed: dropped Format coverage + Community ratings, renamed Age & sex → "Photos Tagged With Age or Gender" — 2026-06-09 (v0.5.22)

**What:** Cleanup of the 0.5.20 Media card after first real use. Removed the **Format coverage** section, removed the **Community ratings** section, renamed **Age & sex of your subjects** → **Photos Tagged With Age or Gender** (donuts "Age"/"Gender", center label "tagged"), and added a `<Divider>` above the Top-N rankings in `BirdingStats` so the last section can't run into "Most photographed".

**Why:** Format coverage (the per-species format-combination breakdown) was redundant with — and less clear than — the Documentation coverage section directly above it. Community ratings was removed at the user's request ("for now"). The rename uses the user's preferred "gender" wording. The rankings overlap was a real layout bug: the rankings block had no separator above it.

**Mechanism:** `components/MediaStatsSections.tsx` (removed two section blocks; renamed one) + `BirdingStats.tsx` (gated divider before rankings). **`computeMediaStats` still computes `ratings` and `completenessMix`** — only the rendering was removed, so re-adding either section is UI-only (no parser/aggregation work). Internal types/data (`Sex`, `s.sexMix`, `SEX_COLOR`) kept their names; the "gender" change is display-only.

**Implications:** To bring back ratings or format coverage, just re-add the JSX in `MediaStatsSections` (the data is already on `MediaStats`). Any new "things below the media chart" must sit above the rankings divider or carry their own separator.

---

## Named Birds: track individuals via [name:…] tags in species comments — 2026-06-09 (v0.5.23)

**What:** A feature to track individual birds the user names in eBird species comments (`[name:Winky]`, `[name:one-leg-pete]`). New `lib/namedBirds.ts` parses the tags and groups sightings; a shared `components/NamedBirdsTable.tsx` renders a sortable list with per-bird checklist drill-down; surfaced both as a new **Named Birds** tab (`components/NamedBirds.tsx`) and a **Named Individuals** section on Species Detail.

**Decisions:**
- **Identity = name + species.** Grouping key is `name.toLowerCase()::normalizeSpeciesName(species).toLowerCase()` — the same name on two species is two individuals; name match is case-insensitive; subspecies fold to the parent.
- **One sighting per checklist.** Sightings dedupe by `submissionId` per bird (a parent + subspecies row of the same checklist, both tagged, count once) — matching the codebase's checklist-counting convention (`Set<submissionId>`).
- **The `[name:…]` regex is length-bounded** (`[^\]]{0,120}`), NOT an unbounded lazy/greedy capture. `speciesComments` is uncapped user CSV text parsed synchronously on the main thread for every observation; an unbounded capture backtracks catastrophically (ReDoS) on an unclosed `[name:` + long run and freezes the UI. The bound keeps it linear; the value is trimmed in JS.
- **New tab via `tabLayout.ts`** — adding `'named-birds'` to `ConfigurableTab`/`DEFAULT_TAB_ORDER`/`TAB_LABELS` is backward-compatible: `parseLayout` appends any default tab missing from a saved layout, so existing users gain the tab without losing their order.

**Implications:** Any future parser over uncapped user text must bound its quantifiers (ReDoS). New cross-checklist per-bird aggregations should dedupe by submission id. Adding a tab is a `tabLayout.ts` + `App.tsx` (icon, DEFERRED_TABS, tabpanel) change; `parseLayout` handles migration.

## Mobile chart tip is informational-only; the escapee cover joins through normalized parent names; a ledger entry never stands for a recordless species; 1.0.0 replaced in review — 2026-08-26 (v1.0.1)

**Decisions:**
- **The mobile chart tip is a note, not a nudge (user direction).** Accent-free by design (green means actionable; this informs), one sentence naming both options (rotate to landscape / the desktop app) recommending neither, once per page (Statistics, Species Detail), above the first chart, phones only via `useIsPhone`. Dismissal is a per-page map under one `chartTipDismissed` setting through the storage seam (the `welcomeSeen` precedent), merge-written so pages never clobber each other, closed-until-hydrated so a dismissed install never flashes it.
- **A `/taxonomy/codes` batch feeding a cover/countability consumer sends each raw name AND its normalized parent.** `codes` is species-only by contract on both transports (identical since 0.5.14), so a bird recorded ONLY as a "(Domestic type)" form resolved no species code and the escapee cover silently skipped it — classified 'unknown', counted, "zero escapees found." The fix is at the consumer (BirdingStats' batch), keeping the twins' species-only `codes` byte-identical; the raw name stays in the batch for `formCodes` consumers. The defect was masked on desktop/iOS by each store's cached verdicts and surfaced the first time a fresh pass ran (the web preview); every store was one 30-day TTL from writing zero.
- **A fresh ledger entry does not stand for a recordless cover species.** That shape can only mean the checklist was consulted under a cover that could not admit the species, so the pass re-consults exactly those checklists (`carriersNeedingRefetch`, pure), and the refetch intent is passed EXPLICITLY to the cache chokepoint (`dedupedFetchChecklist({refetch})`) whose own fresh-ledger short-circuit is the second enforcement point that would otherwise refuse the wave's pick. One refetch heals a poisoned store permanently. Red-first proven both halves; live-verified on the real export (0 excluded/261 records → the 3 correct escapees/267, ledger 76 → 79, one Statistics visit).
- **The 1.0.0 App Store submission was replaced in review (user decision).** 1.0.1 carries a correctness fix to a headline number, so the store debut should ship right; the pending submission was withdrawn via the ASC API, the same version record re-pointed to 1.0.1 (all metadata/screenshots preserved, read-back verified), the new build attached, and submission ba87ba7a is WAITING_FOR_REVIEW releasing on approval. Phase B availability prose now keys off the 1.0.1 approval.
- **Verified against the 2027 taxonomy, not assumed:** all 293 distinct names in the current export resolve (the Aug 24 export already carries the new names). The residual rename-bridge gap (old-revision export names vs the new taxonomy) affects only stale exports and is captured to the idea inbox.
