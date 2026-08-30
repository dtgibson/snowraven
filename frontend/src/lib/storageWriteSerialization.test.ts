// settings-write-clobber (v1.0.9): TauriStorage read-modify-write cycles on a
// shared JSON document (settings.json, api-keys.json, metadata.json) must be
// serialized per document. Before the fix, every save rewrote the whole
// document from a base read taken before the write, so two overlapping saves
// silently dropped each other's keys (the 1.0.8 field bug: the projects
// ledger clobbered down to two keys during a sweep's debounced flushes).
//
// The harness below is this repo's first @tauri-apps/plugin-fs mock: an
// in-memory file map whose every operation can be held pending and released
// by the test in a chosen order, which is what forces the read/write
// interleavings the bug needs. Red-first evidence: "overlapping setSetting
// cannot clobber" FAILED against the pre-fix storage.ts (key 'a' missing
// afterward; the run is recorded in pipeline/settings-write-clobber/PR.md)
// and went green with the per-document chain, with no change to this file.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const SETTINGS_PATH = 'data/settings.json';
const API_KEYS_PATH = 'data/api-keys.json';
const META_PATH = 'data/metadata.json';

type FsOp = 'exists' | 'read' | 'write' | 'mkdir' | 'remove';
interface Step {
  op: FsOp;
  path: string;
  go: () => void;
}

const harness = {
  files: new Map<string, string>(),
  pending: [] as Step[],
  // false: every fs call resolves on its own microtask (normal async fs).
  // true: every fs call parks as a Step and resolves only when released.
  manual: false,
  // Paths whose NEXT write rejects (consumed on use) — the injected fs error.
  failNextWrite: new Set<string>(),
  reset() {
    this.files.clear();
    this.pending = [];
    this.manual = false;
    this.failNextWrite.clear();
  },
};

function gate<T>(op: FsOp, path: string, effect: () => T): Promise<T> {
  if (!harness.manual) return Promise.resolve().then(effect);
  return new Promise<T>((resolve, reject) => {
    harness.pending.push({
      op,
      path,
      go: () => {
        try {
          resolve(effect());
        } catch (e) {
          reject(e);
        }
      },
    });
  });
}

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppLocalData: 4 },
  exists: (path: string) => gate('exists', path, () => harness.files.has(path)),
  readTextFile: (path: string) =>
    gate('read', path, () => {
      const v = harness.files.get(path);
      if (v === undefined) throw new Error(`ENOENT: ${path}`);
      return v;
    }),
  writeTextFile: (path: string, content: string) =>
    gate('write', path, () => {
      if (harness.failNextWrite.delete(path)) throw new Error(`EIO (injected): ${path}`);
      harness.files.set(path, content);
    }),
  mkdir: (path: string) => gate('mkdir', path, () => undefined),
  remove: (path: string) =>
    gate('remove', path, () => {
      harness.files.delete(path);
    }),
}));

// storage.ts picks its adapter at module evaluation via isTauri() — force the
// TauriStorage branch (node env has no window, and no real Tauri internals).
vi.mock('./platform', () => ({
  isTauri: () => true,
  isIOS: () => false,
  isWindows: () => false,
}));

// Load the mocked module STATICALLY before any test runs. Without this, the
// mock registers lazily on the first dynamic import — and this file's tests
// start many simultaneous storage ops, whose concurrent first-time
// `await import('@tauri-apps/plugin-fs')` calls race that registration: the
// first import got the factory mock and the rest fell through to the real
// plugin (observed: 21 of 22 storm writers rejecting with the real plugin's
// "window is not defined"). A static import registers the mock at module
// link time, so every later dynamic import is a registry hit.
import * as pluginFs from '@tauri-apps/plugin-fs';

import { storage } from './storage';

// One macrotask: flushes the whole microtask queue first, so any storage op
// that can progress has parked its next fs Step before we look at pending.
const settle = () => new Promise<void>((r) => setTimeout(r, 0));

// Adversarial scheduler: whenever a read-side step (exists/read) and any
// other step are both pending, resolve the read first. Against the pre-fix
// code this is exactly the bug's interleaving — every overlapping op takes
// its base read before any of them writes, so the last write's stale base
// clobbers the others. Against serialized code there is never a choice
// (one link in flight), and the drain is a plain FIFO.
async function drainReadsFirst(): Promise<void> {
  for (;;) {
    await settle();
    if (harness.pending.length === 0) break;
    const i = harness.pending.findIndex((s) => s.op === 'exists' || s.op === 'read');
    const [step] = harness.pending.splice(i >= 0 ? i : 0, 1);
    step.go();
  }
  // Contract: the forced interleaving has fully run; return the fs to normal
  // async resolution so a test's follow-up storage reads don't park unreleased.
  harness.manual = false;
}

// Deterministic LCG so the randomized storm is reproducible run to run.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

async function drainRandom(rand: () => number): Promise<void> {
  for (;;) {
    await settle();
    if (harness.pending.length === 0) break;
    const i = Math.floor(rand() * harness.pending.length);
    const [step] = harness.pending.splice(i, 1);
    step.go();
  }
  harness.manual = false; // same contract as drainReadsFirst
}

function settingsDoc(): Record<string, unknown> {
  const raw = harness.files.get(SETTINGS_PATH);
  return raw === undefined ? {} : (JSON.parse(raw) as Record<string, unknown>);
}

beforeEach(() => {
  harness.reset();
});

describe('harness', () => {
  it('the plugin-fs mock is in place (a real plugin call would need a window)', () => {
    // Guard-the-guard: every test below is meaningless if the real plugin
    // leaked in. The sentinel BaseDirectory value exists only in the factory.
    expect(pluginFs.BaseDirectory.AppLocalData).toBe(4);
  });
});

