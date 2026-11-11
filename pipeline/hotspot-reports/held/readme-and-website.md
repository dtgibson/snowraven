# Held: the Hotspot Reports sentence for README.md and website/index.html

**Status: HELD for the user's yes. Nothing here is written to `README.md` or `website/` until the user has read it and said yes** (CLAUDE.md, "Published copy needs the user's approval first"; `.claude/rules/docs-and-website.md`).

## The proposal (one sentence, the same words on both files and in the App Store listing)

````proposal sentence
Your own record at any one place you have birded, an eBird hotspot or one of your personal locations: your life list there, a map, your checklists by protocol, and the weather on your visits from the weather blocks in your checklist comments.
````

Register check, against `.claude/rules/docs-and-website.md`: one sentence; says what the tab gives a birder and nothing about how to operate it (no picker, button or key); no reassurance, no offline mention, no privacy wording; no count (no number of sections, places, protocols or anything else); American spelling; "weather" lowercase and unbolded; no U+2014; the tab is named only by its heading, "Hotspot Reports" (`TAB_LABELS['hotspot-reports']`). It opens on the same "Your ..." noun phrase as its neighbours ("Your checklists as whole outings: ...", "Your whole history with one bird: ...") and echoes the tab's own on-screen description ("Your own record at any one place in your eBird backup, hotspot or personal location."). "Any one place you have birded" is true because the tab offers only places in the backup, and "the weather on your visits from the weather blocks in your checklist comments" is scoped to the blocks because nothing is looked up.

## README.md: a new `### Hotspot Reports` section between `### Breeding Codes` and `### Checklists`

The tab sits between Breeding Codes and Checklists in `DEFAULT_TAB_ORDER`, so the section goes there. Nothing else in the README changes.

**BEFORE** (`readme 1`), verbatim from the published file:

````before readme 1
### Breeding Codes

Every species you have recorded breeding evidence for, as a matrix against eBird's breeding codes, colored by evidence tier.

### Checklists

Your checklists as whole outings: search every comment you have written, and filter by what an outing has.
````

**AFTER** (`readme 1`):

````after readme 1
### Breeding Codes

Every species you have recorded breeding evidence for, as a matrix against eBird's breeding codes, colored by evidence tier.

### Hotspot Reports

Your own record at any one place you have birded, an eBird hotspot or one of your personal locations: your life list there, a map, your checklists by protocol, and the weather on your visits from the weather blocks in your checklist comments.

### Checklists

Your checklists as whole outings: search every comment you have written, and filter by what an outing has.
````

## website/index.html: a new feature row between the Breeding Codes and Checklists rows

The new row is the eighth, so it carries `reverse`, and each row below it moves one place and flips side, because the section's rows alternate (odd rows media right, even rows `reverse`) and `lifeListsSurfacesPublishedClaims.test.ts` asserts that alternation. The rows' numbering comments move with them. The body paragraph opens as a bare `<p>`, as the section's header comment requires.

- **Sentence:** the proposal above, wrapped at the file's width.
- **Icon:** lucide `MapPinned`, the tab's own icon in the app (`frontend/src/lib/tabIcons.tsx`), at the row icons' 1.75 stroke.
- **Figure:** `assets/shots/hotspot-reports.webp`, 1600 x 900 (the shared 16:9 box), captured from the demo data by the capture job in `website-tools.patch` (`hotspot-reports-light.png`). `website/tools/process-img.mjs` needs a `['hotspot-reports-light.png', 'hotspot-reports.webp', 1600, 84]` row for that file to exist; if `website-tools.patch` does not add it, the copy commit does.
- **Alt text** (published copy too, so it is part of this proposal): "The Hotspot Reports tab showing one hotspot's report: its name and kind, its species and checklist totals with the counting rule beneath them, its life list newest first with how many of the place's checklists include each species, a map with one pin, and its checklists by eBird protocol." It describes the figure, not the sentence, and must be re-read against the frame the capture job actually produces before the yes; if the frame does not show one of those parts, the alt text drops it.

**BEFORE** (`website 1`), verbatim from the published file:

