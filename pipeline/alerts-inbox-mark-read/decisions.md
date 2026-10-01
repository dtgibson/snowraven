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
