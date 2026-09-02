// icloud-api-key-sync FR-26 (QA-21): the five key links (getApiKeyEntries,
// clearApiKeyWithMarker, applySyncedKey, applySyncedKeyClear,
// stampApiKeyEntry) ride the SAME per-document chain as setApiKey and
// deleteApiKey, so a synced arrival and a user save in the same tick both
// persist; a user save that lands during an apply wins (the guarded link
// returns false, value and meta untouched); a stamp on a changed value and a
// synced clear against a changed entry both return false; and a rejecting
// write leaves the document byte-identical. Same plugin-fs harness and the
// same read-first adversarial scheduler as storageWriteSerialization.test.ts
// (the interleaving that forced the v1.0.9 clobber). A sentinel key value is
// asserted never to reach any fs path or any op other than the document write.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const API_KEYS_PATH = 'data/api-keys.json';

type FsOp = 'exists' | 'read' | 'write' | 'mkdir' | 'remove';
interface Step { op: FsOp; path: string; go: () => void }

const harness = {
  files: new Map<string, string>(),
  pending: [] as Step[],
  manual: false,
  failNextWrite: new Set<string>(),
  log: [] as Array<{ op: FsOp; path: string }>,
  reset() { this.files.clear(); this.pending = []; this.manual = false; this.failNextWrite.clear(); this.log = []; },
};

