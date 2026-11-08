# Decisions — escapee-check-new-taxonomy

## D-01 Orphaned punctuation after an inline bird name (QA attempt 1, 2026-11-08)

**Finding.** The Tester's real-engine look at the named status line found that, in both Chromium and WebKit, at 430px or narrower with text at 125% or larger (48 of 384 measured combinations), a comma or ", or" lands alone at the start of a line. Each comma is the first text after a `BirdName`, and both engines allow a break right after the name's trailing marks. At the user's one-open-bird case it shows only at 320px, where ", so it still counts." stands alone on the last line.

**Decision.** Punctuation that follows a bird name is attached to that name and never starts a line. The mechanism keeps the name's trailing marks and the punctuation after them in one unbreakable run while the name's own words stay free to wrap, so a long name at 320px never overflows. Typesetting rule, not a design direction: the Fix lane has no Designer, and nothing about the line's look or wording changes. Routed to The Engineer as the attempt-1 retry; The Tester re-measures the same 384 combinations in both engines.

**What would reverse it.** A measured overflow at 320px with 200% text from a name made unbreakable, or a WebKit-only result that differs from Chromium (a null result is per-engine).

## D-02 Security review dispositions (2026-11-08)

- **L-1 applied.** `frontend/src/lib/exoticTaxonomyJoin*.ts` added to the `paths` list of `.claude/rules/security.md`, as CLAUDE.md requires when a change adds a file a rule governs. Frontmatter only; no code or test changed, so the Tester's sign-off stands.
- **I-1 accepted, PR limitation 2 reworded** to state the real shape (an Escapee-tagged sibling row could read a kept-name species as escapee-only) and that no 2026 event can produce it; recheck at the next taxonomy refresh.
- **I-2 accepted.** A failed history chunk runs the check without the join and the species keeps counting, which is the pre-fix behaviour; the chunk ships inside the Tauri apps.
- **I-3 accepted, no privacy-policy change.** One paced re-ask per previously stamped species on the first Statistics load after upgrading; on the user's data, 3 requests then 0.
