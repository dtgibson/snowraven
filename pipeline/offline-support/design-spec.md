# Offline Maps — Design Spec

## Visual Direction

Offline support is a quiet utility addition that must be *structurally indistinguishable* from the existing Settings sections. It is one more `SectionHeader` eyebrow + bordered-card pair, slotted into Settings near the other map/preference sections (after Default Files / Default Location). The brand rule holds: one accent per surface — the green `--sr-accent` carries the toggle-ON track, the primary Download buttons, the progress fill, and the `✓ Up to date` confirmation — and nothing else is colored. Copy is informative-not-promotional ("Nothing downloads until you turn this on.").

The fidelity correction from the critique drove the structure: in `Settings.tsx`, descriptive copy is **never baked into a control row** — it is a muted `<p style="fontSize:0.75rem;color:var(--sr-text-muted)">` placed *below* the bordered card (the exact pattern under API Keys and Default Files). So the toggle row holds only the standalone `ToggleSwitch`; the "Download map regions…" sentence lives below the card; and the region list is flat `.card-row`s separated by `--sr-border-subtle`, nested in the same card under the toggle.

Two "tones" are borrowed from elsewhere in the app rather than invented:
- **Amber "Out of date" badge** uses the app's **warning vocabulary** (`--sr-warning` text on `--sr-warning-bg` with a `--sr-warning-subtle` border) — the semantically-correct "attention, not error" family, already tuned in both themes, and the same family as the offline `panel-warning` used elsewhere in this mockup. (This replaces the draft's milestone tier-4 tokens, which are achievement chips on a deliberately-light surface and were a semantic stretch for a status pill.)
- **Offline/staleness cues** reuse the `WeatherTidePanel` info-panel shape (icon + 0.8125rem body) in three severities: accent-tint (replay available, `role=status`), amber-warning (live-only feature down, `role=status`), and red (`role=alert`, a genuine failure).

Every color is a `var(--sr-*)` token; both themes ship faithfully (light is the app default and is shown first — flip with the top-right button). The only literal `rgba(0,0,0,…)` values are verbatim reproductions of shipped source (the ToggleSwitch knob shadow, the `.sr-map-layers` box-shadow, the global focus ring); invented depth surfaces use `var(--sr-card-shadow)`.

## Screens

