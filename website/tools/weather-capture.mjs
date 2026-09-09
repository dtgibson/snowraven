// Fail-closed state and orchestration helpers for the website Weather + Tide
// screenshot. Kept outside capture.mjs so the readiness contract can be
// exercised without launching the full multi-shot browser workflow.

const WEATHER_RESULT = /(?:^|\n)\s*(?:Sunrise|Sunset):/im;
const TIDE_RESULT = /(?:^|\n)\s*(?:Tide|Station):/im;
const LOADING = /(?:Looking up|Loading tide)(?:…|\.\.\.)/i;
const TERMINAL_ERROR = /(?:API key (?:is )?not configured|Weather lookup needs an API key|Weather data unavailable|Tide data unavailable|You're offline|Can't reach the SnowRaven server|Something went wrong|doesn't look like a valid eBird checklist ID)/i;

/**
 * Classify the text currently rendered in the Weather panel.
 * Completion is deliberately conjunctive: a Tide result cannot stand in for
 * Weather, and stale result text cannot stand in for a lookup still loading.
 */
export function weatherCaptureState(text) {
  const value = String(text ?? '');
  const error = value.match(TERMINAL_ERROR)?.[0] ?? null;
  if (error) return { status: 'error', reason: error };
  if (LOADING.test(value)) return { status: 'loading' };

  const hasWeather = WEATHER_RESULT.test(value);
  const hasTide = TIDE_RESULT.test(value);
  if (hasWeather && hasTide) return { status: 'complete' };
  if (hasWeather) return { status: 'incomplete', missing: 'Tide' };
  if (hasTide) return { status: 'incomplete', missing: 'Weather' };
  return { status: 'incomplete', missing: 'Weather and Tide' };
}

/** Assert one final frame rather than allowing an earlier ready frame to count. */
export function requireWeatherCaptureReady(text) {
  const state = weatherCaptureState(text);
  if (state.status === 'complete') return;
  if (state.status === 'error') {
    throw new Error(`weather capture reached an error state: ${state.reason}`);
  }
  if (state.status === 'loading') {
    throw new Error('weather capture is not complete: lookup is still loading');
  }
  throw new Error(`weather capture is not complete: ${state.missing} output is missing`);
}

/**
 * Poll the live panel until both outputs exist. Known terminal states fail
 * immediately; loading or incomplete states may settle until the bounded
 * timeout, which is surfaced rather than swallowed.
 */
export async function waitForWeatherCaptureReady(
  readMainText,
  {
    timeoutMs = 40_000,
    pollMs = 100,
    now = Date.now,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  } = {},
) {
  const startedAt = now();
  let state = { status: 'incomplete', missing: 'Weather and Tide' };

  for (;;) {
    const text = await readMainText();
    state = weatherCaptureState(text);
    if (state.status === 'complete') return;
    if (state.status === 'error') requireWeatherCaptureReady(text);
    if (now() - startedAt >= timeoutMs) {
      const detail = state.status === 'loading'
        ? 'lookup was still loading'
        : `${state.missing} output was missing`;
      throw new Error(`weather capture timed out after ${timeoutMs}ms: ${detail}`);
    }
    await sleep(pollMs);
  }
}

function messageOf(error) {
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}

/** Run one required capture and return its failure instead of losing it. */
export async function runRequiredCapture(name, work, log = console.log) {
  try {
    await work();
    return null;
  } catch (error) {
    const failure = `${name}: ${messageOf(error)}`;
    log('FAIL', name, messageOf(error));
    return failure;
  }
}

/**
 * Translate required-capture failures to the command's exit status. The
 * process-like argument makes the exit behavior directly testable.
 */
export function applyCaptureExitCode(failures, runtime = process) {
  if (failures.length > 0) runtime.exitCode = 1;
  return failures.length > 0 ? 1 : 0;
}