function gate<T>(op: FsOp, path: string, effect: () => T): Promise<T> {
  harness.log.push({ op, path });
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
  writeTextFile: (path: string, content: string) => gate('write', path, () => {
    if (harness.failNextWrite.delete(path)) throw new Error(`EIO (injected): ${path}`);
    harness.files.set(path, content);
  }),
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
import { storage } from './storage';
import type { ApiKeysDoc } from './storage';

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

async function drainReadsFirst(): Promise<void> {
  for (;;) {
    await settle();
    if (harness.pending.length === 0) break;
    const i = harness.pending.findIndex((s) => s.op === 'exists' || s.op === 'read');
    const [step] = harness.pending.splice(i >= 0 ? i : 0, 1);
    step.go();
  }
  harness.manual = false;
}

function doc(): ApiKeysDoc {
  const raw = harness.files.get(API_KEYS_PATH);
  return raw === undefined ? {} : (JSON.parse(raw) as ApiKeysDoc);
}

const ME = { deviceId: 'a'.repeat(32), label: "Dave's Mac", platform: 'mac' as const };
const PEER = { deviceId: 'f'.repeat(32), label: 'iPhone', platform: 'iphone' as const };
const T_PEER = '2026-08-24T22:12:00.000Z';
const SENTINEL = 'SENTINELkey0xA1B2C3';

beforeEach(() => { harness.reset(); });

describe('harness', () => {
  it('the plugin-fs mock is in place', () => {
    expect(pluginFs.BaseDirectory.AppLocalData).toBe(4);
  });
});

describe('applySyncedKey rides the api-keys chain (FR-26, QA-21)', () => {
  it('a synced arrival and a user save in the same tick both persist', async () => {
    harness.manual = true;
    const pSync = storage.applySyncedKey('ebird', { value: SENTINEL, changedAt: T_PEER, origin: PEER }, null, false);
    const pUser = storage.setApiKey('openweather', 'mine', ME);
    await drainReadsFirst();
    const [applied] = await Promise.all([pSync, pUser]);
    expect(applied).toBe(true);
    const d = doc();
    expect(d.ebird).toBe(SENTINEL);
    expect(d.openweather).toBe('mine');
    expect(d.meta?.ebird).toEqual({ state: 'key', changedAt: T_PEER, origin: PEER });
    expect(d.meta?.openweather).toMatchObject({ state: 'key', origin: ME });
  });

  it('a user save that lands during an apply wins: the link returns false and the user entry stays', async () => {
    harness.manual = true;
    const pUser = storage.setApiKey('ebird', 'mine', ME);
    const pSync = storage.applySyncedKey('ebird', { value: SENTINEL, changedAt: T_PEER, origin: PEER }, null, false);
    await drainReadsFirst();
    const [, applied] = await Promise.all([pUser, pSync]);
    expect(applied).toBe(false);
    expect(doc().ebird).toBe('mine');
    expect(doc().meta?.ebird).toMatchObject({ origin: ME });
    expect(harness.files.get(API_KEYS_PATH)).not.toContain(SENTINEL);
  });

  it('applies when the local entry is exactly the one decided against, and is then pushed by the next check (the entry reads as the peer\'s)', async () => {
    await storage.setApiKey('ebird', 'old', ME);
    const cur = (await storage.getApiKeyEntries()).ebird!;
    if (cur.state !== 'key') throw new Error('expected a key');
    const applied = await storage.applySyncedKey('ebird', { value: SENTINEL, changedAt: T_PEER, origin: PEER }, { state: 'key', value: 'old', changedAt: cur.changedAt }, true);
    expect(applied).toBe(true);
    const e = (await storage.getApiKeyEntries()).ebird!;
    expect(e).toMatchObject({ state: 'key', value: SENTINEL, changedAt: T_PEER, origin: PEER });
    expect(e.state === 'key' && e.replacedBySyncAt).toBeTruthy();
  });

  it('a rejecting write leaves the document byte-identical and the chain unpoisoned', async () => {
    await storage.setApiKey('ebird', 'old', ME);
    const cur = (await storage.getApiKeyEntries()).ebird!;
    if (cur.state !== 'key') throw new Error('expected a key');
    const before = harness.files.get(API_KEYS_PATH);
    harness.failNextWrite.add(API_KEYS_PATH);
    await expect(
      storage.applySyncedKey('ebird', { value: SENTINEL, changedAt: T_PEER, origin: PEER }, { state: 'key', value: 'old', changedAt: cur.changedAt }, true),
    ).rejects.toThrow('EIO');
    expect(harness.files.get(API_KEYS_PATH)).toBe(before);
    await storage.setApiKey('openweather', 'later', ME);
    expect(doc().openweather).toBe('later');
    expect(doc().ebird).toBe('old');
  });
});

describe('the other guarded links', () => {
  it('stampApiKeyEntry on a changed value returns false and touches nothing', async () => {
    await storage.setApiKey('ebird', 'v1', ME);
    const before = harness.files.get(API_KEYS_PATH);
    expect(await storage.stampApiKeyEntry('ebird', { changedAt: T_PEER, origin: PEER }, 'v0')).toBe(false);
    expect(harness.files.get(API_KEYS_PATH)).toBe(before);
  });

  it('applySyncedKeyClear against a changed entry returns false and keeps the key', async () => {
    await storage.setApiKey('ebird', 'v1', ME);
    expect(await storage.applySyncedKeyClear('ebird', { clearedAt: T_PEER, origin: PEER }, { state: 'key', value: 'v1', changedAt: '1999-01-01T00:00:00.000Z' })).toBe(false);
    expect(doc().ebird).toBe('v1');
    expect(await storage.applySyncedKeyClear('ebird', { clearedAt: T_PEER, origin: PEER }, null)).toBe(false);
    expect(doc().ebird).toBe('v1');
  });

  it('a synced clear interleaved with a user save in one tick: the save wins for its slot, the clear applies to the other', async () => {
    await storage.setApiKey('ebird', 'v1', ME);
    await storage.setApiKey('openweather', 'w1', ME);
    const entries = await storage.getApiKeyEntries();
    const ow = entries.openweather!;
    if (ow.state !== 'key') throw new Error('expected a key');
    harness.manual = true;
    const pUser = storage.setApiKey('ebird', 'v2', ME);
    const pClearEbird = storage.applySyncedKeyClear('ebird', { clearedAt: T_PEER, origin: PEER }, { state: 'key', value: 'v1', changedAt: (entries.ebird as { changedAt: string }).changedAt });
    const pClearOw = storage.applySyncedKeyClear('openweather', { clearedAt: T_PEER, origin: PEER }, { state: 'key', value: 'w1', changedAt: ow.changedAt });
    await drainReadsFirst();
    const [, a, b] = await Promise.all([pUser, pClearEbird, pClearOw]);
    expect(a).toBe(false);
    expect(b).toBe(true);
    expect(doc().ebird).toBe('v2');
    expect(doc().openweather).toBeUndefined();
    expect(doc().meta?.openweather).toEqual({ state: 'cleared', clearedAt: T_PEER, origin: PEER });
  });

  it('clearApiKeyWithMarker and setApiKey in one tick both persist (the marker for one slot, the value for the other)', async () => {
    await storage.setApiKey('ebird', 'v1', ME);
    harness.manual = true;
    const pClear = storage.clearApiKeyWithMarker('ebird', { clearedAt: T_PEER, origin: ME });
    const pSet = storage.setApiKey('openweather', 'w1', ME);
    await drainReadsFirst();
    await Promise.all([pClear, pSet]);
    expect(doc().ebird).toBeUndefined();
    expect(doc().meta?.ebird).toEqual({ state: 'cleared', clearedAt: T_PEER, origin: ME });
    expect(doc().openweather).toBe('w1');
  });
});

describe('the sentinel never leaves its slot (FR-21)', () => {
  it('appears only inside the api-keys document write, never in a path or any other op', async () => {
    await storage.applySyncedKey('ebird', { value: SENTINEL, changedAt: T_PEER, origin: PEER }, null, false);
    await storage.setApiKey('openweather', SENTINEL, ME);
    await storage.getApiKeyEntries();
    for (const { path } of harness.log) expect(path).not.toContain(SENTINEL);
    for (const [path] of harness.files) expect(path).not.toContain(SENTINEL);
    expect(harness.files.get(API_KEYS_PATH)).toContain(SENTINEL);
  });
});
