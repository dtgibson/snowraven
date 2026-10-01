# Decisions: alerts-inbox-mark-read

## 2026-10-01: design approved with the recommended picks
The user approved the first design direction and took every recommendation:
the label "Mark read" (not "Mark all read"), a 160ms fade for the leaving New
marks (instant under reduced motion), focus moved to the sheet's Close button
after the press (not to Clear), and the one polite announcement "Marked read."
(not "All alerts marked read."). Placement just before Clear, disabled when
nothing is New, and no confirmation step stand as proposed.

## 2026-10-01: rest of the run hands-off, ship when done
After the design approval the user said "go with your picks, ship it when
done". The Engineer, Tester, Auditor and Deployer stages run hands-off, and that
sentence is the production sign-off. Two things stay held under the standing
rules: the App Store "What's New" line needs the user's express yes, and the App
Store submission follows the user's own device check of the uploaded build.

## 2026-10-01: What's New approved; 1.0.43 rolls up into 1.0.42's record
The user approved the held What's New line word for word: "The Alerts inbox on
iPhone and iPad has a Mark read button beside Clear. It clears the New marks
and the count without removing any alerts." The user chose to fold 1.0.43 into
1.0.42: after the user's own device check of TestFlight build 1.0.43.1, 1.0.42's
record `73b6e8ac` (submission `ffe1ed1d`, WAITING_FOR_REVIEW) is withdrawn,
retargeted at 1.0.43, repointed at build 1.0.43.1, and resubmitted with 1.0.42's
approved What's New followed by this line, both word for word. If Apple has
started reviewing 1.0.42 before the device check is done, fall back to deferring
1.0.43 behind it and leave that review undisturbed. Either way the outcome is
added to CLAUDE.md's version-record list in the same ship.

## 2026-10-01: the rollup ran; 1.0.43 is submitted on record `73b6e8ac`
The user checked TestFlight build 1.0.43.1 on their own device ("It works, go
ahead and resubmit"). Submission `ffe1ed1d` was still WAITING_FOR_REVIEW, so the
rollup went ahead rather than the deferral fallback. Record `73b6e8ac` was
withdrawn (DEVELOPER_REJECTED, `ffe1ed1d` COMPLETE), retargeted at 1.0.43,
repointed at build 1.0.43.1 (`030f26dd`), and given the combined What's New:
1.0.42's two approved paragraphs, then the approved 1.0.43 line, 664
characters, read back byte for byte. Every other listing field was read back
and had carried over unchanged, so nothing was restored: description,
keywords, promotional text, both URLs, copyright, review contact and notes,
age rating, AFTER_APPROVAL with no phased release, export compliance on the new
build, and both screenshot sets (all twelve checksums match
`appstore/screenshots/` in order; none shows the Alerts inbox). Resubmitted as
`dc1ce5dd-0622-468a-a59f-4399166a8e53`, WAITING_FOR_REVIEW. 1.0.42 therefore
ends with VALID build 1.0.42.1 and no record of its own by rollup, which
CLAUDE.md's version-record list now says.
