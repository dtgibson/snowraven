# The fdroiddata merge request (first Android release only)

**Status: OPEN since 2026-10-06: https://gitlab.com/fdroid/fdroiddata/-/merge_requests/51451.** The Deployer opened it on the user's word, from the user's fork `snowraven/fdroiddata`. The fork was created private inside the user's then-private `snowraven` group; at the user's request the Orchestrator made the group and the fork public the same day, and the request's description now ticks that item. Its pipelines stop before any job runs: GitLab says "The pipeline failed due to the user not being verified." As F-Droid's checklist asks, no phone number or card was given; a note on the request asks a maintainer to trigger the CI. "Opened" below records how it was done. This is the one-time request that asks F-Droid to include SnowRaven (android-release FR-59, schema 6.5). It is opened under your own GitLab account, by you, or by the Deployer on your explicit word. After it is merged, F-Droid's update checker finds every later `vX.Y.Z` tag by itself, so nothing goes to fdroiddata per release unless the recipe itself changes (a toolchain pin, in the release skill's Android section).

Review usually takes weeks. On the day of the first ship, the Android download is the signed APK on the GitHub release; the F-Droid listing follows when the request is merged and F-Droid has built the app.

## Ready for 1.0.53 (filled in at the ship)

- **The file to paste:** https://github.com/dtgibson/snowraven/blob/v1.0.53/pipeline/android-release/fdroid/com.dtgibson.snowraven.yml, then **Raw** (direct: https://raw.githubusercontent.com/dtgibson/snowraven/v1.0.53/pipeline/android-release/fdroid/com.dtgibson.snowraven.yml).
- **Its SHA-256**, so you can check the pasted file: `2391a9296e44c2b472a98be4a0f2be990b38f3862e795155ed8bb5958bb1342d`. The raw URL above serves exactly these bytes, which equalled the repository's recipe on 2026-10-05; the next item says what changed when the request was opened.
- **Its first build entry:** `versionName: 1.0.53`, `versionCode: 1000053`, `commit: v1.0.53`. **Superseded when the request was opened:** F-Droid's checklist asks for the full commit hash, never a tag, so the entry now reads `commit: c4c15a9624c299f62bf3f82af7f111750666b579` (the commit `v1.0.53` names), in the fork's branch and in the repository's recipe alike (SHA-256 `3496c0f8c8cac9b1f94730607c75c5f2345abb3a0cc1005de99b1440b623209e`).
- **Branch:** `com.dtgibson.snowraven`. **Commit message and merge request title:** `New app: SnowRaven (com.dtgibson.snowraven)`.
- **The five checks below are all done for 1.0.53:** (1) the recipe names 1.0.53 / 1000053 / `v1.0.53`; (2) your approved `NonFreeNet` sentence and category are in it; (3) the Fastlane folder is at the tag; (4) `v1.0.53` is pushed and its Android CI run (`37412478083`) is green; (5) on the tagged recipe, `fdroid lint -f --force-yamllint` found nothing, `rewritemeta -l` listed nothing, `scanner -e` found 0 problems, `build -v -l` printed `Successfully built version 1.0.53 of com.dtgibson.snowraven from c4c15a96...` (an unsigned APK with the same package, version, ABIs and permissions as the GitHub APK), and `checkupdates` found 1.0.53 (1000053) from the tag. All of these ran with fdroidserver 2.4.5 on 2026-10-05. The `sudo:` block was not among them: it cannot run on this Mac, so the description's last paragraph says the merge request's pipeline is its first run.
- **The GitHub APK is already out** on the v1.0.53 release, signed with your key. F-Droid will sign its own build with its own key, so the two do not update each other (Help says so).

## Before you open it

Each of these happens in the SnowRaven repository, before the tag, because F-Droid reads the tagged commit:

1. The version bump has set the recipe's `versionName`, `versionCode`, `CurrentVersion` and `CurrentVersionCode` to the shipping version (`fdroidRecipe.test.ts` goes red if they disagree with `tauri.conf.json`), and `commit` is the FULL 40-character hash of the commit the tag names (`git rev-parse vX.Y.Z^{commit}`), never the tag itself. A commit cannot carry its own hash, so the hash goes in after the tag is pushed (the guard checks the shape only).
2. The `NonFreeNet` sentence and the category you approved in `held-copy.md` are in the recipe (it is listing copy, so it takes your yes like the rest).
3. The Fastlane folder you approved is at `fastlane/metadata/android/en-US/` (without it the listing has no description until the next tag).
4. The tag `vX.Y.Z` is pushed, and the Android CI run on it is green.
5. The local F-Droid checks in the release skill passed on that recipe: `fdroid lint -f --force-yamllint`, `fdroid rewritemeta -l`, `fdroid scanner -e` and `fdroid build -v -l`.

## Open it: the web route (no clone needed)

