// Shared harness for the Hotspot Reports live measurements (scratch, not the repo).
// Every eBird-backed path is answered INSIDE the browser and counted, and every
// host other than the scratch backend is refused, so no probe spends the user's
// eBird key (the backend reads backend/.env) and no tile is fetched unless a
// probe asks for tiles explicitly.
import { chromium, webkit } from '/Users/developer/devwork/snowraven/website/tools/node_modules/playwright/index.mjs'
import { dismissWelcome } from '/Users/developer/devwork/snowraven/website/tools/verify/dismissWelcome.mjs'

export const BASE = 'http://127.0.0.1:1631'
export const ENGINES = { chromium, webkit }

// The ten demo hotspots, by region (website/tools/gen-demo-data.mjs LOCS).
const DEMO_IDS = {
  'US-NY': ['L191106', 'L109516', 'L152773', 'L152762', 'L139721', 'L207471', 'L444485'],
  'US-NJ': ['L137800', 'L295658', 'L207514'],
}

export function counters() {
  return { region: 0, codes: 0, ebirdBlocked: [], foreign: [], tiles: 0, other: [] }
}

/** Route everything that could leave the machine or reach eBird. */
export async function installRoutes(ctx, c, { allowTiles = false, regions = DEMO_IDS, codes = {} } = {}) {
  await ctx.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.host !== '127.0.0.1:1631') {
      if (allowTiles) { c.tiles++; return route.continue() }
      c.foreign.push(url.host)
      return route.abort()
    }
    const p = url.pathname
    if (p === '/map/hotspot-region') {
      c.region++
      const ids = regions[url.searchParams.get('regionCode') ?? ''] ?? []
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ids) })
    }
    if (p === '/settings/hotspot-regions-v1') {
      if (route.request().method() === 'GET') return route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Not Found"}' })
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    }
    if (p === '/taxonomy/codes') {
      c.codes++
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ codes, orders: {}, formCodes: {} }) })
    }
    if (p.startsWith('/map/') || p.startsWith('/checklists') || p.startsWith('/weather') || p.startsWith('/tide') || p.startsWith('/taxonomy') || p.startsWith('/hotspots') || p.startsWith('/geocode') || p.startsWith('/nominatim')) {
      c.ebirdBlocked.push(p)
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"blocked by probe"}' })
    }
    return route.continue()
  })
}

export async function openApp(page, { iosInset = false } = {}) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
  if (await welcome.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)) await dismissWelcome(welcome)
  if (iosInset) await applyIos(page)
}

/** The iOS app in a plain browser: `.sr-ios-app` on <html> (re-applied after
 *  boot, testing.md v1.0.45) and the 34px home-indicator inset, written where
 *  `env(safe-area-inset-bottom)` would read it. */
export async function applyIos(page) {
  await page.evaluate(() => {
    document.documentElement.classList.add('sr-ios-app')
    let s = document.getElementById('probe-ios-inset')
    if (!s) { s = document.createElement('style'); s.id = 'probe-ios-inset'; document.head.appendChild(s) }
    s.textContent = '.sr-ios-app .sr-nav-sheet { padding-bottom: calc(14px + 34px) !important; } .sr-ios-app .sr-navbar { padding-bottom: calc(6px + 34px) !important; }'
  })
}

export async function setScale(page, scale) {
  await page.evaluate(s => document.documentElement.style.setProperty('--sr-text-scale', String(s)), scale)
  // Prove it applied on a rem-sized descendant (testing.md v1.0.6, v1.0.56).
  await page.waitForFunction(s => {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize)
    return Math.abs(root - 16 * s) < 0.01
  }, scale)
}

export async function selectTab(page, name) {
  await page.waitForSelector('[role="tab"], .sr-navbar-cell', { timeout: 30000 })
  const tabs = page.locator('[role="tab"]')
  if (await tabs.count()) {
    const t = page.locator('[role="tab"]', { hasText: name })
    if (await t.count()) { await t.first().click(); return }
    await page.locator(`[role="tab"][aria-label="${name}"]`).first().click()
    return
  }
  const cell = page.locator('.sr-navbar-cell', { hasText: name })
  if (await cell.count()) { await cell.first().click(); return }
  await page.locator('.sr-navbar button[aria-haspopup="dialog"]').click()
  await page.waitForSelector('[role="dialog"] .sr-nav-item')
  await page.waitForTimeout(400)
  await page.locator('[role="dialog"] .sr-nav-item', { hasText: name }).first().click()
}

export { assertBackendServesDemoData } from '/Users/developer/devwork/snowraven/website/tools/capture-lib.mjs'
