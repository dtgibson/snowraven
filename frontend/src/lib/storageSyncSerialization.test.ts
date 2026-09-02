// icloud-sync FR-39 (QA-36) and FR-29 (QA-27): the three sync-originated
// metadata links (applySyncedFile, applySyncedClear, stampFileOrigin) ride
// the SAME per-document chain as writeFile/deleteFile, so a sync write and a
// user upload in the same tick both persist; a user upload that lands during
// a pull wins (the guarded link returns false, touching nothing); and a
// rejecting materialize leaves metadata byte-identical. Same plugin-fs
// harness as storageWriteSerialization.test.ts (the read-first adversarial
// scheduler that forced the v1.0.9 clobber).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const META_PATH = 'data/metadata.json';

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
import { storage } from './storage';
import type { FileMetadata } from './storage';

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

function metaDoc(): Record<string, FileMetadata | null> {
  const raw = harness.files.get(META_PATH);
  return raw === undefined ? {} : (JSON.parse(raw) as Record<string, FileMetadata | null>);
}

const ORIGIN = { deviceId: 'a'.repeat(32), label: 'iPhone', platform: 'iphone' as const };
const PULLED: FileMetadata = { filename: 'FromPhone.csv', uploadedAt: '2026-08-24T22:12:00.000Z', origin: ORIGIN, replacedBySyncAt: '2026-09-01T16:00:00.000Z' };

beforeEach(() => { harness.reset(); });

describe('harness', () => {
  it('the plugin-fs mock is in place', () => {
    expect(pluginFs.BaseDirectory.AppLocalData).toBe(4);
  });
});

describe('applySyncedFile rides the metadata chain (FR-39)', () => {
  it('a sync write and a user upload in the same tick both persist (QA-36)', async () => {
    harness.manual = true;
    const pSync = storage.applySyncedFile('ebird', PULLED, null, async () => { harness.files.set('data/ebird-backup.csv', 'pulled-bytes'); });
    const pUser = storage.writeFile('ml', 'csv-ml', 'ML.csv');
    await drainReadsFirst();
    const [applied] = await Promise.all([pSync, pUser]);
    expect(applied).toBe(true);
    const doc = metaDoc();
    expect(doc.ebird?.filename).toBe('FromPhone.csv');
    expect(doc.ebird?.origin?.deviceId).toBe(ORIGIN.deviceId);
    expect(doc.ml?.filename).toBe('ML.csv');
    expect(harness.files.get('data/ebird-backup.csv')).toBe('pulled-bytes');
    expect(harness.files.get('data/ml-export.csv')).toBe('csv-ml');
  });

  it('a user upload that lands during a pull wins: the link returns false and the user entry stays', async () => {
    // The controller decided against "no local entry" (expect null), then the
    // user uploaded before the link ran. The guard sees a different uploadedAt.
    harness.manual = true;
    const pUser = storage.writeFile('ebird', 'user-bytes', 'MyEBirdData.csv');
    const materialize = vi.fn(async () => { harness.files.set('data/ebird-backup.csv', 'pulled-bytes'); });
    const pSync = storage.applySyncedFile('ebird', PULLED, null, materialize);
    await drainReadsFirst();
    const [, applied] = await Promise.all([pUser, pSync]);
    expect(applied).toBe(false);
    expect(materialize).not.toHaveBeenCalled();
    expect(metaDoc().ebird?.filename).toBe('MyEBirdData.csv');
    expect(harness.files.get('data/ebird-backup.csv')).toBe('user-bytes');
  });

  it('a rejecting materialize leaves the metadata document byte-identical (FR-29, QA-27)', async () => {
    await storage.writeFile('ebird', 'local-bytes', 'MyEBirdData.csv');
    const before = harness.files.get(META_PATH);
    const localAt = metaDoc().ebird!.uploadedAt;
    await expect(
      storage.applySyncedFile('ebird', PULLED, localAt, async () => { throw new Error('mismatch'); }),
    ).rejects.toThrow('mismatch');
    expect(harness.files.get(META_PATH)).toBe(before);
    expect(harness.files.get('data/ebird-backup.csv')).toBe('local-bytes');
    // The chain is not poisoned: a later user write still lands.
    await storage.writeFile('ml', 'csv-ml', 'ML.csv');
    expect(metaDoc().ml?.filename).toBe('ML.csv');
  });

  it('applies when the local entry is exactly the one decided against', async () => {
    await storage.writeFile('ebird', 'old', 'Old.csv');
    const localAt = metaDoc().ebird!.uploadedAt;
    const applied = await storage.applySyncedFile('ebird', PULLED, localAt, async () => { harness.files.set('data/ebird-backup.csv', 'new'); });
    expect(applied).toBe(true);
    expect(metaDoc().ebird).toEqual(PULLED);
    expect(harness.files.get('data/ebird-backup.csv')).toBe('new');
  });
});