1. Sign in at https://gitlab.com with your own account.
2. Open https://gitlab.com/fdroid/fdroiddata.
3. Press **Fork**, and fork it into your own namespace.
4. In your fork, open the branch menu and create a branch named `com.dtgibson.snowraven` from `master`.
5. On that branch, open the `metadata` folder.
6. Press **+**, then **New file**.
7. Name the file `com.dtgibson.snowraven.yml`.
8. Paste the recipe exactly as committed at the tag: `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` at `vX.Y.Z` (on GitHub: `https://github.com/dtgibson/snowraven/blob/vX.Y.Z/pipeline/android-release/fdroid/com.dtgibson.snowraven.yml`, then **Raw**).
9. Make sure the pasted file ends with one newline and nothing after it.
10. Commit message: `New app: SnowRaven (com.dtgibson.snowraven)`
11. Commit to the `com.dtgibson.snowraven` branch.
12. Press **Create merge request**.
13. Source: your fork's `com.dtgibson.snowraven`. Target: `fdroid/fdroiddata`, branch `master`.
14. Title: `New app: SnowRaven (com.dtgibson.snowraven)`
15. If GitLab offers a description template for new apps, pick it, then put the text below under it, answering its checklist with the facts below.
16. Paste the description text below.
17. Press **Create merge request**.
18. Copy the merge request's URL for the ship record.

## Or: the command-line route

Run in a scratch folder outside the SnowRaven repository, replacing `<you>` with your GitLab user name and `vX.Y.Z` with the shipping tag (for this release, `v1.0.53`):

1. Fork https://gitlab.com/fdroid/fdroiddata into your namespace (step 3 above).
2. `git clone --depth 1 https://gitlab.com/<you>/fdroiddata.git`
3. `cd fdroiddata`
4. `git switch -c com.dtgibson.snowraven`
5. `git -C ~/devwork/snowraven show vX.Y.Z:pipeline/android-release/fdroid/com.dtgibson.snowraven.yml > metadata/com.dtgibson.snowraven.yml`
6. `git -C ~/devwork/snowraven show vX.Y.Z:pipeline/android-release/fdroid/com.dtgibson.snowraven.yml | shasum -a 256`
7. `shasum -a 256 metadata/com.dtgibson.snowraven.yml` (must print the same hash as step 6)
8. `git add metadata/com.dtgibson.snowraven.yml`
9. `git commit -m "New app: SnowRaven (com.dtgibson.snowraven)"`
10. `git push -u origin com.dtgibson.snowraven`
11. Open the link Git prints, and continue from step 13 of the web route.

## The merge request description

```markdown
SnowRaven is a birding companion for your own eBird and Macaulay Library exports: weather and tides for your checklists, your history with every species, life-list statistics, a calendar of your birding and an interactive map. I am its author, and this request adds my own app.

- Source: https://github.com/dtgibson/snowraven (AGPL-3.0-only; `LICENSE` at the root)
- Website: https://snowraven.dtgibson.com/
- Releases are tagged `vX.Y.Z`; the recipe reads the version and version code from `src-tauri/tauri.conf.json` at each tag (`UpdateCheckMode: Tags`, `AutoUpdateMode: Version`).
- The listing text, icon, screenshots and per-release changelogs are in the repository at `fastlane/metadata/android/en-US/`.
- No Google services, no Firebase, no analytics, advertising or crash-reporting library. Nothing from `com.google.android.gms`, `com.google.firebase` or Play is in the build.

Three things in the recipe that look unusual, and why:

1. **The Rust toolchain and the Tauri CLI are installed under `/opt` in `sudo:`.** SnowRaven is a Tauri 2 app. Gradle's Rust tasks call back into the Tauri CLI (`cargo tauri android android-studio-script`), which needs its parent `cargo tauri android build` process, so the build cannot be a plain `gradle` build. The CLI is compiled from crates.io (`cargo install tauri-cli --version 2.11.2 --locked`); no prebuilt binary is fetched. The real binaries are linked into `/usr/local/bin` so the unprivileged build user needs no rustup environment.
2. **`prebuild` builds the web frontend, then removes `frontend/node_modules`.** The frontend is compiled to `frontend/dist` before the scan, which the Rust build embeds; the Node toolchain is not needed after that, and removing it keeps the scan clean of the bundler's native binaries. `scandelete` names only `src-tauri/dmg/dmg-DS_Store`, the macOS disk-image layout file, which the Android build never reads.
3. **`NonFreeNet` is self-declared.** The app works with the user's own eBird and OpenWeather API keys; the reason sentence is in the recipe and in the description.

`fdroid lint`, `fdroid rewritemeta`, `fdroid scanner` and `fdroid build -l` pass locally with fdroidserver 2.4.5 on macOS. The `sudo:` block could not be run locally (the buildserver image does not run on Apple silicon), so this merge request's build job is its first run; I will fix anything it finds in this branch.
```