1. **Settings → Offline maps, toggle OFF (default, FR-11a).** `ToggleSwitch` on `--sr-gray-400` track, the explanatory sentence as a muted `<p>` below the card, and the manager body collapsed behind a faint `--sr-accent-surface` hint panel pointing back up to the toggle. No download control, no tile bytes. (Toggle is live in the mock — click it to see the OFF→ON knob/track slide.)
2. **Settings → Offline maps, toggle ON (desktop region manager).** Same card, toggle now on `--sr-accent`. Reveals, as `--sr-border-subtle`-separated flat rows in the SAME card: a **"Counties you bird"** group label with one muted line stating it derives from the user's eBird backup; Marin (~24 MB, Download CTA + size chip); an **in-progress** row (San Mateo — determinate `progressbar` + live `aria-live` "X MB of Y MB" status + visible % + Cancel, animated in the mock); a secondary **"Download a whole state instead"** expander (California ~310 MB, coarser zoom); then **"Downloaded regions"** (Santa Clara 41 MB + Alameda 40 MB both fresh with `✓ Up to date`, Sonoma 35 MB with the **Out of date** warning badge + Update), capped by "Using 116 MB across 3 regions" (41 + 40 + 35 = 116, internally consistent).
3. **Settings → Offline maps, toggle ON, empty (no regions yet).** Honest ON-with-zero state: a centered download-icon empty block ("No regions downloaded yet — pick a county below…"), one available county, and a "Using 0 MB" total — so the manager is never just bare group labels.
4. **Settings → Offline maps, a download that just failed (`role=alert`).** Napa's row sublabel reads "Download failed · nothing saved" (agreeing with the alert below it), a Retry button, and a single red `role=alert` strip naming where it dropped.
5. **Settings → Offline maps, web / self-hosted (`!isTauri()`).** Disabled `ToggleSwitch` (native `disabled` so it's not a tab stop; only the track dimmed so the label stays legible) + a single honest note "Region downloads are available in the desktop app. Nothing is stored either way…" — privacy reassurance kept consistent with the OFF state.
6. **Weather & Tide panel — offline replay cue.** Accent-tint `role=status` panel ("Offline — showing the last loaded result (loaded 2:14 PM)") directly above the replayed mono block; cue carried by WifiOff icon + text, never color alone.
7. **Location search — "You're offline" live-only state.** Disabled search input + an amber `role=status` panel whose copy is explicitly "You're offline" (distinct from "no API key").
8. **Map Explorer base switcher.** The real `.sr-map-layers` panel: "Map" base active+enabled (`aria-pressed=true`); Satellite, Topo (US), and Trails `disabled` + `aria-disabled` (so not tab stops) with `aria-pressed` dropped from the disabled bases, the offline reason exposed programmatically via `aria-describedby` → the visible "Online only" WifiOff caption.

## Component Usage

- **ToggleSwitch** (`ui/ToggleSwitch.tsx`) — verbatim for "Enable offline maps": 30px pill, 1.5px `--sr-border`, 28×16 track (`--sr-gray-400` OFF / `--sr-accent` ON), 12×12 white knob sliding 2→14, trailing 0.75rem/500 `--sr-text-muted` label, `role=switch` + `aria-checked`. Disabled web build uses native `disabled` + `aria-disabled`.
- **Settings section** (`Settings.tsx`) — `SectionHeader` eyebrow (0.6875rem/600 uppercase, 0.07em tracking, hairline rule, mb12) + bordered card (1px `--sr-border`, radius 10, `--sr-surface`, overflow hidden); rows `14px 16px`, separated by 1px `--sr-border-subtle`; descriptive copy as a muted `<p>` BELOW the card.
- **Row with icon tile** — mirrors `FileRow`: 38×38 radius-9 tile (`--sr-accent-bg`/accent icon when present, `--sr-surface-subtle`/`--sr-text-disabled` when absent) + flex column (0.84375rem/600 title, muted sublabel) + trailing `sr-action-row sr-action-row-stack` action cluster.
- **Buttons** — Primary (Download): `--sr-accent` / `--sr-on-accent`, no border. Secondary (Update, Cancel, Download state, expander): 1.5px `--sr-border`. **Destructive (Remove): a LABELED text button** (1.5px `--sr-error-border` + `--sr-error` text) matching FileRow's "Clear" convention — not an icon-only trash — plus a `title` tooltip per the app's tooltip-friendly stance.
- **Status chip** — FileRow's "No file saved" pill shape for the inline size estimate (`~24 MB`).
- **Out-of-date badge** — warning vocabulary: `--sr-warning` text on `--sr-warning-bg` with a `--sr-warning-subtle` border + AlertTriangle icon (both themes pre-tuned in globals.css).
- **Progress bar** — token-built: 8px track (`--sr-surface-subtle` + 1px `--sr-border-input` ≥3:1 non-text outline), `--sr-accent` fill, `role=progressbar` + `aria-value*` + an `aria-live="polite"` "X MB of Y MB" status + a visible % node (state never by color alone).
- **Info/cue panels** — `WeatherTidePanel` shape; accent / warning / error variants chosen by `role` and token family; faint `panel-hint` (matching AppearanceRow's consent note) for the OFF / web pointers.
- **Base switcher** — `.sr-map-layers` / `.sr-map-layers-seg` / `.sr-map-layers-trails` reproduced from globals.css with the real labels ("Map" / "Satellite" / "Topo (US)" + a separate Trails checkbox); raster buttons + Trails disabled offline with the WifiOff "Online only" hint.

## Design Tokens Applied

- Surfaces: `--sr-bg` (page), `--sr-surface` (cards), `--sr-surface-subtle` (disabled-manager wash, chips, disabled search), `--sr-surface-faint` (state-expander panel, mono block, map placeholder), `--sr-accent-surface` (OFF / web hint panels).
- Text: `--sr-text` (titles, names), `--sr-text-muted` (copy/captions/timestamps/percent), `--sr-text-gray` (county "· CA" / size metadata), `--sr-text-disabled` (disabled controls only).
- Accent: `--sr-accent` (toggle ON, Download, progress fill, ✓ Up to date, vector base), `--sr-on-accent`, `--sr-accent-bg` (present tiles), `--sr-accent-border`.
- Borders: `--sr-border` (card outline, neutral buttons), `--sr-border-subtle` (row separators, surface heads), `--sr-border-input` (progress track outline ≥3:1).
- Amber attention: `--sr-warning` / `--sr-warning-bg` / `--sr-warning-subtle` (Out-of-date badge AND the live-only offline panel — one warning family).
- Error: `--sr-error` / `--sr-error-bg` / `--sr-error-border` (failed-download alert + the Remove destructive border).
- Gray: `--sr-gray-400` (toggle OFF track).
- Depth: `--sr-card-shadow` on invented surfaces (surface-card); literal shadows only where reproducing shipped source (ToggleSwitch knob, `.sr-map-layers`, focus ring).
- All values are the real globals.css `:root` + `[data-theme="dark"]` pairs.

## Interaction Notes

- **Toggle:** `role=switch`, `aria-checked` carries state (the a11y contract); default OFF; OFF→ON reveals the manager in the same card. Web build: native `disabled` (removed from tab order) + `aria-disabled`; only the track is dimmed so the label stays legible.
- **Progress:** `role=progressbar` with `aria-valuenow/min/max` + `aria-label="Downloading {region}"` + `aria-describedby` the **`aria-live="polite"`** "X MB of Y MB" status, so screen-reader users get spoken progress; a visible % node is the non-color cue; paired neutral Cancel that stacks below the bar ≤480 (the `.progress-row` is a lifted class, reachable by the media query).
- **Failure / completion:** announced once via `role=alert` (failure) — the same live-region posture would carry a completion message; the failed row's sublabel mirrors the alert text so the row and its alert tell one story.
- **Remove / Update / Download:** labeled text `<button>`s, each with a `title` tooltip; every interactive button carries explicit `tabindex="0"` per the app's WKWebView convention.
- **State expander:** `aria-expanded` + `aria-controls`.
- **Cues:** replay = `role=status`; live-only offline = `role=status`; failure = `role=alert` — each conveys meaning by icon + text, never color alone.
- **Base switcher:** the active base keeps `aria-pressed`; **disabled bases drop `aria-pressed` and `tabindex`** (a disabled control is neither a toggle nor a tab stop) and expose the offline reason via `aria-describedby` to the visible "Online only" hint, not a title-only tooltip invisible to keyboard/touch.
- **Responsive 320→desktop** via `sr-action-row` / `sr-action-row-stack` (rows and the progress sub-row stack ≤480) and the 680px Settings column; all sizes in rem (holds at 200% text scale); `prefers-reduced-motion` honored (the mock's progress animation is gated on it; focus rings use the global `--sr-accent` ring).

## Content Notes

Real Bay Area counties at believable per-county tile sizes (Marin ~24 MB, San Mateo ~31 MB downloading, California whole-state ~310 MB; downloaded: Santa Clara 41 MB + Alameda 40 MB + Sonoma 35 MB = the honest "116 MB across 3 regions" total; the failed Napa ~22 MB). Copy is plain lowercase-sentence and honest: the OFF state and the web build both keep the privacy reassurance ("nothing is downloaded / stored until you…"); the "Counties you bird" group states it derives from the user's eBird backup so the auto-population isn't mysterious; the replay cue names the load time; the live-only panel says "You're offline" explicitly; the failed row's sublabel agrees with its alert. No lorem ipsum. Icons are inline Lucide SVG (map-pinned, download, download-cloud, check-circle, alert-triangle, refresh-cw, trash, wifi-off, monitor, search, map, chevron-down, chevron-up).