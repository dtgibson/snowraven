// Shared Playwright helpers for the two screenshot capture scripts
// (capture.mjs → website shots, capture-appstore.mjs → App Store sets).
// Extracted verbatim from capture.mjs so both consumers drive the app the
// same way; the only change is parameterization (the browser instance and
// the deviceScaleFactor are arguments instead of module state).

// Chromium flags for headless WebGL (the MapLibre maps render through
// SwiftShader) plus hidden scrollbars so captures are clean.
export const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'];

// New context + page with the app theme pre-seeded (the sr-theme localStorage
// key is read by the app's anti-flash script before first paint).
export async function makePage(browser, theme, vp, deviceScaleFactor = 2) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor });
  await ctx.addInitScript((t) => { try { localStorage.setItem('sr-theme', t); } catch (e) {} }, theme);
  const p = await ctx.newPage();
  p.setDefaultTimeout(30000);
  return { ctx, p };
}

// Select a tab by its EXACT rendered text, in whichever form the nav is showing:
// the horizontal strip (wide viewports) or the collapsed dropdown (narrow ones,
// and any viewport too small for the strip). Waits for the nav to exist first,
// so it cannot race the initial CSV load.
//
// A miss THROWS. It used to return false, which meant a renamed label — or a nav
// that had collapsed to a dropdown — silently yielded a screenshot of whatever
// tab was already open, with an exit code of 0. Both of those actually happened.
// A wrong-but-plausible screenshot is far worse than a missing one, so this fails
// loudly instead. (Still check the output images by eye: this catches the
// wrong-tab class of failure, not a tab that rendered badly.)
export async function selectTab(p, name) {
  await p.waitForSelector('[role="tab"], button[aria-haspopup="listbox"]', { timeout: 30000 });

  const strip = await p.$$('[role="tab"]');
  if (strip.length) {
    const seen = [];
    for (const h of strip) {
      const text = (await h.textContent() || '').trim();
      seen.push(text);
      if (text === name) { await h.click(); return; }
    }
    throw new Error(`tab "${name}" not in the tab strip — saw: ${seen.join(' | ')}`);
  }

  // Collapsed nav: open the listbox, then pick the option.
  const trigger = await p.$('button[aria-haspopup="listbox"]');
  if (!trigger) throw new Error(`no tab strip and no nav dropdown while looking for "${name}"`);
  await trigger.click();
  await p.waitForTimeout(400);
  const seen = [];
  for (const o of await p.$$('[role="option"], [role="listbox"] button, [role="listbox"] li')) {
    const text = (await o.textContent() || '').trim();
    seen.push(text);
    if (text === name) { await o.click(); return; }
  }
  throw new Error(`tab "${name}" not in the nav dropdown — saw: ${seen.join(' | ')}`);
}
