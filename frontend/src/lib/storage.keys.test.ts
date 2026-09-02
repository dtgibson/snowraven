// icloud-api-key-sync FR-12 (QA-11) and the api-keys.json normalizer: on the
// Tauri path a key save stamps its change time and, when given, this device's
// origin, switch on or off; a pre-1.0.12 document reads untimed (changedAt
// null, never "now"); deleteApiKey removes the value AND its meta;
// clearApiKeyWithMarker leaves a marker; the normalizer drops each malformed
// meta shape and both inconsistencies while keeping the values; and
// getApiKey's answer is byte-identical to 1.0.11 for a shipped document.
// Note the stamp runs on EVERY Tauri build (storage.ts carries no platform
// branch): on Windows the field is inert. Same plugin-fs harness as
// storageWriteSerialization.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const API_KEYS_PATH = 'data/api-keys.json';

type FsOp = 'exists' | 'read' | 'write' | 'mkdir' | 'remove';
interface Step { op: FsOp; path: string; go: () => void }

const harness = {
  files: new Map<string, string>(),
  pending: [] as Step[],
  manual: false,
  reset() { this.files.clear(); this.pending = []; this.manual = false; },
};

function gate<T>(op: FsOp, path: string, effect: () => T): Promise<T> {
  if (!harness.manual) return Promise.resolve().then(effect);
  return new Promise<T>((resolve, reject) => {
    harness.pending.push({ op, path, go: () => { try { resolve(effect()); } catch (e) { reject(e); } } });
  });
}

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppLocalData: 4 },
  exists: (path: string) => gate('exists', path, () => harness.files.has(path)),
  readTextFile: (path: string) => gate('read', path, () => {
    const v = harness.files.get(path);
    if (v === undefined) throw new Error(`ENOENT: ${path}`);
    return v;
  }),
  writeTextFile: (path: string, content: string) => gate('write', path, () => { harness.files.set(path, content); }),
  mkdir: (path: string) => gate('mkdir', path, () => undefined),
  remove: (path: string) => gate('remove', path, () => { harness.files.delete(path); }),
}));

vi.mock('./platform', () => ({
  isTauri: () => true,
  isIOS: () => false,
  isWindows: () => false,
  isMacOS: () => true,
}));

import * as pluginFs from '@tauri-apps/plugin-fs';
import { storage, normalizeApiKeysDoc } from './storage';
import type { ApiKeysDoc } from './storage';

const ME = { deviceId: 'a'.repeat(32), label: "Dave's Mac", platform: 'mac' as const };
const PEER = { deviceId: 'f'.repeat(32), label: 'iPhone', platform: 'iphone' as const };
const T = '2026-08-31T01:48:00.000Z';

function doc(): ApiKeysDoc {
  const raw = harness.files.get(API_KEYS_PATH);
  return raw === undefined ? {} : (JSON.parse(raw) as ApiKeysDoc);
}

beforeEach(() => { harness.reset(); });

describe('harness', () => {
  it('the plugin-fs mock is in place', () => {
    expect(pluginFs.BaseDirectory.AppLocalData).toBe(4);
  });
});

