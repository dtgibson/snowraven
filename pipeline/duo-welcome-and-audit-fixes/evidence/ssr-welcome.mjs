// Render WelcomeScreen to static markup through Vite's SSR loader (no server listens).
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const req = createRequire(process.cwd() + '/package.json')
const { createServer } = await import(pathToFileURL(req.resolve('vite')).href)
import { writeFileSync } from 'node:fs'
const out = process.argv[2]
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const React = (await import(pathToFileURL(req.resolve('react')).href)).default
  const { renderToStaticMarkup } = await import(pathToFileURL(req.resolve('react-dom/server')).href)
  const { WelcomeScreen } = await server.ssrLoadModule('/src/components/WelcomeScreen.tsx')
  const noop = () => {}
  writeFileSync(out, renderToStaticMarkup(React.createElement(WelcomeScreen, { onGetStarted: noop, onOpenHelp: noop, onDismiss: noop })))
} finally { await server.close() }
