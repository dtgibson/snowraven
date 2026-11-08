# Held release copy, 1.0.64 (exotic-provenance-reuse)

**Status: APPROVED (2026-11-07).** The user answered the production sign-off gate themselves with "Approve the text and ship 1.0.64", approving the text below exactly as drafted (217 characters; relayed by the coordinator). The three F-Droid files were written from `fdroid-changelog.txt` in the release commit; the App Store What's New is written on the 1.0.64 record in Phase B2. Published copy is written only after the user reads it and approves it (CLAUDE.md, "Published copy needs the user's approval first").

This release changes no other published copy: no `README.md`, `website/` (beyond the version pill and footer, which are not copy), `appstore/LISTING.md` or `PRIVACY_POLICY.md` change (decisions.md, D-05).

## The text (one text for both stores)

> The Statistics tab's escapee check no longer asks eBird about the same checklists every time you open the app. When eBird's answers leave out some of your species, the check now says so, and those species still count.

217 characters, ASCII, no em dash, American spelling. Nothing in it is Apple-only, so the F-Droid text is the What's New unchanged.

A shorter form, if the user prefers one sentence (the 1.0.62 precedent, where the user kept the first sentence of the proposal): "The Statistics tab's escapee check no longer asks eBird about the same checklists every time you open the app."

## Where it goes on a yes

| Held file | Target | How |
|---|---|---|
| `fdroid-changelog.txt` (218 bytes with its newline, SHA-256 `230d48081af75c18de9a817235aeed5f0a12e7597fe96bfdbf214c01fdcbc7c1`) | `fastlane/metadata/android/en-US/changelogs/10000641.txt`, `10000642.txt`, `10000644.txt` (the three per-processor codes of versionCode 1000064; none under `1000064.txt`) | Copy byte for byte into all three, in the release commit, BEFORE the tag: F-Droid reads the folder at the tagged commit. |
| `whats-new.txt` (the same sentence pair) | The App Store "What's New" on the new 1.0.64 version record (en-US localization), written through the App Store Connect API | One `PATCH` of the localization's `whatsNew` with the text WITHOUT the trailing newline (217 characters), read back byte for byte after the write and again after submitting. |

If the user changes the wording at the gate, both files are replaced with the approved text before anything is written, and the hash above is re-taken.
