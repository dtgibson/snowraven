# Phase B — availability prose, staged (apply ON App Store approval, not before)

**Status: PENDING. Nothing in this file is applied yet.** Phase A (this
release) deliberately makes none of these claims: SnowRaven is not on the App
Store until Apple approves it, and the standing accuracy rule forbids
publishing availability before it is live. When the 1.0.0 submission is
approved and released, apply the edits below in one website/prose-only push
(none of these files are bundled into the app, so Phase B needs no version
bump, no changelog entry, and no release; the Pages workflow redeploys the
site on push).

Two placeholders recur: `APP_STORE_URL` is the live listing URL (known only
after approval, `https://apps.apple.com/app/id...`); fill it everywhere it
appears.

Note: the schema originally placed the PRIVACY_POLICY.md iOS additions here.
They shipped in Phase A instead (Designer's flag, adopted; see decisions.md),
so the policy and privacy page need NO Phase B edit.

---

## 1. README.md

a. Opening paragraph (line 3), replace:

> Self-hosted birding tools and data explorer for your eBird workflow: a standalone Mac or Windows app, or hosted on a Raspberry Pi (or any computer on your network).

with:

> Self-hosted birding tools and data explorer for your eBird workflow: a standalone Mac or Windows app, an iPhone and iPad app on the App Store, or hosted on a Raspberry Pi (or any computer on your network).

b. Installation section: add after the "### Windows" block:

> ### iPhone and iPad
>
> Install SnowRaven free from the [App Store](APP_STORE_URL). Updates arrive through the App Store like any other iOS app. Import your eBird backup and Macaulay Library export from the Files app in Settings.

## 2. website/index.html

a. Meta description + og:description: extend the platform clause
"for macOS, Windows, and Raspberry Pi" to
"for macOS, Windows, iPhone and iPad, and Raspberry Pi".

b. Hero meta line: replace
`macOS · Windows · Raspberry Pi &nbsp;·&nbsp; No account, no telemetry`
with
`macOS · Windows · iPhone &amp; iPad · Raspberry Pi &nbsp;·&nbsp; No account, no telemetry`.

c. Platforms section (`#platforms`): add to `.platform-list` after the
Windows item:

```html
<li>
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>
  <span>iPhone &amp; iPad: <a href="APP_STORE_URL" target="_blank" rel="noopener">free on the App Store</a></span>
</li>
```

and update the platforms paragraph's closing sentence from
"so it works on a phone or tablet too." to
"and the iPhone and iPad app is a free download on the App Store."

d. Install section: add an install card after Windows:

```html
<article class="install-card">
  <h3><span class="step-os">iPhone &amp; iPad</span></h3>
  <p>Install free from the App Store. Import your eBird backup and Macaulay Library export from the Files app in Settings; updates arrive through the App Store.</p>
  <a class="btn btn-small" href="APP_STORE_URL" target="_blank" rel="noopener">Get it on the App Store</a>
</article>
```

(Plain text link styling, no Apple badge artwork: the site is dependency-free
and downloads no external assets. If the official badge is wanted later it
must be a locally hosted asset used per Apple's marketing guidelines.)

## 3. product-brief.md (FR-25, QA-16 — the conscious founding-decision amendment)

Replace the distribution decision line:

> - Distributed as a standalone Mac/Windows desktop app and a self-hosted Pi/Linux install.

with:

> - Distributed as a standalone Mac/Windows desktop app, a self-hosted Pi/Linux install, and (amended at the 1.0.0 App Store debut, 2026) an iPhone/iPad app on the public App Store.

Also update the line-4 description's platform sentence from "It runs as a
standalone Mac or Windows desktop app, or self-hosted on a Raspberry Pi or
any computer on your network." to "It runs as a standalone Mac or Windows
desktop app, as an iPhone/iPad app from the App Store, or self-hosted on a
Raspberry Pi or any computer on your network."

## 4. Checks that ride the Phase B push

- Grep the em-dash sweep over the edited files (README.md, website/index.html,
  product-brief.md): must stay clean.
- Re-verify each new sentence against the live listing (the app really is
  findable and installs free) per the standing accuracy rule, then close
  QA-15/QA-16.
- website/privacy.html and PRIVACY_POLICY.md: no edit (shipped in Phase A);
  confirm `privacyPageParity.test.ts` still green if anything nearby moved.
