# Change Brief — superlinear-regex-sweep

## What is changing

Six quadratic regexes reachable through real exported entry points become linear, each by the
means that is provably output-identical for its own consumer (bound the quantifier, or replace
the pattern with a scan). The sweep found **six, not the five on record** — I reproduced all
five and then re-derived the scope, which surfaced `countyBoundaries.ts:129`:

| entry point | pattern | file:line | 40k | growth/doubling |
|---|---|---|---|---|
| `stripWeatherTideBlocks` | `/(?:[ \t]{2,}\|\r?\n)(?=\S)/g` | `lib/commentBlocks.ts:204` | 3,499.8 ms | 3.99–4.01x |
| `normalizeCountyName` **(new)** | `/\s+(county\|parish\|…)$/` | `lib/countyBoundaries.ts:129` | 2,496.1 ms | 3.99–4.00x |
| `parseAgeSex` | `/^(.*?)\s*[–—-]\s*(\d+)\s*$/` | `lib/mediaStats.ts:39` | 2,494.6 ms | 4.00–4.01x |
| `commentSegments` | `/[.,;:!?]+$/` | `lib/commentText.ts:49` | 2,492.5 ms | 4.00x |
| `extractChecklistId` | `/\/+$/` | `lib/checklistId.ts:4` | 2,245.6 ms | 3.99–4.00x |
| `hasSnowravenWeatherBlock` | `/<[^>]*>/g` | `lib/commentBlocks.ts:104` | 2,244.4 ms | 4.00–4.01x |

## Why now

The v0.5.84 security review measured five of these and the roadmap carries them. Doing the
whole set in one build is the point: a subset re-creates the false-scope-claim trap that review
was written about. Reachability differs and sets priority. `commentText.ts:49` is the only one
an **unrelated party** supplies (ChecklistComparer renders `<CommentText raw>` over eBird API
comments at `ChecklistComparer.tsx:155/499/591`); the rest need the user's own file or paste.
`normalizeCountyName` is new to the record and amplified: it runs **once per observation** from
`countyShading.ts:88/106` and `countyCompleteness.ts:182` over the CSV `County` column, which
the parser caps at nothing. Impact throughout is a main-thread freeze of the user's own tab.
No data disclosure, no server: hardening, not an incident, exactly as v0.5.84 was rated.

## User-facing impact

None. Every rewrite must be output-identical on real data, so no name, count, total, link,
comment rendering, or stripped block may move. The only observable difference is that a
pathological cell or comment stops freezing the tab.

## Design pass

Not needed — no visual change.

## Decisions touched

- **v0.5.27, "Regex hygiene is now policy"** (`DECISIONS.md:1559`) — extended, not reversed.
  That pass fixed three specific scans in `commentBlocks.ts`; both sites here are in that same
  file, in the code it did not sweep. Worth naming plainly in the record.
- **v0.5.84 `species-name-regex-bound`** — this build executes the instruction its own source
  comment leaves (`speciesUtils.ts:13-19`, "Do not restate the sweep as finished; re-derive it
  when you write the claim"). Honoring it is what turned up the sixth site.
- **v0.5.66 `NAME_TAG_RE` bound** (`DECISIONS.md:2864`) — same family, already bounded, measured
  flat, untouched.

## What done looks like

All six measure linear through their **real exported entry points** (not the literals), and each
carries the four-test guard CLAUDE.md requires: structural, timing, parity against the current
pattern, and headroom, with the constant's safe range asserted directly rather than via the
timing ceiling. Output-identity needs **both** proofs the `normalizeSpeciesName` precedent used,
for its reason: real inputs here are well-formed and cannot discriminate a correct rewrite from
a wrong one. So a corpus sweep where one exists (`us-counties.json` names for `normalizeCountyName`,
the demo/ML export for `parseAgeSex`) **plus** exhaustive enumeration over each site's own small
branching alphabet. `parseAgeSex` is the one site carrying real behavioral risk and must not be
rewritten by inspection: `.` excludes `\n`, so a value with a newline never matches today while a
naive right-to-left scan would match it. Scope claims land honestly in `ROADMAP.md` and
`CLAUDE.md`'s regex-hygiene rule, re-derived at the moment they are written.
