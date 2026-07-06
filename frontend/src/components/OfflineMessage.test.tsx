// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OfflineMessage, StalenessCue } from './OfflineMessage';
import {
  classifyLiveError,
  OFFLINE_MESSAGE,
  NO_KEY_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  formatLoadedTime,
} from '../lib/offlineMessage';
import { TransportError } from '../lib/transport';

afterEach(() => { cleanup(); Object.defineProperty(navigator, 'onLine', { value: true, configurable: true }); });

// QA-26: a surface fed (a) an offline error, (b) a no-key error, (c) an HTTP
// error renders three DIFFERENT, distinguishable treatments — a real error is a
// role="alert"; offline / no-key are role="status" (informational).
describe('OfflineMessage — three distinct treatments (QA-26)', () => {
  it('offline → role=status with the offline copy', () => {
    // A genuinely-offline device (onLine === false) → the offline copy, not the
    // web/Pi backend-down copy (FR-39a, which is exercised in offlineMessage.test).
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { kind, message } = classifyLiveError(new TypeError('Failed to fetch'));
    render(<OfflineMessage kind={kind} message={message} />);
    const node = screen.getByRole('status');
    expect(node.textContent).toBe(OFFLINE_MESSAGE);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('no-key → role=status with the no-key copy', () => {
    const { kind, message } = classifyLiveError(
      Object.assign(new Error('eBird API key not configured'), { status: 401 }),
    );
    render(<OfflineMessage kind={kind} message={message} />);
    expect(screen.getByRole('status').textContent).toBe(NO_KEY_MESSAGE);
  });

  it('server error → role=alert with the generic copy', () => {
    const { kind, message } = classifyLiveError(new TransportError('Transport error: 500', 500));
    render(<OfflineMessage kind={kind} message={message} />);
    expect(screen.getByRole('alert').textContent).toBe(GENERIC_ERROR_MESSAGE);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('the three rendered strings are all different', () => {
    const cases = [
      new TypeError('Failed to fetch'),
      Object.assign(new Error('eBird API key not configured'), { status: 401 }),
      new TransportError('Transport error: 500', 500),
    ];
    const strings = cases.map(err => {
      const { kind, message } = classifyLiveError(err);
      const { container } = render(<OfflineMessage kind={kind} message={message} />);
      const text = container.textContent ?? '';
      cleanup();
      return text;
    });
    expect(new Set(strings).size).toBe(3);
  });
});

// QA-21 / QA-27: the staleness cue renders when a result was replayed, leading
// with the "showing the last loaded result" phrasing and the loaded time.
describe('StalenessCue — replayed-result provenance (QA-21/QA-27)', () => {
  it('renders the cue text with the loaded time when replayedAt is set', () => {
    const ms = new Date(2026, 5, 19, 9, 15).getTime();
    render(<StalenessCue replayedAt={ms} />);
    const node = screen.getByRole('status');
    expect(node.textContent).toContain('Offline: showing the last loaded result');
    expect(node.textContent).toContain(formatLoadedTime(ms));
  });
});
