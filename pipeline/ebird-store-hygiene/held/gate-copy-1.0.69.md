# Held copy for the 1.0.69 production sign-off

**Status: HELD.** Nothing below is written into a live file or into App Store Connect until the user approves it at the production sign-off (CLAUDE.md, "Published copy needs the user's approval first"). Prepared by The Deployer at the 1.0.69 prep, 2026-11-09 07:50 UTC (2026-11-08 23:50 PST).

## (a) F-Droid "What's new": three new files

`fastlane/metadata/android/en-US/changelogs/10000691.txt`, `10000692.txt` and `10000694.txt`, each this one line plus a newline (370 bytes, SHA-256 `ec1f42d51076b1a4c890c1fe88b57897795ba3e83318966c76f3c5ed4feb7e6a`, 369 characters, under F-Droid's 500). They must exist at the v1.0.69 tag.

> Life Lists now lists naturalized and provisional exotics by default, as eBird and the Statistics tab count them; turn off Include Exotics to leave them out. A saved Projects or Recent activity answer dated more than a day ahead of your device's clock is now asked for again, and a checklist answer from eBird that cannot be read now shows SnowRaven's own error message.

## (b) App Store What's New

1.0.68 read `WAITING_FOR_REVIEW` at 07:45:45 UTC (record `280db18b`, submission `a22d8c52`), so the proposal is the house rollup: 1.0.68 is withdrawn and its record carries 1.0.69. Store users are on 1.0.66 and have seen neither 1.0.67's nor 1.0.68's note, so the text is the record's own approved text (1.0.67's note, a blank line, 1.0.68's note; 571 characters, SHA-256 `c885c3f1...e593b`, read back byte-equal at this prep), a blank line, then 1.0.69's note. **942 characters, SHA-256 `5ac12277746cd0d2aab21f4c32c02bbc0e0dde6d93f20c00a6748bd4bd9ea509`**; the file `whats-new-1.0.69-rollup.txt` is this text plus a final newline.

```
The Statistics tab's escapee check now settles the species a backup downloaded before eBird's 2026 taxonomy update still calls by their old names, such as Willet and Marsh Wren, by matching them with eBird's answers under the names that update gave them. When a species is still open, the line under the Species figure now names it, and it still counts.

When eBird's public data has no answer for one of your species, such as a sighting eBird has not yet confirmed, the escapee check now reads as finished on both Statistics and Life Lists, and the species still counts.

Life Lists now lists naturalized and provisional exotics by default, as eBird and the Statistics tab count them; turn off Include Exotics to leave them out. A saved Projects or Recent activity answer dated more than a day ahead of your device's clock is now asked for again, and a checklist answer from eBird that cannot be read now shows SnowRaven's own error message.
```

**If 1.0.68 has been approved by the time of the App Store step**, 1.0.69 gets its own new record and What's New is 1.0.69's note alone (369 characters, SHA-256 `b91d5062ae3ee8b25f250086bd89b2d6d37f3cabe71af3b8b88552736c7a7646`, the F-Droid line above without its newline). **If it is in review**, it is left undisturbed and 1.0.69 waits on TestFlight (the 1.0.25 deferral), with the rollup text used at the next ship.

## (c) Privacy policy: the Projects sentence (`PRIVACY_POLICY.md` and `website/privacy.html`, kept identical)

Not optional in substance: the shipped sentence's closed list of re-ask causes ("unless you press Check again") is false once 1.0.69 ships, because a Projects answer dated more than a day ahead is now asked again (`.claude/rules/docs-and-website.md`, v1.0.66). The choice is between two true wordings (security report I5).

**Before (live today):**

> The answers are stored on your device, so stopping, quitting, or loading a newer export asks only about checklists that have not been answered yet, and an answer already given is not re-checked for a year unless you press Check again, which re-asks about all of them.

**Held wording (prepared in `held.patch`, with its guard row in `projectsPublishedClaims.test.ts`):**

> The answers are stored on your device, so stopping, quitting, or loading a newer export asks only about checklists that have not been answered yet, and an answer already given is not re-checked for a year unless it is dated more than a day ahead of your device's clock or you press Check again, which re-asks about all of them.

**Stricter alternative (`held/README.md`; not prepared as a patch):**

> The answers are stored on your device, so stopping, quitting, or loading a newer export asks only about checklists that have no current answer: an answer already given is not re-checked for a year unless it is dated more than a day ahead of your device's clock or you press Check again, which re-asks about all of them.

The alternative also closes the opening clause, which four source comments quote word for word (`lib/clearDerived.ts`, `lib/icloud/icloudSync.ts`, `lib/icloud/icloudSync.test.ts`, `components/Settings.clear.test.tsx`), so they and the guard move with it, a short edit in the execution half before the gates run.

## Wording check

No em dash, ASCII only, American spelling; tab and switch names match the screen (Life Lists, Include Exotics, Projects, Recent activity). Nothing I would change.

## Not in this gate

`website/assets/shots/life-lists.webp` still shows both switches off. Recapturing it is a separate held decision (the change brief), not part of 1.0.69; the alt text names the switches, not their defaults, so it stays true.
