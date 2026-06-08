# Website screenshot tooling

The screenshots on the site (`../assets/shots/*.webp`) are generated from the running
SnowRaven app driven against **synthetic demo data — never real eBird data**. The
published site must never contain anyone's personal sighting locations, which is the
whole point of the demo dataset. Regenerate the shots when the UI changes.

## Prerequisites

```
npm install playwright sharp
npx playwright install chromium
```

## Steps

1. **Generate the demo dataset** (a fictional birder at well-known public northeast-US
   hotspots; deterministic):

   ```
   node gen-demo-data.mjs        # -> ./demo-data/{ebird-backup,ml-export}.csv + metadata + map-defaults
   ```

2. **Run SnowRaven against the demo data — not your real data.** Build the frontend so
   the backend serves it (`cd ../../frontend && npm run build`), then load the demo files.
   The safest no-source-change way is to temporarily set your real data aside:

   ```
   mv ../../data ../../data.real
   mkdir ../../data && cp demo-data/* ../../data/
   (cd ../../backend && .venv/bin/uvicorn main:app --port 1620)
   #  ... run the capture (step 3) ...
   rm -rf ../../data && mv ../../data.real ../../data     # ALWAYS restore
   ```

   Never leave your real data set aside. (If the backend grows an `SR_DATA_DIR`
   environment override, point that at `./demo-data` and skip the swap entirely.)

3. **Capture** (drives the app with Playwright; the live Weather + Tide shot uses a real
   **public** coastal eBird checklist so a tide shows — override with `CHECKLIST=...` if
   the default has aged out):

   ```
   BASE=http://localhost:1620 node capture.mjs        # -> ./shots/*.png
   ```

4. **Optimize** into the WebP assets the site serves:

   ```
   node process-img.mjs                               # -> ../assets/shots/*.webp
   ```

Then review the site, update any feature copy in `../index.html`, and commit
`website/` (the `demo-data/`, `shots/`, and `node_modules/` here are git-ignored).
