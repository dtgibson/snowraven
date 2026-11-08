# Held pieces, 1.0.66 (ebird-request-economy)

**Status: HELD. Nothing here is applied.** Each piece waits for the user's explicit yes at the ship. The text, the reasons and the stated facts are in `../held-copy.md`; `../bump-1.0.66.sh held` (and `held --offered` for item 3) is what applies them, reading the text from `held-copy.md`, and it refuses on any mismatch or partial state.

| File | What it is | Where it goes on a yes |
|---|---|---|
| `whats-new.txt` | The store text plus one newline (290 bytes, SHA-256 `b7b34859e94b063ea95e19139ca0074ba9b2492563a508b7ceffa8f24d74509e`) | Byte for byte into `fastlane/metadata/android/en-US/changelogs/10000661.txt`, `10000662.txt`, `10000664.txt`, in the release commit, before the tag. The App Store "What's New" on the 1.0.66 record is the same text without the newline, read back after the write. |
| `hotspotSharePublishedClaims.test.ts` | The revised guard for privacy item 2 (full replacement) | `frontend/src/lib/`, replacing HEAD's (git blob `bdf64151`), in the same commit as the policy change |
| `escapeeRetentionPublishedClaims.test.ts` | The new guard for privacy item 1 | `frontend/src/lib/`, new |
| `hotspotActivityRetentionPublishedClaims.test.ts` | The guard for privacy item 3 (offered) | `frontend/src/lib/`, new, only if item 3 is taken |
| `privacy-required.patch` | Items 1 and 2 in `PRIVACY_POLICY.md` and `website/privacy.html`, as a `git apply` patch | Review artifact: generated from `held-copy.md`, byte-identical to what the script writes, and `git apply --check` clean against the tree at hand-off. The script, not this patch, is what the ship runs. |
| `privacy-offered.patch` | Item 3, on top of the required patch | Review artifact, as above |

**How it was proved before the yes:** the script ran against a scratch copy of the repo (`BUMP_ROOT` is not needed when the copy carries its own script). With the required group applied, every `*PublishedClaims*.test.ts`, `privacyPageParity`, `fastlaneMetadata`, `fdroidRecipe`, `androidVersionSource` and `clearDerived` suite passed (22 files, 462 tests); with item 3 on top, the published-claims, parity and Fastlane suites passed (20 files, 380 tests). A second run exited 3 and changed nothing. Against the unpatched policy, the three held guards failed 10 of 22 rows; with one policy file patched and the other not, the script refused. The live tree was never touched by any of this.
