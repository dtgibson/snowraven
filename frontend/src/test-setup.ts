// Baseline animation-frame shims for the (node-env) test environment.
//
// Why: recharts bundles @reduxjs/toolkit, whose autoBatch enhancer races a
// captured requestAnimationFrame against a 100 ms fallback setTimeout — and
// calls bare cancelAnimationFrame(rafId) when the timer wins. Tests that stub
// rAF per-test (BirdingStats.test.tsx) and restore in afterEach leave that
// fallback timer firing AFTER the stubs are gone, in an environment with no
// native cancelAnimationFrame → an unhandled ReferenceError that vitest pins
// on whichever test happens to be running (the ~11% full-suite flake).
//
// These shims are idempotent baselines: they only install when the globals are
// undefined (per-file jsdom envs keep their real implementations), so the
// fallback timer always finds a cancelAnimationFrame to call.
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0)) as unknown as typeof requestAnimationFrame
}
if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = clearTimeout as unknown as typeof cancelAnimationFrame
}
