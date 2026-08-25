# Strategic Brief — iOS App Store Release

## What We're Building
SnowRaven's public iOS App Store release: everything between "the app is on TestFlight every version" and "a birder can find SnowRaven on the App Store and install it." The binary work is done and routine; this feature is the listing, the compliance record, the App Review strategy, and the release-rhythm decisions that make the App Store a standing leg of every release.

## Why Now
The engineering runway is fully built and this is the roadmap's Up Next item 1. The v0.5.37/v0.5.55 responsive and touch passes made the whole app hold at 320px and 200% text scale; every release since v0.5.78 has shipped an iOS TestFlight build of the same version as a standing rule; the v0.5.93 icon passed Apple's upload validation first try; and the safe-area, WKWebView-sticky, and iOS focus-zoom families (v0.5.81–v0.5.86) closed the defects only real devices surface. TestFlight-only distribution means the one platform a birder carries into the field is invite-only. Nothing technical stands between here and public distribution — what remains is product-release work, and deferring it just accumulates more versions that ship everywhere except the store.

## The User Problem
The birder SnowRaven is built for — someone standing in a field with years of eBird data — mostly has a phone in hand, not a laptop. Today reaching them requires a TestFlight invite from the developer: a personal handoff that doesn't scale past friends and defeats "a personal project shared as a free public good." A public listing makes the phone app installable the way the desktop app already is downloadable: find it, install it, point it at your own data, no gatekeeper.

## Success Criteria
- SnowRaven is live on the App Store: a birder can search for it, install it free, and load their own eBird backup and Macaulay export with no invite and no account.
- The privacy nutrition label reads **"Data Not Collected"** and that claim is true — no analytics, no telemetry, no accounts, no third-party SDKs, exactly as PRIVACY_POLICY.md states.
- The listing reads in the house voice: informative not promotional, SnowRaven working *alongside* eBird and the Macaulay Library, gratitude intact, no implied affiliation with or endorsement by the Cornell Lab.
- An App Reviewer with no eBird account can exercise the app end to end from the review notes and demo data, and the known review-risk areas (external-data dependence, Macaulay embeds, user-supplied keys) each have a prepared, honest answer.
- The App Store is a documented, repeatable leg of the standing release rhythm: after this feature, "a release goes to ALL available platforms" includes the public App Store, and the recipe lives in CLAUDE.md's iOS section beside the TestFlight recipe.
- Screenshots come from the synthetic demo dataset — the published listing contains no real sighting locations, same rule as the website.
- The published prose surfaces (PRIVACY_POLICY.md overview, README, website) name the iOS App Store availability in the same change that ships it, per the standing accuracy rule.

## Scope
- **App Store Connect listing**: name, subtitle, description, keywords, category, promotional text, support URL and marketing URL (the GitHub Pages website), copyright.
- **Screenshots** at Apple's required device sizes, captured from the synthetic demo dataset (`SR_DATA_DIR` pipeline), for every device family the binary targets.
- **Compliance record**: privacy nutrition labels, privacy policy URL (publish PRIVACY_POLICY.md's content at a stable website URL), age rating questionnaire, export compliance (`ITSAppUsesNonExemptEncryption` declared so builds skip the per-upload question), content-rights declaration.
- **App Review package**: review notes with a step-by-step script, a hosted synthetic demo eBird backup + ML export the reviewer can import, and a working eBird API key for review.
- **iOS-build compliance sweep**: verify the iOS binary exposes no self-update or update-download affordance (the desktop updater is forbidden on iOS; a passive version check is acceptable, a download path is not) and no other desktop-only affordance a reviewer would flag. Fix only what compliance requires.
- **Release-rhythm integration**: the App Store submission step documented as part of the standing ship recipe (submit the already-uploaded TestFlight build — no new binary work per release), including what happens on a rejection.
- **Published-prose sync**: PRIVACY_POLICY.md, README.md, and the website updated to reflect public iOS availability when it goes live.

## Out of Scope
- **Android** — the roadmap says "to follow"; nothing here anticipates it.
- **Any new app feature or UI change** — this is a distribution feature. The only code changes permitted are those App Store compliance forces (e.g., hiding an update affordance on iOS).
- **Mac App Store distribution** — the desktop app stays direct-download with its own signed updater.
- **Paid tiers, in-app purchase, ads, or donations** — free, full stop, matching the free-public-good identity.
- **App Store optimization / marketing campaigns** — the listing informs, in the website's voice; no ASO tooling, no promotion push.
- **Any analytics or telemetry** — including App Store-adjacent SDKs. Apple's own opt-in App Analytics (Apple's collection, shown in App Store Connect) is outside the app and does not touch the privacy label.