## F-Droid's checklist, as answered on the request (2026-10-06)

The request's description is F-Droid's own "App inclusion" template (`.gitlab/merge_request_templates/App inclusion.md` in fdroiddata), with the description above appended under "About this app". Each item, and why it is ticked or not:

- **Ticked, true as written:** the inclusion criteria; the author notified (with "I am the author."); the Fastlane folder in this repository (en-US, title, both descriptions, icon, phone and ten-inch screenshots, a changelog per version code); the four Docs items; the "New app: app name" title; the Git guide; related issues referenced (none exist: no RFP or fdroiddata issue names SnowRaven); one app per request; the metadata at `metadata/com.dtgibson.snowraven.yml`, valid YAML, LF line endings; no unrelated files (the only file in the request is the recipe); tagged releases with auto update; an issue tracker and contact (`IssueTracker`, `WebSite`, `SourceCode`); `AuthorName`; only the latest version; no disabled versions; and `commit` as the full hash.
- **The fork-public item**, at first unticked because GitLab refused to make a fork in a private group public ("public is not allowed in a private namespace"), **is ticked since the Orchestrator made the group and the fork public at the user's request** (2026-10-06); the branch itself is not protected.
- **Not ticked, each with its reason on the request:** external repos as submodules (not applicable: none, and no srclibs); reproducible builds (not enabled for this first release, with the user's sentence: F-Droid signs its own build, and the author-signed APK stays on GitHub for sideloading); ABI split (one universal APK, as on GitHub); and the three pipeline items, because no pipeline has run.
- **A consequence of not enabling reproducible builds, worth knowing before it is merged:** F-Droid's note on that item says that once its build is signed with F-Droid's key, reproducible builds cannot be enabled later for this app id.

## The pipeline to watch

1. On the merge request page, open the **Pipelines** tab.
2. The lint and formatting jobs check the recipe with `fdroid lint` and `fdroid rewritemeta`; they should pass, since the same checks passed locally.
3. The build job runs the recipe on F-Droid's own build image, `sudo:` block included. It is the only place that block has ever run, and it can take a long while (the recipe allows three hours).
4. GitLab may ask you to verify your account before it runs a pipeline on your fork; that is GitLab's own step.
5. If a job fails, open its log and send the failing lines to the Deployer (or paste them into a new session).
6. A fix to the recipe is a new commit on the same `com.dtgibson.snowraven` branch, which re-runs the pipeline. Make the same change to `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` in the SnowRaven repository, so the two stay equal.
7. A failure here never blocks the GitHub APK; the release goes out without waiting for it.
8. Reviewers may ask questions in the merge request; answer there.
9. When it is merged, F-Droid builds the app on its own schedule; the listing appears at https://f-droid.org/packages/com.dtgibson.snowraven/ after a later index update, often days afterward.

## Instead of a merge request: a Request For Packaging

If you would rather not open and maintain the merge request yourself, you can ask F-Droid's volunteers to package the app. An RFP waits for a volunteer to pick it up, so it is usually slower than the merge request, and the volunteer would then open a merge request much like the one above.

1. Open https://gitlab.com/fdroid/rfp/-/issues.
2. Press **New issue**.
3. Title: `SnowRaven`
4. If GitLab offers an issue template, pick it and fill it in with the facts below.
5. Paste the text below.
6. Press **Create issue**, and copy its URL for the ship record.

```markdown
* Name: SnowRaven
* Summary: Birding tools and data explorer for your eBird and Macaulay Library exports
* Category: Science & Education
* License: AGPL-3.0-only
* Source code: https://github.com/dtgibson/snowraven
* Website: https://snowraven.dtgibson.com/
* Issue tracker: https://github.com/dtgibson/snowraven/issues
* Changelog: https://github.com/dtgibson/snowraven/blob/HEAD/CHANGELOG.md
* Anti-features: NonFreeNet (eBird and OpenWeather, with the user's own API keys)

I am the author. The repository already carries a tested fdroiddata recipe at `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` and Fastlane metadata at `fastlane/metadata/android/en-US/`. It is a Tauri 2 app (Rust and a web frontend); why the recipe installs its toolchain the way it does is written up in `pipeline/android-release/fdroid/merge-request.md`.
```

## What the Deployer records

At the first Android ship, CLAUDE.md's Android record line and `pipeline/android-release/decisions.md` each carry one of these, never silence:

- Opened: `fdroiddata merge request opened at <version> (<date>): <merge request URL>.`
- RFP instead: `fdroiddata RFP opened at <version> (<date>): <issue URL>; no merge request from us.`
- Deferred, in exactly this form:

```text
fdroiddata merge request deferred at <version> (<date>): <reason>; opens when <condition>.
```

For example: `fdroiddata merge request deferred at 1.0.49 (2026-10-10): the user chose to ship the GitHub APK first and open the request after a week of feedback; opens when the user says go, at the next ship at the latest.`
