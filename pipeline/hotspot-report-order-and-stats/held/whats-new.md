# Held: What's New and the F-Droid changelog for this change

**Status: APPROVED in a different form (D-15, 2026-11-13).** The user refused both proposals below as too long ("give the gist, the user doesn't need all that minute detail") and approved this text for the App Store record's What's New and the three Fastlane files, which carry it with a newline:

````approved whats-new
Hotspot Reports now opens each place's report with an at a glance summary and puts the life list last.
````

102 characters. D-16 lowercased "at a glance" at the user's word ("Yes, lowercase it"; "please don't capitalize at the middle of the sentence"), so the text above supersedes D-15's capitalized form. Standing direction from this gate: What's New is the gist in one short sentence, never an inventory. The proposals below are kept as the record of what was refused.

**Status before the gate: HELD for the user's yes.** Both are published copy. The deploy stage owns the version (a patch bump, 1.0.72, version code 1000072) and writes these only after the yes.

## The sentence

The same text for the App Store record's What's New and for the three F-Droid changelog files, as at 1.0.63 and 1.0.71 (`fastlane/metadata/android/en-US/changelogs/10000721.txt`, `10000722.txt` and `10000724.txt`, identical):

````proposal whats-new
In Hotspot Reports, each place's report now opens with At a glance, the place's figures such as the days and years you have birded there, species per hour, distance traveled, and your first and newest species there, then adds its most-recorded species and ends with the life list, so on a phone the shorter sections come first.
````

327 characters, ASCII, one sentence, no count, the tab named from `TAB_LABELS`, "At a glance" spelled as the section title, American spelling ("traveled"). In the register of the previous entries (1.0.70's "Life Lists has a Region control: ...", 1.0.71's "A new Hotspot Reports tab, ..."): what changed and what a birder gets from it, with no operating detail. If the release carries other user-visible changes by ship time, the Deployer proposes their sentences beside this one for the same yes.

**BEFORE**: there is no 1.0.72 text yet; the three files do not exist, and the App Store record for 1.0.72 is not created. The most recent published text (1.0.71) is unchanged by this proposal.

## The optional second sentence (the Deployer, 2026-11-13)

The release also carries D-11, the fix for long bird names in a place's life list running into the checklist link at phone widths with large text, which D-13 measured on 27 ordinary names in the demo export (up to 50.89px, "Semipalmated Sandpiper"), not only extreme ones. Proposed to follow the sentence above, separated by one space:

````proposal whats-new-second
On a phone with large text, long bird names in the life list now wrap instead of running into the checklist link beside them.
````

125 characters, ASCII, no count, American spelling. It says what a birder saw and what they get now, with no operating detail; "the life list" refers back to the first sentence's. Together the two are 453 characters, under F-Droid's 500. **Recommended: include it**, because the defect shipped in 1.0.71 and a store user who met it has no other note that it is fixed. With it left out, the text is the first sentence alone (327 characters).

`held/version-1.0.72.patch` writes the two-sentence text (453 characters and a newline) into the three F-Droid files. If the user takes the first sentence alone, the one edit at apply time is to replace each file's content with the first sentence and a newline; the CHANGELOG draft in the patch describes the fix either way (CHANGELOG.md is not a published surface under CLAUDE.md's list).

## Shortened at the sign-off (the Guide, 2026-11-13)

The user's direction on the two proposals above: "the whats new is too long; give the gist, the user doesn't need all that minute detail". Both are withdrawn. The replacement proposals, still HELD for the user's yes:

````proposal whats-new-short
Hotspot Reports now opens each place's report with an At a glance summary and puts the life list last.
````

````proposal whats-new-short-second (optional)
Long bird names in the life list now wrap on a phone with large text.
````

`held/version-1.0.72.patch` still carries the withdrawn two-sentence text in the three F-Droid files; at apply time each file's content is replaced with the approved text and a newline.