````before website 1
        <!-- 7. Breeding Codes: media right -->
        <article class="feature-row">
          <div class="feature-text">
            <span class="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4c0 6 16 10 16 16M20 4C20 10 4 14 4 20"/><path d="M7 5h10M7 19h10M9 9h6M9 15h6"/></svg>
            </span>
            <h3>Breeding Codes</h3>
            <p>
              Every species you have recorded breeding evidence for, as a matrix against
              eBird's breeding codes, colored by evidence tier.
            </p>
          </div>
          <figure class="feature-media shot-slot" data-shot="breeding">
            <img src="assets/shots/breeding.webp" width="1600" height="900"
                 alt="The Breeding Codes tab showing a species-by-code matrix with tier-colored count badges." loading="lazy" />
          </figure>
        </article>

        <!-- 8. Checklists: reverse (comment-search mock) -->
        <article class="feature-row reverse">
          <div class="feature-text">
            <span class="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 9h4M7 13h7M7 17h5"/><path d="M16 2v4M8 2v4"/></svg>
            </span>
            <h3>Checklists</h3>
            <p>
              Your checklists as whole outings: search every comment you have written, and
              filter by what an outing has.
            </p>
          </div>
````

**AFTER** (`website 1`):

````after website 1
        <!-- 7. Breeding Codes: media right -->
        <article class="feature-row">
          <div class="feature-text">
            <span class="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4c0 6 16 10 16 16M20 4C20 10 4 14 4 20"/><path d="M7 5h10M7 19h10M9 9h6M9 15h6"/></svg>
            </span>
            <h3>Breeding Codes</h3>
            <p>
              Every species you have recorded breeding evidence for, as a matrix against
              eBird's breeding codes, colored by evidence tier.
            </p>
          </div>
          <figure class="feature-media shot-slot" data-shot="breeding">
            <img src="assets/shots/breeding.webp" width="1600" height="900"
                 alt="The Breeding Codes tab showing a species-by-code matrix with tier-colored count badges." loading="lazy" />
          </figure>
        </article>

        <!-- 8. Hotspot Reports: reverse -->
        <article class="feature-row reverse">
          <div class="feature-text">
            <span class="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0"/><circle cx="12" cy="8" r="2"/><path d="M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712"/></svg>
            </span>
            <h3>Hotspot Reports</h3>
            <p>
              Your own record at any one place you have birded, an eBird hotspot or one of
              your personal locations: your life list there, a map, your checklists by
              protocol, and the weather on your visits from the weather blocks in your
              checklist comments.
            </p>
          </div>
          <figure class="feature-media shot-slot" data-shot="hotspot-reports">
            <img src="assets/shots/hotspot-reports.webp" width="1600" height="900"
                 alt="The Hotspot Reports tab showing one hotspot's report: its name and kind, its species and checklist totals with the counting rule beneath them, its life list newest first with how many of the place's checklists include each species, a map with one pin, and its checklists by eBird protocol." loading="lazy" />
          </figure>
        </article>

        <!-- 9. Checklists: media right (comment-search mock) -->
        <article class="feature-row">
          <div class="feature-text">
            <span class="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 9h4M7 13h7M7 17h5"/><path d="M16 2v4M8 2v4"/></svg>
            </span>
            <h3>Checklists</h3>
            <p>
              Your checklists as whole outings: search every comment you have written, and
              filter by what an outing has.
            </p>
          </div>
````

The three rows below move one place and flip side:

**BEFORE** (`website 2`), verbatim from the published file:

````before website 2
        <!-- 9. Life Lists: media right -->
        <article class="feature-row">
````

**AFTER** (`website 2`):

````after website 2
        <!-- 10. Life Lists: reverse -->
        <article class="feature-row reverse">
````

**BEFORE** (`website 3`), verbatim from the published file:

````before website 3
        <!-- 10. List Comparer: reverse (two-list mock) -->
        <article class="feature-row reverse">
````

**AFTER** (`website 3`):

````after website 3
        <!-- 11. List Comparer: media right (two-list mock) -->
        <article class="feature-row">
````

**BEFORE** (`website 4`), verbatim from the published file:

````before website 4
        <!-- 11. Named Birds: media right -->
        <article class="feature-row">
````

**AFTER** (`website 4`):

````after website 4
        <!-- 12. Named Birds: reverse -->
        <article class="feature-row reverse">
````

## How this was checked

- Every BEFORE block above was cut out of the published file by script and occurs exactly once in it, so the AFTER applies cleanly.
- `frontend/src/lib/hotspotReportsSurfacesPublishedClaims.test.ts` reads this file, applies each pair in memory to the current `README.md` and `website/index.html`, and checks the result: the section and the row named from `TAB_LABELS` between their neighbours in `DEFAULT_TAB_ORDER`, the sentence equal to the proposal, the rows still alternating, the figure path, and no U+2014. While the copy is held it also asserts that the published files do NOT yet carry a Hotspot Reports section or row. On the user's yes, the copy commit applies these pairs and sets `APPLIED = true` in that suite, which then runs the same checks on the real files.