## Key Decisions
- **The privacy label is "Data Not Collected," and it is a standing claim with the same weight as PRIVACY_POLICY.md.** It is supportable because nothing leaves the device except user-initiated requests to providers with the user's own keys, and there are no third-party SDKs. Any future feature that would change the label is a listing change in the same release, exactly as the privacy-policy rule already works.
- **Free with no monetization of any kind.** The founding "free public good" identity carries to the store unchanged; this also keeps the Paid Applications agreement and all IAP review surface out of the picture entirely.
- **The minimum-functionality review risk (Guideline 4.2 territory) is answered with a demo path, not an app change.** The app is honest but thin with no data loaded; review notes ship a hosted synthetic demo dataset, an import walkthrough, and a dedicated (free) eBird API key. The app's first-class no-key/offline/failure states — already a product principle — are the second half of the answer: nothing a reviewer hits without credentials looks broken. Tide and maps are keyless and work immediately.
- **The Macaulay-embed review risk is answered honestly, not hidden.** The embeds show the user's *own* media, a Settings toggle disables them entirely, and when Cornell's bot check blocks players the app shows its own honest placeholder with a link out (v0.5.76). Review notes state this plainly. The posture of working alongside Cornell's services, never around their protection, is unchanged and is itself the answer.
- **No implied affiliation.** "eBird" and "Macaulay Library" appear in the description only as compatibility statements ("explore your own eBird data"), never in the app name or subtitle, and the listing never implies Cornell endorsement — the same voice rule the website already follows.
- **The App Store debut ships as version 1.0.0; the lockstep is unchanged.** (Amended at the design review, user decision 2026-08-25 — supersedes the earlier "no artificial 1.0" position.) The first public App Store release bumps the app's one version to 1.0.0 on every platform at once (desktop, web, TestFlight, App Store — a deliberate one-time jump from 0.5.x), then the standing incremental rhythm resumes continuing upward from 1.0.0 (1.0.1, 1.0.2, …; patch by default, exactly as before). Versions never drop back below 1.0.0: Apple requires each submitted version to increase, and the desktop updater's latest.json comparison would strand 1.0.0 installs behind any release carrying a lower number.
- **Every release submits to the App Store, and Apple's latency never blocks the other platforms.** The standing rule ("a release goes to ALL available platforms, every time") extends to the store: after `release.sh` and the TestFlight upload, the same uploaded build is submitted for review. Desktop, web, and TestFlight ship on their own schedule as today; the App Store leg trails by review latency, released immediately on approval (no phased rollout — phasing serves large installed bases, and delaying a privacy-first app's fixes serves no one). A rejection stalls only the App Store leg and becomes a fix-forward item, never a rollback of the other platforms.
- **Sign-in-less operation is a strength, not a gap.** No account means no login to demo, no Sign in with Apple obligation, and a shorter review surface. The review notes present it as the design it is.
- **This deliberately widens a founding decision.** The founding brief's distribution list (Mac/Windows desktop + self-hosted Pi) predates mobile; the roadmap has committed to iOS since the Windows release hardened the platform seams. When this ships, the founding brief's distribution decision should be amended to include iOS — a conscious update, not drift.

### Open Questions (for the Planner to resolve early)
- **Device family: iPhone-only or iPhone + iPad?** The binary and recent fixes (the iPad Help TOC, v0.5.81) suggest iPad is targeted; if the Xcode project targets both families, iPad screenshots are required. Verify the project's device-family setting first — it drives the whole screenshot matrix.
- **App name availability.** "SnowRaven" must be free as an App Store app name; verify in App Store Connect before any metadata work, and decide a fallback form (e.g., "SnowRaven Birding Tools") only if forced.
- **Category.** Candidates: Reference, Weather, or Lifestyle as primary. Pick during the build; low stakes, but the choice belongs in the design record.
- **OpenWeather key for review.** eBird keys are free and a dedicated review key is committed above; OpenWeather's "One Call by Call" requires a card. Either supply a temporary review key or scope the review script to the keyless features (tide, maps, all offline analytics) with the honest no-key state shown deliberately. Resolve by cost/effort at build time.
- **The iOS update-check surface.** Confirm what, if anything, the iOS build shows under the desktop app's "Check for Updates" flow, and hide any download affordance if one is reachable. Expected to be a non-issue (the updater is a desktop Tauri plugin) but must be verified, not assumed.