describe('the change-time stamp (FR-12, QA-11)', () => {
  it('a save with no origin stamps changedAt and no origin; the value stays a top-level string', async () => {
    const before = Date.now();
    await storage.setApiKey('ebird', 'k1');
    const d = doc();
    expect(d.ebird).toBe('k1');
    expect(d.meta?.ebird?.state).toBe('key');
    const meta = d.meta!.ebird!;
    if (meta.state !== 'key') throw new Error('expected a key entry');
    expect(Date.parse(meta.changedAt)).toBeGreaterThanOrEqual(before);
    expect(meta).not.toHaveProperty('origin');
    expect(meta).not.toHaveProperty('replacedBySyncAt');
  });

  it('a save with an origin stamps it, and a later save writes a fresh entry (never replacedBySyncAt)', async () => {
    await storage.applySyncedKey('ebird', { value: 'peer', changedAt: T, origin: PEER }, null, true);
    expect(doc().meta?.ebird).toHaveProperty('replacedBySyncAt');
    await storage.setApiKey('ebird', 'mine', ME);
    const entries = await storage.getApiKeyEntries();
    expect(entries.ebird).toMatchObject({ state: 'key', value: 'mine', origin: ME, replacedBySyncAt: null });
    expect(entries.ebird?.state === 'key' && entries.ebird.changedAt).not.toBeNull();
  });

  it('a pre-1.0.12 document reads UNTIMED: changedAt null and origin null, never now', async () => {
    harness.files.set(API_KEYS_PATH, JSON.stringify({ ebird: 'legacy' }));
    const entries = await storage.getApiKeyEntries();
    expect(entries.ebird).toEqual({ state: 'key', value: 'legacy', changedAt: null, origin: null, replacedBySyncAt: null });
    expect(entries.openweather).toBeNull();
    // and it stays untimed on disk until its next save
    expect(doc()).toEqual({ ebird: 'legacy' });
  });

  it('getApiKey answers byte-identically to 1.0.11 for a shipped document, and null for an absent or empty value', async () => {
    harness.files.set(API_KEYS_PATH, JSON.stringify({ ebird: 'legacy', openweather: '' }));
    expect(await storage.getApiKey('ebird')).toBe('legacy');
    expect(await storage.getApiKey('openweather')).toBeNull();
  });

  it('deleteApiKey removes the value AND its meta entry, marker included (FR-31)', async () => {
    await storage.setApiKey('ebird', 'k1', ME);
    await storage.clearApiKeyWithMarker('openweather', { clearedAt: T, origin: ME });
    await storage.deleteApiKey('ebird');
    await storage.deleteApiKey('openweather');
    expect(doc()).toEqual({ meta: {} });
    expect(await storage.getApiKeyEntries()).toEqual({ ebird: null, openweather: null });
  });

  it('clearApiKeyWithMarker removes the value and leaves a cleared marker with its time and origin (FR-28)', async () => {
    await storage.setApiKey('ebird', 'k1', ME);
    await storage.clearApiKeyWithMarker('ebird', { clearedAt: T, origin: ME });
    expect(doc().ebird).toBeUndefined();
    expect(await storage.getApiKey('ebird')).toBeNull();
    expect((await storage.getApiKeyEntries()).ebird).toEqual({ state: 'cleared', clearedAt: T, origin: ME });
  });

  it('a save over a marker replaces it with a key entry', async () => {
    await storage.clearApiKeyWithMarker('ebird', { clearedAt: T, origin: ME });
    await storage.setApiKey('ebird', 'again', ME);
    expect((await storage.getApiKeyEntries()).ebird).toMatchObject({ state: 'key', value: 'again' });
  });
});

describe('the sync links', () => {
  it('applySyncedKey lands the shared time and origin, with replacedBySyncAt only when replaced', async () => {
    expect(await storage.applySyncedKey('ebird', { value: 'peer', changedAt: T, origin: PEER }, null, false)).toBe(true);
    expect((await storage.getApiKeyEntries()).ebird).toEqual({ state: 'key', value: 'peer', changedAt: T, origin: PEER, replacedBySyncAt: null });
    const expectNow = { state: 'key' as const, value: 'peer', changedAt: T };
    expect(await storage.applySyncedKey('ebird', { value: 'peer2', changedAt: '2026-09-01T00:00:00.000Z', origin: PEER }, expectNow, true)).toBe(true);
    const e = (await storage.getApiKeyEntries()).ebird;
    expect(e).toMatchObject({ state: 'key', value: 'peer2', origin: PEER });
    expect(e?.state === 'key' && e.replacedBySyncAt).toBeTruthy();
  });

  it('applySyncedKeyClear removes the value and keeps the PEER marker', async () => {
    await storage.setApiKey('ebird', 'k1', ME);
    const cur = (await storage.getApiKeyEntries()).ebird!;
    if (cur.state !== 'key') throw new Error('expected a key');
    expect(await storage.applySyncedKeyClear('ebird', { clearedAt: T, origin: PEER }, { state: 'key', value: 'k1', changedAt: cur.changedAt })).toBe(true);
    expect(await storage.getApiKey('ebird')).toBeNull();
    expect((await storage.getApiKeyEntries()).ebird).toEqual({ state: 'cleared', clearedAt: T, origin: PEER });
  });

  it('stampApiKeyEntry sets time and origin without touching the value, keeps replacedBySyncAt, and refuses a changed value', async () => {
    harness.files.set(API_KEYS_PATH, JSON.stringify({ ebird: 'legacy' }));
    expect(await storage.stampApiKeyEntry('ebird', { changedAt: T, origin: ME }, 'legacy')).toBe(true);
    expect((await storage.getApiKeyEntries()).ebird).toEqual({ state: 'key', value: 'legacy', changedAt: T, origin: ME, replacedBySyncAt: null });
    expect(await storage.stampApiKeyEntry('ebird', { changedAt: T, origin: PEER }, 'other')).toBe(false);
    expect((await storage.getApiKeyEntries()).ebird).toMatchObject({ origin: ME });
    expect(await storage.stampApiKeyEntry('openweather', { changedAt: T, origin: ME }, 'x')).toBe(false);
    await storage.applySyncedKey('openweather', { value: 'p', changedAt: T, origin: PEER }, null, true);
    expect(await storage.stampApiKeyEntry('openweather', { changedAt: '2026-09-02T00:00:00.000Z', origin: ME }, 'p')).toBe(true);
    expect((await storage.getApiKeyEntries()).openweather?.state === 'key' && (await storage.getApiKeyEntries()).openweather).toMatchObject({ replacedBySyncAt: expect.any(String), origin: ME });
  });
});

