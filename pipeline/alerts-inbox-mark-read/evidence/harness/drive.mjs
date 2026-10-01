// QA driver for alerts-inbox-mark-read: the real built app (frontend/dist) as
// the iPhone/iPad build against the faked native layer, in WebKit.
import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
const require = createRequire('/Users/developer/devwork/snowraven-alerts-inbox-mark-read/website/tools/package.json')
const { webkit } = require('playwright')

const EVID = '/Users/developer/devwork/snowraven-alerts-inbox-mark-read/pipeline/alerts-inbox-mark-read/evidence'
mkdirSync(EVID, { recursive: true })
const BASE = 'http://127.0.0.1:8847/?scenario=configured&bar=0'
const CLOSE = '[aria-label="Close the inbox"]'
const MARK = '.sr-inbox-actions button:has-text("Mark read")'

const CONFIGS = [
  { name: 'iphone-390-light', w: 390, h: 844, scheme: 'light', press: 'keyboard', clear: true, tab: true },
  { name: 'iphone-390-dark', w: 390, h: 844, scheme: 'dark', press: 'mouse' },
  { name: 'iphone-320-light', w: 320, h: 640, scheme: 'light', press: 'keyboard' },
  { name: 'iphone-320-dark', w: 320, h: 640, scheme: 'dark', press: 'mouse' },
  { name: 'iphone-320-light-text200', w: 320, h: 640, scheme: 'light', press: 'mouse', scale: 2 },
  { name: 'ipad-light', w: 1024, h: 1366, scheme: 'light', press: 'mouse', ipad: true, palette: true },
  { name: 'ipad-dark', w: 1024, h: 1366, scheme: 'dark', press: 'keyboard', ipad: true },
  { name: 'iphone-390-light-reduced-motion', w: 390, h: 844, scheme: 'light', press: 'mouse', reduced: true, shotsOff: true },
]

const results = []
const browser = await webkit.launch()

