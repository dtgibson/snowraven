// Headless production-build verification for HelpDocs focus containment and
// stacked-overlay Escape ownership. Runs the real App in both shipped browser
// engines at desktop and phone sizes; no display server or GUI input is needed.

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { serveDist } from '../../website/tools/verify/serveDist.mjs'

const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium, webkit } = require('playwright')
const dist = resolve(fileURLToPath(new URL('../../frontend/dist/', import.meta.url)))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function json(res, value) {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(value))
}

const server = await serveDist(dist, {
  fallback: '404',
  routes(pathname, req, res) {
    if (pathname === '/settings/keys' && req.method === 'GET') {
      json(res, { ebird: null, openweather: null })
      return true
    }
    if (pathname === '/settings/files' && req.method === 'GET') {
      json(res, { ebird: null, ml: null })
      return true
    }
    if (pathname === '/settings/welcomeSeen' && req.method === 'GET') {
      json(res, false)
      return true
    }
    if (pathname === '/settings/welcomeSeen' && req.method === 'POST') {
      json(res, true)
      return true
    }
    return false
  },
})

const matrix = [
  { label: 'desktop', width: 1280, height: 800 },
  { label: 'phone', width: 390, height: 844 },
]

async function activeDescription(page) {
  return page.evaluate(() => {
    const active = document.activeElement
    if (!active || active === document.body) return '<body>'
    return active.getAttribute('aria-label') || active.textContent?.trim() || active.tagName
  })
}

async function runScenario(browserType, engine, viewport) {
  const browser = await browserType.launch({ headless: true })
  const page = await browser.newPage({ viewport })
  const prefix = `${engine}/${viewport.label}`
  try {
    await page.goto(server.base, { waitUntil: 'domcontentloaded' })
    const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
    const opener = page.getByRole('button', { name: 'Read the documentation' })
    await welcome.waitFor()
    await opener.click()

    const help = page.getByRole('dialog', { name: 'SnowRaven Documentation' })
    const close = page.getByRole('button', { name: 'Close documentation' })
    await help.waitFor()
    assert(await close.evaluate(el => el === document.activeElement), `${prefix}: Help did not take opening focus`)

    // Programmatic focus reaches a real covered Welcome control first; Help's
    // focusin arm must correct it synchronously, without waiting for Tab.
    await opener.focus()
    assert(await close.evaluate(el => el === document.activeElement), `${prefix}: outside focus was not contained`)

    const focusableCount = await help.evaluate(root => root.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ).length)
    assert(focusableCount >= 2, `${prefix}: Help has too few focusables to verify wrapping`)

    // Walk more than one complete cycle in both directions in the real engine.
    await close.focus()
    for (let i = 0; i < focusableCount + 2; i++) {
      await page.keyboard.press('Tab')
      assert(await help.evaluate(root => root.contains(document.activeElement)), `${prefix}: Tab escaped Help at step ${i + 1}`)
    }
    for (let i = 0; i < focusableCount + 2; i++) {
      await page.keyboard.press('Shift+Tab')
      assert(await help.evaluate(root => root.contains(document.activeElement)), `${prefix}: Shift+Tab escaped Help at step ${i + 1}`)
    }

    // Search's window-capture listener and later trap remain above Help.
    await page.keyboard.press('Control+k')
    const query = page.getByRole('combobox', { name: 'Search destinations and species' })
    await query.waitFor()
    assert(await query.evaluate(el => el === document.activeElement), `${prefix}: Search did not retain focus above Help`)
    await page.keyboard.press('Escape')
    await query.waitFor({ state: 'detached' })
    assert(await help.isVisible(), `${prefix}: Search Escape also closed Help`)

    // Once Search is gone, the still-open Help trap must resume containment.
    await opener.focus()
    assert(await help.evaluate(root => root.contains(document.activeElement)), `${prefix}: Help did not resume containment after Search`)

    // Help owns the next Escape before the lower Welcome listener.
    await page.keyboard.press('Escape')
    await help.waitFor({ state: 'detached' })
    assert(await welcome.isVisible(), `${prefix}: Help Escape dismissed Welcome underneath`)
    assert(await opener.evaluate(el => el === document.activeElement), `${prefix}: Help Escape restored ${await activeDescription(page)} instead of its opener`)

    // Exercise both close routes from the ordinary app as well as Welcome.
    await page.getByRole('button', { name: 'Explore the app first' }).click()
    await welcome.waitFor({ state: 'detached' })
    const footerOpener = page.getByRole('button', { name: 'Help', exact: true })
    await footerOpener.click()
    await help.waitFor()
    await close.click()
    await help.waitFor({ state: 'detached' })
    assert(await footerOpener.evaluate(el => el === document.activeElement), `${prefix}: Close did not restore the app opener`)

    await footerOpener.click()
    await help.waitFor()
    await page.keyboard.press('Escape')
    await help.waitFor({ state: 'detached' })
    assert(await footerOpener.evaluate(el => el === document.activeElement), `${prefix}: Escape did not restore the app opener`)

    console.log(`PASS ${prefix}: ${focusableCount} Help focusables contained`)
  } finally {
    await page.close()
    await browser.close()
  }
}

try {
  for (const [browserType, engine] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
    for (const viewport of matrix) await runScenario(browserType, engine, viewport)
  }
} finally {
  await server.close()
}
