/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// jsdom ships without declarations in this repo; this test uses only its window.
// @ts-expect-error No declaration file is installed for the dev-only jsdom package.
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { ANDROID_WEBVIEW_FLOOR, WEBVIEW_FLOOR_MESSAGE, WEBVIEW_FLOOR_PROBE } from './webviewFloor'

const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8')
const bootScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
if (!bootScript) throw new Error('Launch controller is missing from index.html')

// `env` models what the launch script can see before the bundle: the os
// plugin's injected internals (absent on web) and CSS.supports() for the
// WebView floor probe (android-release FR-33).
interface LaunchEnv { osPlatform?: string; supportsFloor?: boolean }

function start(env: LaunchEnv = {}) {
  const dom = new JSDOM(html, { url: 'https://snowraven.test/', runScripts: 'outside-only' })
  const supportsCalls: Array<[string, string]> = []
  if (env.osPlatform !== undefined) {
    Object.defineProperty(dom.window, '__TAURI_OS_PLUGIN_INTERNALS__', { value: { platform: env.osPlatform } })
  }
  if (env.supportsFloor !== undefined) {
    const supportsFloor = env.supportsFloor
    Object.defineProperty(dom.window, 'CSS', {
      value: { supports: (p: string, v: string) => { supportsCalls.push([p, v]); return supportsFloor } },
    })
  }
  const frames = new Map<number, FrameRequestCallback>()
  const timers = new Map<number, { callback: () => void; delay: number }>()
  let nextId = 1
  dom.window.matchMedia = () => ({ matches: false }) as MediaQueryList
  dom.window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    const id = nextId++
    frames.set(id, callback)
    return id
  }
  dom.window.cancelAnimationFrame = (id: number) => { frames.delete(id) }
  dom.window.setTimeout = ((callback: () => void, delay: number) => {
    const id = nextId++
    timers.set(id, { callback, delay })
    return id
  }) as typeof dom.window.setTimeout
  dom.window.clearTimeout = (id: number) => { timers.delete(id) }
  dom.window.eval(bootScript)
  const launch = (dom.window as unknown as { srLaunch: { release(): void; fail(): void } }).srLaunch
  const splash = dom.window.document.getElementById('sr-launch')!
  const status = dom.window.document.getElementById('sr-launch-status')!
  const reload = dom.window.document.getElementById('sr-launch-reload') as HTMLButtonElement
  return {
    dom, frames, timers, launch, splash, status, reload, supportsCalls,
    firstPaint() {
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach(callback => callback(0))
    },
    fire(delay: number) {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay)
      if (!entry) throw new Error(`No ${delay}ms timer`)
      timers.delete(entry[0])
      entry[1].callback()
    },
  }
}

