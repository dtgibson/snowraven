import { describe, it, expect } from 'vitest';
import { isOfflineError, isNoKeyError } from './offlineDetect';

describe('isOfflineError', () => {
  it('TRUE for a bare fetch TypeError (web network failure, no status)', () => {
    expect(isOfflineError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('TRUE for the tauriFetch timeout shape ({ status: 0, timeout: true })', () => {
    expect(isOfflineError(Object.assign(new Error('timed out'), { status: 0, timeout: true }))).toBe(true);
  });

  it('TRUE for the checklist-service network-reject wrap ({ status: 0 })', () => {
    expect(isOfflineError(Object.assign(new Error('Could not reach eBird'), { status: 0 }))).toBe(true);
  });

  it('TRUE for an AbortError', () => {
    expect(isOfflineError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(true);
    expect(isOfflineError(Object.assign(new Error('to'), { name: 'TimeoutError' }))).toBe(true);
  });

  it('TRUE for a plain Error with no status (raw plugin-http network reject)', () => {
    expect(isOfflineError(new Error('error sending request'))).toBe(true);
  });

  it('TRUE for a primitive throw', () => {
    expect(isOfflineError('boom')).toBe(true);
    expect(isOfflineError(undefined)).toBe(true);
  });

  it('FALSE for an HTTP non-OK status (server error reaches the server)', () => {
    expect(isOfflineError(Object.assign(new Error('Transport error: 502'), { status: 502 }))).toBe(false);
    expect(isOfflineError(Object.assign(new Error('not found'), { status: 404 }))).toBe(false);
  });

  it('FALSE for a no-key guard thrown with an HTTP-like status', () => {
    expect(isOfflineError(Object.assign(new Error('API key not configured. Add it in Settings.'), { status: 500 }))).toBe(false);
    expect(isOfflineError(Object.assign(new Error('eBird API key not configured.'), { status: 401 }))).toBe(false);
  });
});

describe('isNoKeyError', () => {
  it('TRUE for the service no-key error shapes', () => {
    expect(isNoKeyError(Object.assign(new Error('API key not configured. Add it in Settings.'), { status: 500 }))).toBe(true);
    expect(isNoKeyError(new Error('eBird API key not configured. Add it in Settings.'))).toBe(true);
    expect(isNoKeyError(Object.assign(new Error('x'), { detail: 'OpenWeather API key not configured. Add it in Settings.' }))).toBe(true);
  });

  it('FALSE for a network error / generic HTTP error', () => {
    expect(isNoKeyError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isNoKeyError(Object.assign(new Error('Transport error: 502'), { status: 502 }))).toBe(false);
    expect(isNoKeyError('boom')).toBe(false);
  });
});