describe('settings.json write serialization (settings-write-clobber)', () => {
  it('overlapping setSetting cannot clobber: both keys present afterward', async () => {
    // The 1.0.8 field bug, forced deterministically: start both saves, then
    // resolve b's base read before a's write lands. Pre-fix, both bases are
    // {} and the second write erases key 'a'.
    harness.manual = true;
    const pa = storage.setSetting('a', 1);
    const pb = storage.setSetting('b', 2);
    await drainReadsFirst();
    await Promise.all([pa, pb]);

    expect(settingsDoc()).toEqual({ a: 1, b: 2 });
  });

  it('a 22-writer storm in randomized resolution order keeps every key, last value winning', async () => {
    harness.manual = true;
    const ops: Promise<void>[] = [];
    for (let i = 0; i < 20; i++) ops.push(storage.setSetting(`k${i}`, i));
    // Two same-key re-writes issued after the first wave: call order must win.
    ops.push(storage.setSetting('k3', 'final-3'));
    ops.push(storage.setSetting('k7', 'final-7'));
    await drainRandom(lcg(0xc0ffee));
    await Promise.all(ops);

    const doc = settingsDoc();
    expect(Object.keys(doc)).toHaveLength(20);
    for (let i = 0; i < 20; i++) {
      if (i === 3 || i === 7) continue;
      expect(doc[`k${i}`]).toBe(i);
    }
    expect(doc.k3).toBe('final-3');
    expect(doc.k7).toBe('final-7');
  });

  it('a stale overlapping write cannot resurrect a deleted key', async () => {
    await storage.setSetting('x', 1);
    await storage.setSetting('keep', 'v');

    // deleteSetting('x') first, then an overlapping unrelated save whose
    // pre-fix stale base still contained x — the resurrection path.
    harness.manual = true;
    const pDel = storage.deleteSetting('x');
    const pSet = storage.setSetting('y', 2);
    await drainReadsFirst();
    await Promise.all([pDel, pSet]);

    expect(settingsDoc()).toEqual({ keep: 'v', y: 2 });
  });

  it('setSetting then deleteSetting overlapping: the delete wins for its key, others intact', async () => {
    await storage.setSetting('keep', 'v');

    harness.manual = true;
    const pSet = storage.setSetting('x', 5);
    const pDel = storage.deleteSetting('x');
    await drainReadsFirst();
    await Promise.all([pSet, pDel]);

    expect(settingsDoc()).toEqual({ keep: 'v' });
    expect(await storage.getSetting('x')).toBeNull();
  });

  it('a rejected write fails its own caller only — later writes still land', async () => {
    await storage.setSetting('a', 1);

    harness.failNextWrite.add(SETTINGS_PATH);
    await expect(storage.setSetting('b', 2)).rejects.toThrow('EIO');

    await storage.setSetting('c', 3);
    expect(settingsDoc()).toEqual({ a: 1, c: 3 });
    expect(await storage.getSetting('b')).toBeNull();
    expect(await storage.getSetting('c')).toBe(3);
  });
});

describe('api-keys.json write serialization', () => {
  it('overlapping setApiKey calls both persist', async () => {
    harness.manual = true;
    const p1 = storage.setApiKey('ebird', 'EB');
    const p2 = storage.setApiKey('openweather', 'OW');
    await drainReadsFirst();
    await Promise.all([p1, p2]);

    expect(JSON.parse(harness.files.get(API_KEYS_PATH)!)).toEqual({ ebird: 'EB', openweather: 'OW' });
    expect(await storage.getApiKey('ebird')).toBe('EB');
    expect(await storage.getApiKey('openweather')).toBe('OW');
  });
});

describe('metadata.json write serialization', () => {
  it('overlapping writeFile calls keep both metadata entries', async () => {
    harness.manual = true;
    const pE = storage.writeFile('ebird', 'csv-ebird', 'MyEBirdData.csv');
    const pM = storage.writeFile('ml', 'csv-ml', 'ML.csv');
    await drainReadsFirst();
    await Promise.all([pE, pM]);

    // Both CSVs on disk, and — the clobber-prone part — both entries in the
    // shared metadata document (asserted on the raw document, then through
    // the adapter).
    expect(harness.files.get('data/ebird-backup.csv')).toBe('csv-ebird');
    expect(harness.files.get('data/ml-export.csv')).toBe('csv-ml');
    const rawMeta = JSON.parse(harness.files.get(META_PATH)!) as Record<string, { filename: string } | null>;
    expect(rawMeta.ebird?.filename).toBe('MyEBirdData.csv');
    expect(rawMeta.ml?.filename).toBe('ML.csv');
    const status = await storage.getFilesStatus();
    expect(status.ebird?.filename).toBe('MyEBirdData.csv');
    expect(status.ml?.filename).toBe('ML.csv');
  });

  it('overlapping writeFile and deleteFile: the delete wins for its slot, the other survives', async () => {
    await storage.writeFile('ebird', 'csv-ebird', 'MyEBirdData.csv');

    harness.manual = true;
    const pM = storage.writeFile('ml', 'csv-ml', 'ML.csv');
    const pDel = storage.deleteFile('ebird');
    await drainReadsFirst();
    await Promise.all([pM, pDel]);

    const status = await storage.getFilesStatus();
    expect(status.ebird).toBeNull();
    expect(status.ml?.filename).toBe('ML.csv');
    expect(harness.files.has('data/ebird-backup.csv')).toBe(false);
  });
});
