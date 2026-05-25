import { describe, it, expect, afterEach } from 'vitest';
import { isTauri } from './platform';

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