describe('launch splash', () => {
  it('keeps the native and first web frame on the same brand field and 88-point glyph', () => {
    const root = resolve(import.meta.dirname, '../../../')
    const tokens = readFileSync(resolve(root, 'frontend/src/globals.css'), 'utf8')
    const storyboard = readFileSync(resolve(root, 'src-tauri/gen/apple/LaunchScreen.storyboard'), 'utf8')
    const tauri = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'))
    const nativeColor = storyboard.match(/<color key="backgroundColor" red="([^"]+)" green="([^"]+)" blue="([^"]+)"/)
    expect(nativeColor).not.toBeNull()
    const hex = nativeColor!.slice(1).map(channel => Math.round(Number(channel) * 255).toString(16).padStart(2, '0')).join('')
    expect(`#${hex}`).toBe('#2d8653')
    // The launch field is the saved founding green; the app accent stays deeper.
    expect(tokens).toMatch(/--sr-accent:\s*#277448/)
    expect(tauri.app.windows[0].backgroundColor).toBe('#2D8653')
    expect(html).toMatch(/\.sr-launch \{[^}]*background: #2D8653/)
    expect(html).toMatch(/\.sr-launch-mark \{[^}]*width: 88px; height: 88px/)
    expect(storyboard).toMatch(/firstAttribute="width" constant="88"/)
    expect(storyboard).toMatch(/firstAttribute="height" constant="88"/)
    for (const scale of [1, 2, 3]) {
      const png = readFileSync(resolve(root, `src-tauri/gen/apple/Assets.xcassets/LaunchRaven.imageset/LaunchRaven@${scale}x.png`))
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(png.readUInt32BE(16)).toBe(88 * scale)
      expect(png.readUInt32BE(20)).toBe(88 * scale)
    }
  })

  it('releases before first paint when the destination commits immediately', () => {
    const page = start()
    expect(page.splash.dataset.state).toBe('first')
    expect(page.status.textContent).toBe('Opening SnowRaven…')
    expect(page.reload.hidden).toBe(true)
    expect(page.dom.window.document.getElementById('root')?.hasAttribute('inert')).toBe(true)
    page.launch.release()
    expect(page.dom.window.document.getElementById('sr-launch')).toBeNull()
    expect(page.dom.window.document.getElementById('root')?.hasAttribute('inert')).toBe(false)
    expect(page.frames.size).toBe(0)
    expect(page.timers.size).toBe(0)
    page.dom.window.close()
  })

  it('shows truthful slow and long states without preventing a later release', () => {
    const page = start()
    page.firstPaint()
    page.fire(2000)
    expect(page.splash.dataset.state).toBe('slow')
    expect(page.status.textContent).toBe('Opening SnowRaven…')
    expect(page.reload.hidden).toBe(true)
    page.fire(15000)
    expect(page.splash.dataset.state).toBe('long')
    expect(page.status.textContent).toBe('SnowRaven is taking longer than expected')
    expect(page.reload.hidden).toBe(false)
    page.launch.release()
    expect(page.dom.window.document.getElementById('sr-launch')).toBeNull()
    page.dom.window.close()
  })

  it('makes a known entry failure actionable immediately', () => {
    const page = start()
    page.dom.window.dispatchEvent(new page.dom.window.Event('error'))
    expect(page.splash.dataset.state).toBe('error')
    expect(page.status.textContent).toBe('SnowRaven couldn’t open')
    expect(page.reload.hidden).toBe(false)
    expect(page.frames.size).toBe(0)
    expect(page.timers.size).toBe(0)
    page.dom.window.close()
  })
})

// android-release FR-33 / QA-33: the Android System WebView floor, decided by
// the inline launch script before the bundle loads.
describe('launch splash: the Android WebView floor', () => {
  const belowFloor = (page: ReturnType<typeof start>) =>
    (page.dom.window as unknown as { __SR_WEBVIEW_BELOW_FLOOR__?: boolean }).__SR_WEBVIEW_BELOW_FLOOR__

  it('the script, the probe and the copy agree with lib/webviewFloor.ts', () => {
    expect(ANDROID_WEBVIEW_FLOOR).toBe(111)
    expect(bootScript).toContain(`CSS.supports('${WEBVIEW_FLOOR_PROBE[0]}', '${WEBVIEW_FLOOR_PROBE[1]}')`)
    expect(bootScript).toContain(WEBVIEW_FLOOR_MESSAGE)
    expect(bootScript).toContain("osInternals.platform === 'android'")
    // revised FR-33: the sentence names the WebView and no store
    expect(WEBVIEW_FLOOR_MESSAGE).toContain('Android System WebView')
    expect(WEBVIEW_FLOOR_MESSAGE).not.toMatch(/Google|Play/)
  })

  it('web (no os plugin internals): the probe never runs and the launch is unchanged', () => {
    const page = start({ supportsFloor: false })
    expect(page.supportsCalls).toEqual([])
    expect(page.splash.dataset.state).toBe('first')
    expect(belowFloor(page)).toBeUndefined()
    page.dom.window.close()
  })

  it('another Tauri platform: the probe never runs', () => {
    const page = start({ osPlatform: 'ios', supportsFloor: false })
    expect(page.supportsCalls).toEqual([])
    expect(page.splash.dataset.state).toBe('first')
    page.dom.window.close()
  })

  it('Android at or above the floor: one probe call, nothing visible changes', () => {
    const page = start({ osPlatform: 'android', supportsFloor: true })
    expect(page.supportsCalls).toEqual([[...WEBVIEW_FLOOR_PROBE]])
    expect(page.splash.dataset.state).toBe('first')
    expect(page.status.textContent).toBe('Opening SnowRaven…')
    expect(belowFloor(page)).toBeUndefined()
    page.launch.release()
    expect(page.dom.window.document.getElementById('sr-launch')).toBeNull()
    page.dom.window.close()
  })

  it('Android below the floor: the message, no Reload, the React mount refused, nothing can overwrite it', () => {
    const page = start({ osPlatform: 'android', supportsFloor: false })
    expect(page.splash.dataset.state).toBe('webview')
    expect(page.status.textContent).toBe(WEBVIEW_FLOOR_MESSAGE)
    expect(page.reload.hidden).toBe(true)
    expect(belowFloor(page)).toBe(true)
    // no slow/long clock was started, and a module error cannot replace it
    expect(page.frames.size).toBe(0)
    expect(page.timers.size).toBe(0)
    page.dom.window.dispatchEvent(new page.dom.window.Event('error'))
    expect(page.splash.dataset.state).toBe('webview')
    expect(page.status.textContent).toBe(WEBVIEW_FLOOR_MESSAGE)
    expect(page.reload.hidden).toBe(true)
    // the frame stays visible: its status is not the visually hidden one
    expect(html).toMatch(/\.sr-launch\[data-state="first"\] \.sr-launch-status/)
    page.dom.window.close()
  })

  // Measured on the API 26 emulator (Android 8.0, WebView 58.0.3029.125): with
  // `inset: 0` the frame had no offsets in that engine, collapsed to a zero box
  // under its own overflow: hidden, and the floor message never showed; the
  // screen was the bare green field. The frame must draw in the WebViews it
  // exists to turn away, so its stylesheet uses nothing such an engine drops.
  it('the launch frame draws in a WebView below the floor: no inset shorthand, a plain fallback before every max()/min()/clamp()/env()', () => {
    const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1]
    expect(style, 'index.html has its launch <style>').toBeTruthy()
    const css = style!.replace(/\/\*[\s\S]*?\*\//g, '')
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      selector: m[1].trim(),
      decls: m[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
        const i = d.indexOf(':')
        return { prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() }
      }),
    }))
    // non-vacuity: the frame's own rule is found and carries its four offsets
    const frame = rules.find((r) => r.selector === '.sr-launch')
    expect(frame, 'the .sr-launch rule').toBeTruthy()
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(frame!.decls.some((d) => d.prop === side && d.value === '0'), `.sr-launch ${side}: 0`).toBe(true)
    }
    const modern = /\b(?:max|min|clamp|env)\(/
    let guarded = 0
    for (const r of rules) {
      for (const [i, d] of r.decls.entries()) {
        expect(d.prop, `${r.selector} uses the inset shorthand`).not.toMatch(/^inset(?:-block|-inline)?$/)
        if (!modern.test(d.value)) continue
        guarded++
        const fallback = r.decls.slice(0, i).some((p) => p.prop === d.prop && !modern.test(p.value))
        expect(fallback, `${r.selector} { ${d.prop}: ${d.value} } has no plain fallback before it`).toBe(true)
      }
    }
    // non-vacuity: the copy block's safe-area bottom is one such declaration
    expect(guarded).toBeGreaterThan(0)
  })

  it('main.tsx refuses to mount React when the script set the flag', () => {
    const main = readFileSync(resolve(import.meta.dirname, '../main.tsx'), 'utf8')
    expect(main).toMatch(/if \(!window\.__SR_WEBVIEW_BELOW_FLOOR__\) \{[\s\S]*createRoot\(/)
  })
})
