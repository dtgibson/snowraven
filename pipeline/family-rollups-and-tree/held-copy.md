# Held published copy: the Family Tree tab

Held for the user's express yes (CLAUDE.md, "Published copy needs the user's
approval first"; FR-74). Nothing below has been written to `README.md`,
`website/`, `appstore/` or `fastlane/metadata/`. Each surface takes ONE
sentence, in the register of `.claude/rules/docs-and-website.md`: what the tab
does and what a birder gets from it, no count, no operating detail, no
reassurance, no offline mention, American spelling, no em dash. The three
files say the same thing in the same words; the App Store bullet is the same
sentence with its first letter lowered.

## The sentence (README, website, App Store listing)

````proposal sentence
Your life list arranged by eBird's classification, every order and family you have recorded with how much of each you have seen, as a table and as a tree you can zoom.
````

### README.md

A new `### Family Tree` section between `### Breeding Codes` (line 41) and
`### Hotspot Reports` (line 45), holding the sentence above as its body.

````after readme
### Family Tree

Your life list arranged by eBird's classification, every order and family you have recorded with how much of each you have seen, as a table and as a tree you can zoom.
````

### website/index.html

A new feature row between the `<h3>Breeding Codes</h3>` row (line 294) and the
`<h3>Hotspot Reports</h3>` row (line 312), holding the same sentence as its
`<p>`. The rows alternate `feature-row` and `feature-row reverse` and carry a
numbering comment, so every later row's class and number shift by one. The row
needs a screenshot (`assets/shots/family-tree.webp`), which is published copy
too (its alt text and the frame itself), captured from the synthetic demo data
only; a new tab also changes every frame that draws the sidebar or icon rail
(`.claude/rules/docs-and-website.md`, v1.0.63), so the regeneration is a
separate named question.

### appstore/LISTING.md

A bullet between the Breeding Codes bullet (line 66) and the Hotspot Reports
bullet (line 67), and the Description heading's recorded length updated to
match its block:

````after listing
• Family Tree: your life list arranged by eBird's classification, every order and family you have recorded with how much of each you have seen, as a table and as a tree you can zoom.
````

Whether the tab earns an App Store screenshot frame is its own named question
(`.claude/rules/docs-and-website.md`, v1.0.72), not part of this proposal.

## What's New and the F-Droid changelogs (the release that carries it)

One short sentence, the gist only; the same words in the App Store What's New
and the three per-processor Fastlane files of that release's version code:

````proposal whats-new
A new Family Tree tab shows your life list by order and family, as a table and as a tree you can zoom.
````

## Guard rows owed when the copy lands

`familyTreePublishedClaims.test.ts` covers Help only and stays green either
way. The commit that applies the approved copy adds a separate surfaces suite
in the shape of `hotspotReportsSurfacesPublishedClaims.test.ts` (each file's
own passage, neighbours read from `DEFAULT_TAB_ORDER` among the entries each
surface carries, the three files compared with each other, the register rules
as rows). `hotspotReportsSurfacesPublishedClaims.test.ts` already reads its
neighbours among the entries a surface carries, so adding the Family Tree
entries keeps it green.
