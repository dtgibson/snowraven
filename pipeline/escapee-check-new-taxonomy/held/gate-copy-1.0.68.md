# Held copy for the 1.0.68 production sign-off (escapee-check-new-taxonomy re-entry)

Prepared by The Deployer at the 1.0.68 prep, 2026-11-08 PST. Nothing below is written into a live file or into App Store Connect until the user says yes at the gate. Both renderings are exactly what would be published, byte for byte.

## (a) F-Droid "What's new" for 1.0.68

Source: `held/whats-new-1.0.68.txt` alone (216 characters; the file is 217 bytes with its newline, SHA-256 `358bc78007ec5db571daacaef328c8e3ead614ca654f58530047672b2a8e142a`). Limit 500.

Written on the yes by `bash pipeline/escapee-check-new-taxonomy/bump-1.0.68.sh held` as three identical files, `fastlane/metadata/android/en-US/changelogs/10000681.txt`, `10000682.txt` and `10000684.txt`, none under the unsplit `1000068`. It must be in the `v1.0.68` tag, since F-Droid reads the folder there.

Precedent (1.0.65): a version's F-Droid changelog carries its own text only. 1.0.67 is expected to end superseded on F-Droid by 1.0.68.

```text
When eBird's public data has no answer for one of your species, such as a sighting eBird has not yet confirmed, the escapee check now reads as finished on both Statistics and Life Lists, and the species still counts.
```

## (b) App Store "What's New" for the new 1.0.68 version record

The house rollup form: 1.0.67's approved text, a blank line, then 1.0.68's text. Store users are on 1.0.66 and never received 1.0.67's note, because 1.0.67 has no record of its own (D-03). That makes 571 characters (353 + 2 + 216), ASCII only, no em dash, SHA-256 `c885c3f1697cc002b4021e444f1d9d599a426a09f3a3bf36f1188797b50e593b`. The limit is 4,000. It would be written in one localization `PATCH` on the new record and read back byte for byte.

- The 1.0.67 part is `held/whats-new.txt` without its newline: 353 characters, approved at the 1.0.67 sign-off.
- The 1.0.68 part is `held/whats-new-1.0.68.txt` without its newline: 216 characters, NOT yet approved.

```text
The Statistics tab's escapee check now settles the species a backup downloaded before eBird's 2026 taxonomy update still calls by their old names, such as Willet and Marsh Wren, by matching them with eBird's answers under the names that update gave them. When a species is still open, the line under the Species figure now names it, and it still counts.

When eBird's public data has no answer for one of your species, such as a sighting eBird has not yet confirmed, the escapee check now reads as finished on both Statistics and Life Lists, and the species still counts.
```

## Wording check (nothing changed)

- No em dash, no non-ASCII character, and American spelling throughout. Each text is one plain sentence or two, in the register of the earlier notes.
- The tab names match `TAB_LABELS`: "Statistics" and "Life Lists".
- **No change I would make.** Read together, 1.0.67's "When a species is still open, the line ... now names it, and it still counts." and 1.0.68's "now reads as finished" are consistent for 1.0.68: the finished line names the species as well, and the still-open line remains for the rare cases at the caps.

## Gate answer (2026-11-08 PST)

The user answered the production sign-off for 1.0.68 with "Confirm: deploy 1.0.68 now", approving word for word the F-Droid changelog (held/whats-new-1.0.68.txt, 216 characters) and the App Store What's New rendering (1.0.67's approved text, a blank line, then the 1.0.68 sentence; 571 characters) in held/gate-copy-1.0.68.md.
