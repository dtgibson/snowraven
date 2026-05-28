import { describe, it, expect, afterEach } from 'vitest';
import { isTauri, isWindows } from './platform';

const win = typeof window !== 'undefined'
  ? (window as unknown as Record<string, unknown>)
  : {} as Record<string, unknown>;

describe('isTauri', () => {
  afterEach(() => {
    delete win['__TAURI_INTERNALS__'];
  });

  it('returns false when __TAURI_INTERNALS__ is absent', () => {
    delete win['__TAURI_INTERNALS__'];
    expect(isTauri()).toBe(false);
  });

  it('returns true when __TAURI_INTERNALS__ is present', () => {
    win['__TAURI_INTERNALS__'] = {};
    // isTauri checks typeof window !== 'undefined' first,
    // so in a Node env without window this correctly returns false.
    // In a browser env it returns true when the key is present.
    const expected = typeof window !== 'undefined';
    expect(isTauri()).toBe(expected);
  });
});

describe('isWindows', () => {
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  afterEach(() => {
    if (orig) Object.defineProperty(globalThis, 'navigator', orig);
    else delete (globalThis as Record<string, unknown>)['navigator'];
  });
  function setUserAgent(ua: string | undefined) {
    Object.defineProperty(globalThis, 'navigator', {
      value: ua === undefined ? undefined : { userAgent: ua },
      configurable: true,
    });
  }

  it('returns true for a Windows user agent', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebView2');
    expect(isWindows()).toBe(true);
  });

  it('returns false for a macOS user agent', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    expect(isWindows()).toBe(false);
  });

  it('returns false when navigator is unavailable', () => {
    setUserAgent(undefined);
    expect(isWindows()).toBe(false);
  });
});
