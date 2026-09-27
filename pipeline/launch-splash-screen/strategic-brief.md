# Strategic Brief — Launch Splash Screen

## What We're Building

A quiet SnowRaven splash that appears while the app first opens: a small, centered raven glyph on a full-screen green field. It gives the launch a recognizable visual from the first available frame, then yields to the first usable app screen without making the user wait for the sake of an animation.

## Why Now

SnowRaven now reaches birders on iPhone, iPad, Mac, Windows, and self-hosted web installs, but its entry is still split between a plain iOS launch screen and a static “SnowRaven” label with a spinner before the web app mounts. A single, restrained launch impression fits the mature app and its existing brand better than those disconnected states. The user pointed to MarkTodo's splash as a model for the moment and suggested a centered glyph on SnowRaven green; its lifecycle is useful precedent, while SnowRaven's own artwork and colors set the identity.

## The User Problem

A birder opening SnowRaven may see a blank native launch frame, then text and a spinner, then the actual app. These handoffs feel unfinished and can look like separate starts even when the app is working normally. A coherent splash reassures them that SnowRaven is opening, while keeping the route to their saved tabs, first-run welcome, or an honest error as short as possible.

## Success Criteria

- A normal cold launch shows one recognizable SnowRaven composition, with the mark visually centered and the field covering the available screen on iPhone and iPad, including rotated or resized windows.
- The iOS native launch frame and the following app-owned splash feel continuous; desktop and web launches use the same visual direction at the earliest point the shared frontend can paint.
- Once the first usable screen or an actionable startup error is ready, the splash leaves promptly. A fast launch does not pause to make the splash visible, and a slow or failed launch never leaves a decorative screen covering the information the user needs.
- The launch looks intentional in both light and dark settings and does not flash a white or mismatched intermediate surface.
- The mark is decorative for assistive technology. A screen reader still gets a meaningful loading state and reaches the app or error when it appears; any exit motion respects reduced-motion settings.

## Scope

- Replace the current pre-React text-and-spinner boot presentation with a minimal brand splash using the committed SnowRaven raven glyph as the art source.
- Make the iOS launch storyboard visually consistent with the app-owned first frame, so the native-to-webview handoff reads as one opening.
- Define the splash's arrival and exit around actual startup readiness, including first-run welcome and startup failure paths, without delaying or changing the underlying load.
- Cover the current SnowRaven distribution surfaces: iPhone and iPad, Mac and Windows desktop, and the self-hosted web/Pi frontend. Adapt to viewport size, orientation, and safe areas.
- Verify the visible launch sequence in a real rendered environment, including a fast start, a deliberately slow start, light and dark settings, and reduced motion.

## Out of Scope

- A new logo, app icon, illustrated scene, slogan, progress percentage, or looping animation.
- Splashing again for tab switches, data-file imports, background refreshes, widget navigation within an already open app, or routine in-app loading states.
- Changing SnowRaven's data loading, saved-tab selection, welcome flow, error recovery, providers, or privacy behavior.
- Published website, README, or App Store listing language. This visual polish does not require a new public feature claim.

## Key Decisions

- **Use SnowRaven's mark and palette.** The committed raven glyph and the brand's Irish clover green are the starting point. The Designer settles the exact field treatment, glyph color, size, and optical centering after checking contrast and the native-to-app transition; the user's suggested composition is direction, not a frozen pixel specification.
- **Make launch visual, not a gate.** The splash reflects startup state and must not impose a minimum display time. MarkTodo's readiness-driven exit is the useful pattern; its blue gradient, four-dot mark, and exact timing are not SnowRaven requirements.
- **Carry one impression across the native and shared layers.** iOS can draw its launch storyboard before the webview exists, while the shared frontend can cover desktop and browser startup. The Planner and Architect should join these without a visible color or position jump and identify the first app state that can safely replace the splash.
- **Keep honest states visible.** If the app cannot become usable promptly, its existing loading or failure experience must take over rather than leaving an inert brand field indefinitely. Exact fallback timing and transition mechanics belong to the design and architecture work.
- **Alignment with the product brief.** This serves the same birder who wants to open their own local data quickly. It adds no account, network call, telemetry, or new workflow, and it preserves SnowRaven's calm, utility-first character.