describe('applySyncedClear (FR-31)', () => {
  it('removes the csv and nulls the entry under the same guard', async () => {
    await storage.writeFile('ebird', 'bytes', 'MyEBirdData.csv');
    const localAt = metaDoc().ebird!.uploadedAt;
    expect(await storage.applySyncedClear('ebird', localAt)).toBe(true);
    expect(metaDoc().ebird).toBeNull();
    expect(harness.files.has('data/ebird-backup.csv')).toBe(false);
  });

  it('returns false and touches nothing when the entry changed since the decision', async () => {
    await storage.writeFile('ebird', 'bytes', 'MyEBirdData.csv');
    expect(await storage.applySyncedClear('ebird', '1999-01-01T00:00:00.000Z')).toBe(false);
    expect(metaDoc().ebird?.filename).toBe('MyEBirdData.csv');
    expect(harness.files.get('data/ebird-backup.csv')).toBe('bytes');
  });
});

describe('stampFileOrigin and writeFile origin', () => {
  it('stamps an origin onto a pre-1.0.11 entry without touching uploadedAt', async () => {
    await storage.writeFile('ebird', 'bytes', 'MyEBirdData.csv');
    const at = metaDoc().ebird!.uploadedAt;
    expect(await storage.stampFileOrigin('ebird', ORIGIN, at)).toBe(true);
    expect(metaDoc().ebird).toEqual({ filename: 'MyEBirdData.csv', uploadedAt: at, origin: ORIGIN });
  });

  it('refuses to stamp an entry that already has an origin or that has moved on', async () => {
    await storage.writeFile('ebird', 'bytes', 'MyEBirdData.csv', ORIGIN);
    const at = metaDoc().ebird!.uploadedAt;
    expect(await storage.stampFileOrigin('ebird', { ...ORIGIN, deviceId: 'b'.repeat(32) }, at)).toBe(false);
    expect(metaDoc().ebird?.origin?.deviceId).toBe(ORIGIN.deviceId);
    expect(await storage.stampFileOrigin('ml', ORIGIN, at)).toBe(false);
  });

  it('a user upload writes origin when given and never replacedBySyncAt (it clears the FR-25 notice)', async () => {
    const localAt = '2026-08-01T00:00:00.000Z';
    await storage.applySyncedFile('ebird', { ...PULLED, uploadedAt: localAt }, null, async () => {});
    expect(metaDoc().ebird?.replacedBySyncAt).toBeDefined();
    await storage.writeFile('ebird', 'bytes', 'MyEBirdData.csv', { ...ORIGIN, deviceId: 'c'.repeat(32) });
    const entry = metaDoc().ebird!;
    expect(entry.origin?.deviceId).toBe('c'.repeat(32));
    expect(entry).not.toHaveProperty('replacedBySyncAt');
    await storage.writeFile('ebird', 'bytes', 'MyEBirdData.csv');
    expect(metaDoc().ebird).not.toHaveProperty('origin');
  });
});

describe('readMeta drops a malformed origin (security round, Finding 4)', () => {
  it('an origin whose deviceId is not 32 lowercase hex, or whose platform is unknown, reads as "local, no origin"', async () => {
    harness.files.set(META_PATH, JSON.stringify({
      ebird: { filename: 'A.csv', uploadedAt: '2026-08-24T22:12:00.000Z', origin: { deviceId: '../../../etc', label: 'x', platform: 'mac' } },
      ml: { filename: 'B.csv', uploadedAt: '2026-08-24T22:12:00.000Z', origin: { deviceId: 'a'.repeat(32), label: 'x', platform: 'windows' } },
    }));
    const status = await storage.getFilesStatus();
    expect(status.ebird).toEqual({ filename: 'A.csv', uploadedAt: '2026-08-24T22:12:00.000Z' });
    expect(status.ml).toEqual({ filename: 'B.csv', uploadedAt: '2026-08-24T22:12:00.000Z' });
  });

  it('a well-formed origin and a replacedBySyncAt survive the read', async () => {
    harness.files.set(META_PATH, JSON.stringify({ ebird: PULLED, ml: null }));
    const status = await storage.getFilesStatus();
    expect(status.ebird).toEqual(PULLED);
    expect(status.ml).toBeNull();
  });

  it('an entry that is not an object, or lacks its two required strings, reads as absent', async () => {
    harness.files.set(META_PATH, JSON.stringify({ ebird: 'nope', ml: { filename: 7 } }));
    const status = await storage.getFilesStatus();
    expect(status).toEqual({ ebird: null, ml: null });
  });
});
