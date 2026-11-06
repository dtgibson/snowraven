# Held copy: Life Lists (published surfaces)

**Status: HELD. Nothing below has been written to any published file.** Each proposal waits for the user's explicit yes, shown rendered, before the Orchestrator applies it (CLAUDE.md, published copy; FR-41). The privacy policy needs no change (schema section 10): no third-party request, no new endpoint or host, no request moved between components, and no new stored document.

One sentence per surface, in the house register: what the tab does and what a birder gets from it, no operating detail, no reassurance, no offline mention, American spelling, the serial comma.

## 1. `README.md`, a new `### Life Lists` section directly after `### Checklists`

Before (lines 45 to 51):

```
### Checklists

Your checklists as whole outings: search every comment you have written, and filter by what an outing has.

### List Comparer
```

After:

```
### Checklists

Your checklists as whole outings: search every comment you have written, and filter by what an outing has.

### Life Lists

Every species you have recorded, newest first by your first sighting, and your photo, audio, and video life lists, alone or combined.

### List Comparer
```

## 2. `website/index.html`, a feature row directly after the Checklists row

The proposed text is the same sentence:

> Every species you have recorded, newest first by your first sighting, and your photo, audio, and video life lists, alone or combined.

Each feature row on the site also carries an icon and an `aria-hidden` mock figure. The sentence is the only proposal here; whether the row gets a mock (and which) is a design decision for the user at the same yes, since a mock is a behavioral claim that has to be re-derived through the real code (docs-and-website.md, v1.0.20).

## 3. `appstore/LISTING.md` (and App Store Connect), the feature list

Before:

```
• Checklists: your checklists as whole outings: search every comment you have written, and filter by what an outing has.
• List Comparer: two life lists side by side, or any two public checklists: what they share and what only one has.
```

After:

```
• Checklists: your checklists as whole outings: search every comment you have written, and filter by what an outing has.
• Life Lists: every species you have recorded, newest first by your first sighting, and your photo, audio, and video life lists, alone or combined.
• List Comparer: two life lists side by side, or any two public checklists: what they share and what only one has.
```

## 4. App Store "What's New" for the version that ships this (1.0.62 unless another ship lands first)

> A new Life Lists tab, after Checklists, lists every species you have recorded newest first by your first sighting, with its checklist and place, and turns into a photo, audio, or video life list, or any combination of them.

## 5. Fastlane changelogs (`<10 * versionCode + 1, 2, 4>.txt`, the same text in all three; published copy, present at the tag)

> A new Life Lists tab, after Checklists, lists every species you have recorded newest first by your first sighting, with its checklist and place, and turns into a photo, audio, or video life list, or any combination of them.
