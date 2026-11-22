# Held published copy for 1.0.76 (family-rollups-and-tree + map-scroll-on-phones)

Held for the user's express yes (CLAUDE.md, "Published copy needs the user's
approval first"). Nothing below is written to `README.md`, `website/`,
`appstore/` or `fastlane/metadata/` until that yes. Every BEFORE block is cut
verbatim from the file at `012c3b7c` and occurs there exactly once; the AFTER
blocks are what `patches/2-published-copy-1.0.76.patch` writes.
`frontend/src/lib/familyTreeSurfacesPublishedClaims.test.ts` (in that patch)
reads this file: while `APPLIED` is false it applies the pairs in memory, and
once true it holds the real files to the AFTER blocks. If the user changes a
word, edit the block here first: `apply-release-1.0.76.sh` and the guard both
read these blocks when they run, so nothing else needs regenerating.

Register: one sentence per surface for the new tab, the same words on all
three (the listing's first letter lowered), no count, no operating detail, no
reassurance, no offline mention, American spelling, no em dash. The map build
changes no tab's sentence, so it adds nothing to these three surfaces.

## The sentence (from `held-copy.md`, unchanged)

````proposal sentence
Your life list arranged by eBird's classification, every order and family you have recorded with how much of each you have seen, as a table and as a tree you can zoom.
````

````proposal listing
your life list arranged by eBird's classification, every order and family you have recorded with how much of each you have seen, as a table and as a tree you can zoom.
````

## README.md

````before readme 1
### Breeding Codes

Every species you have recorded breeding evidence for, as a matrix against eBird's breeding codes, colored by evidence tier.

### Hotspot Reports
````

````after readme 1
### Breeding Codes

Every species you have recorded breeding evidence for, as a matrix against eBird's breeding codes, colored by evidence tier.

### Family Tree

Your life list arranged by eBird's classification, every order and family you have recorded with how much of each you have seen, as a table and as a tree you can zoom.

### Hotspot Reports
````

## website/index.html

The new row goes between Breeding Codes (row 7) and Hotspot Reports, which
becomes row 9. The rows alternate `feature-row` and `feature-row reverse`, so
every later row's class and number shift by one (pairs 2 to 5). The icon is the
app's own glyph for the tab, Lucide `Network` (`frontend/src/lib/tabIcons.tsx`),
drawn as the other rows draw theirs. The version pill and footer move in
`patches/1-version-set-1.0.76.patch`, not here.

````proposal alt
The Family Tree tab showing the species, families and orders seen against the world's, above a tree running from the waterfowl order through its family and genera to each species, with photo, audio and video marks.
````

````before website 1
        <!-- 8. Hotspot Reports: reverse -->
        <article class="feature-row reverse">
````

````after website 1
        <!-- 8. Family Tree: reverse -->
        <article class="feature-row reverse">
          <div class="feature-text">
            <span class="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>
            </span>
            <h3>Family Tree</h3>
            <p>
              Your life list arranged by eBird's classification, every order and family you
              have recorded with how much of each you have seen, as a table and as a tree you
              can zoom.
            </p>
          </div>
          <figure class="feature-media shot-slot" data-shot="family-tree">
            <img src="assets/shots/family-tree.webp" width="1600" height="900"
                 alt="The Family Tree tab showing the species, families and orders seen against the world's, above a tree running from the waterfowl order through its family and genera to each species, with photo, audio and video marks." loading="lazy" />
          </figure>
        </article>

        <!-- 9. Hotspot Reports: media right -->
        <article class="feature-row">
````

````before website 2
        <!-- 9. Checklists: media right (comment-search mock) -->
        <article class="feature-row">
````

````after website 2
        <!-- 10. Checklists: reverse (comment-search mock) -->
        <article class="feature-row reverse">
````

````before website 3
        <!-- 10. Life Lists: reverse -->
        <article class="feature-row reverse">
````

````after website 3
        <!-- 11. Life Lists: media right -->
        <article class="feature-row">
````

````before website 4
        <!-- 11. List Comparer: media right (two-list mock) -->
        <article class="feature-row">
````

````after website 4
        <!-- 12. List Comparer: reverse (two-list mock) -->
        <article class="feature-row reverse">
````

````before website 5
        <!-- 12. Named Birds: reverse -->
        <article class="feature-row reverse">
````

````after website 5
        <!-- 13. Named Birds: media right -->
        <article class="feature-row">
````

## appstore/LISTING.md

The bullet goes between Breeding Codes and Hotspot Reports, and the heading's
recorded length follows its block: 3,733 + 183 = 3,916 of Apple's 4,000, which
leaves 84 characters for any later tab's sentence. The Screenshots section is
unchanged unless the user adds a frame (a separate question).

````before listing 1
## Description (3,733 / 4,000)
````

````after listing 1
## Description (3,916 / 4,000)
````

````before listing 2
• Breeding Codes: every species you have recorded breeding evidence for, as a matrix against eBird's breeding codes, colored by evidence tier.
````

````after listing 2
• Breeding Codes: every species you have recorded breeding evidence for, as a matrix against eBird's breeding codes, colored by evidence tier.
• Family Tree: your life list arranged by eBird's classification, every order and family you have recorded with how much of each you have seen, as a table and as a tree you can zoom.
````

## What's New (App Store) and the three F-Droid changelogs

One text for all four, nothing Apple-only in it, so F-Droid takes it whole.
Each file is the text and one newline: `10000761.txt`, `10000762.txt`,
`10000764.txt`. The recommended text names each build's change in one short
sentence (197 characters); the alternative is one sentence (121). If the user
picks the alternative or other words, replace the `proposal whats-new` block's
body with the approved text before applying, and keep `proposal fastlane`
identical to it.

````proposal whats-new
A new Family Tree tab shows your life list by order and family, as a table and as a tree you can zoom. On phones, maps inside a page now open in fullscreen, so swiping the page never moves the map.
````

````proposal fastlane
A new Family Tree tab shows your life list by order and family, as a table and as a tree you can zoom. On phones, maps inside a page now open in fullscreen, so swiping the page never moves the map.
````

````option whats-new-short
A new Family Tree tab shows your life list by order and family, and on phones, maps inside a page now open in fullscreen.
````
