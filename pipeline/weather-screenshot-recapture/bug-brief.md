## What is broken

The Weather screenshot published on the website was captured before the Weather lookup finished. The committed `website/assets/shots/weather.webp` is 1080×1385 and shows `Looking up...` plus Tide output, but no Weather output. This contradicts the image alt text, which describes both a formatted weather summary and a tide block.

The page also declares the screenshot as 1080×1327 in `website/index.html`, so its HTML dimensions do not match the current file's 1080×1385 intrinsic dimensions.

The regression was introduced by the capture in commit `03adcf3`. A complete earlier frame still exists locally at `website/tools/shots/weather-light.png`; processing it with the unchanged Sharp operation from `website/tools/process-img.mjs` produces the historically correct 1080×2021 asset with SHA-256 `99eabd809b96a52da7be1ae807bcfc1d6c5afdef0cb414e919362034a4c1e664`, matching the committed asset from `43d5593` and `03adcf3^`.

The root cause is a race in `website/tools/capture.mjs`. Its readiness predicate accepts `Sunset`, `Tide`, or `Station`, so Tide alone can satisfy the wait while Weather is still loading. The readiness timeout is swallowed, the later guard rejects only an explicit `Weather data unavailable` result, and the outer capture block logs a failure without making the command exit nonzero. A partial Weather frame can therefore be reported as a successful capture and published.

## Steps to reproduce

1. Run the website screenshot capture when Tide resolves before Weather.
2. Observe that the current readiness predicate succeeds as soon as `Tide` or `Station` appears, even while the button still says `Looking up...` and no Weather result is present.
3. Allow the image pipeline to process the captured `website/tools/shots/weather-light.png` into `website/assets/shots/weather.webp`.
4. Load the website in a headless browser and inspect the Weather image. The committed regression reports `naturalWidth: 1080` and `naturalHeight: 1385`, while the markup declares `width="1080" height="1327"`; visual inspection shows Tide output but no Weather output.

## Expected behavior

The capture must wait until both result groups are complete: Weather output, indicated by `Sunrise` or `Sunset` (or an equivalently specific completed-Weather marker), and Tide output, indicated by `Tide` or `Station`. A loading, missing-key, unavailable, timed-out, or otherwise incomplete Weather state must never be accepted as success.

If the Weather screenshot cannot reach that complete state, `capture.mjs` must fail closed and exit nonzero. A successful capture must show the restored `Get weather` button, checklist context, full Weather output, full Tide output, and the combined-copy action.

The regenerated asset and its HTML dimensions must land atomically. The processed file must be 1080×2021, and `website/index.html` must declare `width="1080" height="2021"`.

## Blast radius

The required change is limited to hardening `website/tools/capture.mjs`, regenerating `website/assets/shots/weather.webp` from the complete frame, and updating the Weather image dimensions in `website/index.html`. A narrowly scoped automated capture guard or probe may be added if useful.

Application behavior, `website/tools/process-img.mjs` transformation parameters, other website screenshots, App Store screenshots and `capture-appstore.mjs`, README/help copy, versioning, changelog, release, and deployment files are unaffected.

## What done looks like

- The capture readiness check requires both completed Weather and Tide output; Tide alone cannot satisfy it.
- The readiness timeout is not swallowed, and `Looking up...`, missing-key, unavailable, or incomplete result states cannot log success.
- Any Weather capture failure makes `capture.mjs` exit nonzero.
- Processing the complete capture produces `website/assets/shots/weather.webp` at exactly 1080×2021.
- A headless browser reports both declared and natural dimensions as 1080×2021.
- Local image inspection confirms that the screenshot contains complete Weather and Tide output matching the unchanged alt text.
- Only the scoped capture script, generated Weather asset, matching HTML dimensions, and any narrowly scoped guard change in this build.
