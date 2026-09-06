// The ONE place the verification gate resolves Playwright.
//
// Playwright is a dependency of THIS package (`website/tools/package.json`),
// declared and locked, so a relative resolution from this file finds it in
// `website/tools/node_modules` on any machine. It is deliberately not a
// `frontend` dependency: declaring it there would duplicate a version that
// drifts and put a browser download in every frontend install.
//
// Before the playwright-gate build the manifest and lockfile were gitignored,
// so the dependency existed on exactly one machine and every harness resolved
// it through a hand-written path -- one of them an absolute `/Users/...` path.
// Resolving it here, once, is what keeps that from coming back.

import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

const require = createRequire(import.meta.url)

/** @returns {typeof import('playwright')} */
export function requirePlaywright() {
  return require('playwright')
}

/**
 * Is the gate runnable on this machine?
 *
 * Two separate things can be missing and they read very differently in the
 * output, so they are reported separately: the npm package (`npm ci` was never
 * run here) and the browser binaries (`npx playwright install` was not). Both
 * are "the dependency is not available"; neither is ever a silent skip.
 *
 * @returns {{ ok: true } | { ok: false, reason: string, fix: string }}
 */
export function playwrightStatus() {
  let playwright
  try {
    playwright = requirePlaywright()
  } catch (err) {
    return {
      ok: false,
      reason: `the "playwright" package could not be resolved from website/tools (${err.code ?? err.message})`,
      fix: 'npm ci --prefix website/tools',
    }
  }

  const missing = []
  for (const [name, type] of [['chromium', playwright.chromium], ['webkit', playwright.webkit]]) {
    let path
    try {
      path = type.executablePath()
    } catch (err) {
      missing.push(`${name} (${err.message.split('\n')[0]})`)
      continue
    }
    if (!existsSync(path)) missing.push(`${name} (no binary at ${path})`)
  }
  if (missing.length) {
    return {
      ok: false,
      reason: `Playwright is installed but these browsers are not: ${missing.join(', ')}`,
      fix: 'npx playwright install chromium webkit   # from website/tools',
    }
  }

  return { ok: true }
}
