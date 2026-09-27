/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// jsdom ships without declarations in this repo; this test uses only its window.
// @ts-expect-error No declaration file is installed for the dev-only jsdom package.
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8')
const bootScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
if (!bootScript) throw new Error('Launch controller is missing from index.html')

function start() {
  const dom = new JSDOM(html, { url: 'https://snowraven.test/', runScripts: 'outside-only' })
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
    dom, frames, timers, launch, splash, status, reload,
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