describe('normalizeApiKeysDoc (validate on load; never default a time)', () => {
  it('keeps values and drops a non-object meta whole', () => {
    expect(normalizeApiKeysDoc({ ebird: 'a', openweather: 'b', meta: 'x' })).toEqual({ ebird: 'a', openweather: 'b' });
    expect(normalizeApiKeysDoc({ ebird: 'a', meta: [] })).toEqual({ ebird: 'a' });
    expect(normalizeApiKeysDoc({ ebird: 'a', meta: null })).toEqual({ ebird: 'a' });
  });

  it('drops an empty value, a non-string value, and non-object or hostile input', () => {
    expect(normalizeApiKeysDoc({ ebird: '', openweather: 7 })).toEqual({});
    expect(normalizeApiKeysDoc(null)).toEqual({});
    expect(normalizeApiKeysDoc('str')).toEqual({});
    expect(normalizeApiKeysDoc(JSON.parse('{"__proto__":{"ebird":"x"},"constructor":"y"}'))).toEqual({});
  });

  it.each([
    ['a non-object entry', { ebird: 'a', meta: { ebird: 'nope' } }],
    ['an unknown state', { ebird: 'a', meta: { ebird: { state: 'file', changedAt: T } } }],
    ['a key entry with an unparseable changedAt', { ebird: 'a', meta: { ebird: { state: 'key', changedAt: 'yesterday' } } }],
    ['a key entry with no changedAt', { ebird: 'a', meta: { ebird: { state: 'key' } } }],
    ['a key entry with NO VALUE (inconsistency)', { meta: { ebird: { state: 'key', changedAt: T } } }],
    ['a cleared marker BESIDE a value (inconsistency: the value wins, untimed)', { ebird: 'a', meta: { ebird: { state: 'cleared', clearedAt: T, origin: ME } } }],
    ['a cleared marker with no origin', { meta: { ebird: { state: 'cleared', clearedAt: T } } }],
    ['a cleared marker with a bad origin', { meta: { ebird: { state: 'cleared', clearedAt: T, origin: { deviceId: 'zz', label: 'x', platform: 'mac' } } } }],
    ['a cleared marker with an unparseable clearedAt', { meta: { ebird: { state: 'cleared', clearedAt: 'soon', origin: ME } } }],
  ])('%s: the entry is dropped and any value is kept', (_label, raw) => {
    const out = normalizeApiKeysDoc(raw);
    expect(out.meta?.ebird).toBeUndefined();
    if ('ebird' in raw) expect(out.ebird).toBe('a');
  });

  it('drops a malformed origin from a key entry but keeps the entry (timed, no origin); drops a non-string replacedBySyncAt', () => {
    const out = normalizeApiKeysDoc({ ebird: 'a', meta: { ebird: { state: 'key', changedAt: T, origin: { deviceId: '../etc', label: 'x', platform: 'mac' }, replacedBySyncAt: 5 } } });
    expect(out.meta?.ebird).toEqual({ state: 'key', changedAt: T });
  });

  it('keeps a well-formed key entry and marker, each slot on its own', () => {
    const out = normalizeApiKeysDoc({ ebird: 'a', meta: { ebird: { state: 'key', changedAt: T, origin: ME, replacedBySyncAt: T }, openweather: { state: 'cleared', clearedAt: T, origin: PEER } } });
    expect(out).toEqual({ ebird: 'a', meta: { ebird: { state: 'key', changedAt: T, origin: ME, replacedBySyncAt: T }, openweather: { state: 'cleared', clearedAt: T, origin: PEER } } });
  });
});
