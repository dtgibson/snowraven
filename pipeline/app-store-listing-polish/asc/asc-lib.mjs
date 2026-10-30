// Client for the App Store Connect API. Mints an ES256 JWT from the
// metadata-capable key (QJA25M7XHM) and the issuer in APPLE_API_ISSUER_ID.
// The token and key never leave this process: nothing here prints them.
import { createSign, createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const KID = 'QJA25M7XHM';
const KEY_PATH = `${homedir()}/.appstoreconnect/private_keys/AuthKey_${KID}.p8`;
const BASE = 'https://api.appstoreconnect.apple.com';

let cached = null;
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function token() {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - now > 120) return cached.tok;
  const iss = process.env.APPLE_API_ISSUER_ID;
  if (!iss) throw new Error('APPLE_API_ISSUER_ID is not set in the environment');
  const exp = now + 15 * 60; // under Apple's 20-minute ceiling
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KID, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss, iat: now, exp, aud: 'appstoreconnect-v1' }));
  const key = createPrivateKey(readFileSync(KEY_PATH));
  const sig = createSign('SHA256').update(`${header}.${payload}`).sign({ key, dsaEncoding: 'ieee-p1363' });
  cached = { tok: `${header}.${payload}.${b64url(sig)}`, exp };
  return cached.tok;
}

export async function api(method, path, body) {
  const url = path.startsWith('http') ? path : BASE + path;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, ok: res.ok, json };
}

export async function get(path) {
  const r = await api('GET', path);
  if (!r.ok) {
    throw new Error(`GET ${path} -> ${r.status} ${JSON.stringify(r.json?.errors ?? r.json).slice(0, 1200)}`);
  }
  return r.json;
}

// Follow links.next through a collection.
export async function getAll(path) {
  const out = [];
  let next = path;
  while (next) {
    const j = await get(next);
    out.push(...(j.data ?? []));
    next = j.links?.next ?? null;
  }
  return out;
}

export const short = (id) => (id ? String(id).slice(0, 8) : id);