for (const cfg of CONFIGS) {
  const r = { config: cfg.name, press: cfg.press, checks: {} }
  const ctx = await browser.newContext({
    viewport: { width: cfg.w, height: cfg.h }, colorScheme: cfg.scheme,
    reducedMotion: cfg.reduced ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.goto(BASE + (cfg.ipad ? '&device=ipad' : ''))
  const OPENER = cfg.ipad ? '.sr-nav-inbox' : '.sr-hdr-inbox'
  await page.waitForSelector(OPENER, { timeout: 20000 })
  if (cfg.scale) {
    await page.evaluate(s => document.documentElement.style.setProperty('--sr-text-scale', String(s)), cfg.scale)
    r.checks.textScaleApplied = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sr-text-scale').trim())
  }
  const entry = async () => page.evaluate(([op]) => {
    const o = document.querySelector(op)
    const row = document.querySelector('.sr-inbox-link')
    return {
      opener: o?.getAttribute('aria-label'),
      openerBadge: o?.querySelector('.sr-badge, .sr-nav-count')?.textContent ?? null,
      settingsRow: row?.getAttribute('aria-label') ?? null,
      settingsRowSub: row?.querySelector('.sr-inbox-link-sub')?.textContent ?? null,
    }
  }, [OPENER])
  const settingsViewed = () => page.evaluate(() => window.__preview.settings()?.alertsInboxViewedAt ?? null)
  r.checks.entryBeforeOpen = await entry()
  r.checks.viewedBeforeOpen = await settingsViewed()

  // Open.
  await page.click(OPENER)
  await page.waitForSelector('.sr-inbox-root')
  await page.waitForTimeout(500)
  r.checks.viewedAfterOpen = await settingsViewed()
  r.checks.snapshotNowAtOpen = await page.evaluate(() => window.__previewLastNow)
  r.checks.beforePress = await page.evaluate(([mk]) => {
    const btns = [...document.querySelectorAll('.sr-inbox-actions button')]
    const fine = document.querySelector('.sr-inbox-fine').getBoundingClientRect()
    const panel = document.querySelector('.sr-inbox-foot').getBoundingClientRect()
    const rects = btns.map(b => { const x = b.getBoundingClientRect(); return { text: b.textContent, left: Math.round(x.left), right: Math.round(x.right), top: Math.round(x.top), height: Math.round(x.height), width: Math.round(x.width) } })
    return {
      order: btns.map(b => b.textContent),
      markDisabled: btns[0].disabled,
      clearDisabled: btns[1].disabled,
      rects,
      fine: { left: Math.round(fine.left), right: Math.round(fine.right), top: Math.round(fine.top), bottom: Math.round(fine.bottom) },
      foot: { left: Math.round(panel.left), right: Math.round(panel.right) },
      footOverflow: document.querySelector('.sr-inbox-foot').scrollWidth - document.querySelector('.sr-inbox-foot').clientWidth,
      pageScrollW: document.documentElement.scrollWidth,
      dots: document.querySelectorAll('.sr-alert-dot').length,
      newNames: [...document.querySelectorAll('.sr-alert')].filter(b => (b.getAttribute('aria-label') || '').startsWith('New. ')).length,
      rows: document.querySelectorAll('.sr-alert').length,
      statusText: document.querySelector('.sr-inbox-foot [role="status"]')?.textContent,
      statusLive: document.querySelector('.sr-inbox-foot [role="status"]')?.getAttribute('aria-live'),
      headerCount: document.querySelector('.sr-inbox-root')?.textContent.match(/\d+ alerts?/)?.[0],
    }
  }, [MARK])
  if (!cfg.shotsOff) await page.screenshot({ path: `${EVID}/${cfg.name}-1-before.png` })

  // Tab order: from the last row, Tab reaches Mark read then Clear.
  if (cfg.tab) {
    await page.focus('#sr-alerts-row-5')
    await page.keyboard.press('Tab')
    const a = await page.evaluate(() => document.activeElement?.textContent)
    await page.keyboard.press('Tab')
    const b = await page.evaluate(() => document.activeElement?.textContent)
    r.checks.tabFromLastRow = [a, b]
  }

  // The sampler: rAF frames record the marks' opacity from just before the press.
  await page.evaluate(() => {
    const t0 = performance.now()
    window.__samples = []
    window.__pressT = null
    document.querySelector('.sr-inbox-actions button').addEventListener('click', () => { window.__pressT = performance.now() - t0 }, { capture: true, once: true })
    const tick = () => {
      const dots = [...document.querySelectorAll('.sr-alert-dot')]
      const words = [...document.querySelectorAll('.sr-alert-new')]
      window.__samples.push({
        t: Math.round((performance.now() - t0) * 10) / 10,
        dots: dots.length,
        op: dots.map(d => Number(getComputedStyle(d).opacity).toFixed(2)).join(','),
        wop: words.map(d => Number(getComputedStyle(d).opacity).toFixed(2)).join(','),
        reading: document.querySelectorAll('.sr-alert--read').length,
      })
      if (performance.now() - t0 < 900) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const pressMark = async () => {
    if (cfg.press === 'keyboard') { await page.focus(MARK); await page.keyboard.press('Enter') }
    else await page.click(MARK)
  }
  await pressMark()
  const pressWall = Date.now()
  r.checks.immediatelyAfterPress = await page.evaluate(() => ({
    active: document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName,
    activeIsBody: document.activeElement === document.body,
    markDisabled: document.querySelector('.sr-inbox-actions button').disabled,
    statusText: document.querySelector('.sr-inbox-foot [role="status"]')?.textContent,
    newNames: [...document.querySelectorAll('.sr-alert')].filter(b => (b.getAttribute('aria-label') || '').startsWith('New. ')).length,
    rows: document.querySelectorAll('.sr-alert').length,
    headerCount: document.querySelector('.sr-inbox-root')?.textContent.match(/\d+ alerts?/)?.[0],
  }))
  r.checks.entryRightAfterPress = await entry()
  r.checks.viewedRightAfterPress = await settingsViewed()
  r.checks.snapshotNowAtPress = await page.evaluate(() => window.__previewLastNow)
  await page.waitForTimeout(950)
  const samples = await page.evaluate(() => ({ pressT: window.__pressT, samples: window.__samples }))
  // Summarize: frames with dots between press and unmount, with any mid-fade opacity.
  const after = samples.samples.filter(s => samples.pressT != null && s.t >= samples.pressT)
  const unmountAt = after.find(s => s.dots === 0)?.t ?? null
  const midFade = after.filter(s => s.dots > 0 && s.op.split(',').some(v => Number(v) > 0.02 && Number(v) < 0.98))
  r.checks.fade = {
    pressT: samples.pressT,
    unmountMsAfterPress: unmountAt != null ? Math.round(unmountAt - samples.pressT) : null,
    framesWithMarksAfterPress: after.filter(s => s.dots > 0).length,
    midFadeFrames: midFade.length,
    midFadeOpacities: midFade.slice(0, 8).map(s => `${Math.round(s.t - samples.pressT)}ms:${s.op}|${s.wop}`),
    preFrame: samples.samples.filter(s => s.t < samples.pressT).slice(-1)[0] ?? null,
  }
  if (!cfg.shotsOff) await page.screenshot({ path: `${EVID}/${cfg.name}-2-after-mark-read.png` })
  r.checks.afterFade = await page.evaluate(() => ({
    dots: document.querySelectorAll('.sr-alert-dot').length,
    words: document.querySelectorAll('.sr-alert-new').length,
    markedClasses: document.querySelectorAll('.sr-alert--new, .sr-alert--read').length,
    rows: document.querySelectorAll('.sr-alert').length,
    active: document.activeElement?.getAttribute('aria-label'),
  }))

  // Status clears after about 4 s.
  const waitLeft = 4300 - (Date.now() - pressWall)
  if (waitLeft > 0) await page.waitForTimeout(waitLeft)
  r.checks.statusAt4300ms = await page.evaluate(() => document.querySelector('.sr-inbox-foot [role="status"]')?.textContent)

  // Close with the X; "last viewed" must not move back.
  await page.click(CLOSE)
  await page.waitForSelector('.sr-inbox-root', { state: 'detached' })
  await page.waitForTimeout(150)
  r.checks.afterClose = {
    viewed: await settingsViewed(),
    entry: await entry(),
    focusBackOnOpener: await page.evaluate(([op]) => document.activeElement === document.querySelector(op), [OPENER]),
  }

  // Reopen: no New marks return.
  await page.click(OPENER)
  await page.waitForSelector('.sr-inbox-root')
  await page.waitForTimeout(450)
  r.checks.reopened = await page.evaluate(() => ({
    dots: document.querySelectorAll('.sr-alert-dot').length,
    newNames: [...document.querySelectorAll('.sr-alert')].filter(b => (b.getAttribute('aria-label') || '').startsWith('New. ')).length,
    markDisabled: document.querySelector('.sr-inbox-actions button').disabled,
    statusText: document.querySelector('.sr-inbox-foot [role="status"]')?.textContent,
  }))
  r.checks.viewedAfterReopen = await settingsViewed()
  if (!cfg.shotsOff) await page.screenshot({ path: `${EVID}/${cfg.name}-3-reopened.png` })

  // A newer snapshot: a check lands while the sheet is open.
  await page.waitForTimeout(1100)
  r.checks.addedAlertAt = await page.evaluate(() => window.__preview.addAlert('Little Stint'))
  await page.waitForFunction(() => document.querySelectorAll('.sr-alert').length === 7, null, { timeout: 5000 })
  await page.waitForTimeout(150)
  r.checks.newer = await page.evaluate(() => ({
    rows: document.querySelectorAll('.sr-alert').length,
    dots: document.querySelectorAll('.sr-alert-dot').length,
    newNames: [...document.querySelectorAll('.sr-alert')].filter(b => (b.getAttribute('aria-label') || '').startsWith('New. ')).map(b => b.id),
    markDisabled: document.querySelector('.sr-inbox-actions button').disabled,
  }))
  r.checks.entryWithNewer = await entry()
  if (!cfg.shotsOff) await page.screenshot({ path: `${EVID}/${cfg.name}-4-newer-alert.png` })

  // Second press announces again; then close at once: the status clears on close.
  await pressMark()
  r.checks.secondPress = await page.evaluate(() => ({
    active: document.activeElement?.getAttribute('aria-label'),
    statusText: document.querySelector('.sr-inbox-foot [role="status"]')?.textContent,
    statusChildTag: document.querySelector('.sr-inbox-foot [role="status"]')?.firstElementChild?.tagName ?? null,
    markDisabled: document.querySelector('.sr-inbox-actions button').disabled,
    snapshotNow: window.__previewLastNow,
  }))
  r.checks.viewedAfterSecondPress = await settingsViewed()
  await page.click(CLOSE)
  r.checks.statusDuringClosing = await page.evaluate(() => document.querySelector('.sr-inbox-foot [role="status"]')?.textContent ?? '(unmounted)')
  await page.waitForSelector('.sr-inbox-root', { state: 'detached' })
  await page.waitForTimeout(150)
  r.checks.afterSecondClose = { viewed: await settingsViewed(), entry: await entry() }

  // The palette's inbox row (Search) reads no count.
  if (cfg.palette) {
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(400)
    r.checks.paletteInboxRow = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[role="option"], .sr-palette-row')]
      const hit = rows.find(x => /inbox/i.test(x.textContent || '') || /inbox/i.test(x.getAttribute('aria-label') || ''))
      return hit ? { text: hit.textContent, label: hit.getAttribute('aria-label') } : '(not found)'
    })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  // Clear still asks and still leaves "last viewed" alone.
  if (cfg.clear) {
    const viewedBefore = await settingsViewed()
    const writesBefore = await page.evaluate(() => window.__preview.fsWrites.length)
    await page.click(OPENER)
    await page.waitForSelector('.sr-inbox-root')
    await page.waitForTimeout(450)
    const writesAfterOpen = await page.evaluate(() => window.__preview.fsWrites.length)
    const viewedAfterOpen = await settingsViewed()
    await page.click('.sr-inbox-actions button:has-text("Clear")')
    await page.waitForSelector('[role="dialog"]:has-text("Clear the inbox?")')
    const dialogButtons = await page.locator('[role="dialog"]:has-text("Clear the inbox?") button').allTextContents()
    await page.screenshot({ path: `${EVID}/${cfg.name}-5-clear-confirm.png` })
    await page.locator('[role="dialog"]:has-text("Clear the inbox?") button', { hasText: /^Clear$/ }).click()
    await page.waitForFunction(() => document.querySelectorAll('.sr-alert').length === 0, null, { timeout: 5000 })
    await page.waitForTimeout(200)
    r.checks.clear = {
      dialogButtons,
      viewedBefore, viewedAfterOpen, viewedAfterClear: await settingsViewed(),
      settingsWritesBeforeOpen: writesBefore, settingsWritesAfterOpen: writesAfterOpen,
      settingsWritesAfterClear: await page.evaluate(() => window.__preview.fsWrites.length),
      markDisabledEmpty: await page.evaluate(() => document.querySelector('.sr-inbox-actions button').disabled),
      clearDisabledEmpty: await page.evaluate(() => document.querySelectorAll('.sr-inbox-actions button')[1].disabled),
      active: await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName),
    }
    await page.screenshot({ path: `${EVID}/${cfg.name}-6-after-clear.png` })
  }

  r.checks.settingsWrites = await page.evaluate(() => window.__preview.fsWrites.map(w => w.viewed))
  r.errors = errs
  results.push(r)
  await ctx.close()
  console.log('done', cfg.name)
}
await browser.close()
writeFileSync(`${EVID}/real-render-results.json`, JSON.stringify(results, null, 2))
console.log('wrote results')
