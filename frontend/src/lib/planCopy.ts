// Every user-facing string of the Weather/tide Planner (design-spec.md, Content
// Notes), in one module so the count-bearing ones are swept by planCopy.test.ts
// over a generated corpus and so the em-dash rule has one place to look. The
// daily resolution label is the single-moment lookup's own, shared through
// lib/forecastLabels.ts (extracted, not copied). Entry-safe: no imports beyond
// that module.
//
// Since plan-sun-moon-readout: the Weather tab's entry reads Plan and its two
// actions read "Get specific forecast" and "See all upcoming weather and tide
// data" (the user's words, OQ-04); the readout, the sun track, the moon line
// and the slider's words all live here (the keys are the Architect's, the
// words the Designer's). Identifiers, storage keys and replay keys did not
// change for the rename (FR-04).
//
// Voice: short and factual. No em dash anywhere; ranges use the arrow in the
// window line and the middle dot everywhere else; negative heights use the
// minus sign (lib/planFormat.ts prints it); degrees are "°" with no space.

import { FORECAST_DAILY_LABEL, FORECAST_HOURLY_LABEL } from './forecastLabels'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const DEG = '°'

export const PLAN_COPY = {
  /** The Weather tab's entry button and its accessible name (FR-01). */
  entryLabel: 'Plan',
  entryAria: 'Plan weather and tide for a place',
  /** The single-moment action inside the form (FR-02). */
  forecastAction: 'Get specific forecast',
  /** The plan action inside the form (FR-02, OQ-04: the user's words). */
  actionLabel: 'See all upcoming weather and tide data',
  caption: 'The plan runs from now to the end of the forecast, about eight days, for the place above. The date and time apply only to Get specific forecast.',
  loading: (place: string) => `Building the plan for ${place}…`,
  ready: (place: string) => `Plan ready for ${place}.`,
  regionName: 'Weather and tide plan',
  /** The divider's label, and through it the day list's accessible name (D4-09). */
  listName: 'Day by day',
  pill: (days: number) => `Plan · ${plural(days, 'day', 'days')}`,
  localTimeLine: (lat: string, lng: string, fetched: string) => `Local time at this spot · ${lat}, ${lng} · fetched ${fetched}`,
  stationLine: (name: string, id: string, distanceMi: string) => `Tide: ${name} (${id}) · ${distanceMi} mi · `,
  stationPredicted: 'Predicted',
  stationSuffix: ' · relative to MLLW',
  stationInterpolated: ' · heights between highs and lows are interpolated',
  hourlyLabel: FORECAST_HOURLY_LABEL,
  dailyLabel: FORECAST_DAILY_LABEL,
  /** The resolution in the slider's value text, lower case in a sentence. */
  forecastHourlyWords: 'forecast hourly',
  forecastDailyWords: 'forecast daily',
  stripHourlyTag: 'FORECAST · HOURLY',
  stripDailyTag: 'FORECAST · DAILY FROM HERE',
  daySky: (description: string, high: number | null, low: number | null) =>
    high !== null && low !== null ? `${description} all day, H ${high}° L ${low}°` : `${description} all day`,
  skySummary: (readings: number) => `Sky hour by hour, ${plural(readings, 'reading', 'readings')}`,
  skyBoundary: (time: string, description: string) => `from ${time} ${description} (daily)`,
  sunrise: 'Sunrise',
  sunset: 'Sunset',
  tideRising: 'rising',
  tideFalling: 'falling',
  tideTrendUnknown: 'trend unknown (no later high or low in the data)',
  tideHeight: (heightFt: string) => `Tide ${heightFt} ft`,
  bracketSide: (kind: 'high' | 'low', heightFt: string, time: string) => `${kind} ${heightFt} ft (${time})`,
  bracketBetween: (prev: string, next: string) => `between ${prev} and ${next}`,
  bracketAfter: (prev: string) => `after ${prev}; no later high or low in the data`,
  bracketBefore: (next: string) => `before ${next}; no earlier high or low in the data`,
  bracketNone: 'no high or low in the data on either side',
  /** The per-day tides line: every high and low of that day, so the set of
   *  turning points in the list equals the set drawn on the chart (FR-27). */
  tidesPrefix: 'Tides: ',
  noSunrise: 'No sunrise this day.',
  noSunset: 'No sunset this day.',
  tideUnavailable: 'Tide is unavailable for this spot.',
  providerError: 'Weather is unavailable right now.',
  overrideAria: 'Show the nearest tide station anyway',
  /** The timeline's accessible name (the slider, FR-23): the place, the
   *  window, that the arrow keys read any moment, and where the details are. */
  chartNameWithTide: (place: string, start: string, end: string) =>
    `Plan timeline for ${place}, ${start} to ${end}. The arrow keys read the tide, weather and sun height at any moment. Details are in the list below.`,
  chartNameNoTide: (place: string, start: string, end: string) =>
    `Plan timeline for ${place}, ${start} to ${end}; no tide is shown. The arrow keys read the weather and sun height at any moment. Details are in the list below.`,
  daysInView: 'Days in view',
  daysOption: (view: '1' | '3' | '7' | 'all', dayCount: number) =>
    view === 'all' ? `All ${plural(dayCount, 'day', 'days')}` : plural(Number(view), 'day', 'days'),
  earlierDay: 'Earlier day',
  laterDay: 'Later day',
  stripHourlyEvery: (hours: number) => `FORECAST · HOURLY · A GLYPH EVERY ${hours} HOURS`,
  stripHourlyShort: (hours: number) => `HOURLY · EVERY ${hours} H`,
  stripHourlyMin: 'HOURLY',
  stripDailyShort: 'DAILY',
  legendDay: 'Day',
  legendNight: 'Night',
  legendSunrise: 'Sunrise',
  legendSunset: 'Sunset',
  legendHigh: 'High',
  legendLow: 'Low',
  legendSun: 'Sun height',
  scrollHint: 'Scroll sideways for later days',
  nowLabel: 'Now',
  closingNote: 'The plan stops where the weather forecast stops. Tide predictions reach further ahead: for any later moment, use Get specific forecast with a date and time.',
  windLabel: 'Wind',
  humidityLabel: 'Humidity',
  dewPointLabel: 'Dew pt',
  cloudLabel: 'Cloud',
  // ── the picked-moment readout (FR-07 to FR-13, FR-17) ──────────────────────
  restLine: 'Tap or click the timeline, or focus it and use the arrow keys, to read the tide, weather and sun height at any moment.',
  keysLine: 'Arrow keys step 15 minutes, with Shift an hour. Page Up and Page Down move a day, Home and End go to the ends, Escape clears.',
  estimateLine: 'Estimated from the plan, not a fresh lookup. For an exact moment, use Get specific forecast.',
  noTide: 'No tide in this plan',
  noWeather: 'No weather reading in the plan for this moment',
  timeUnavailable: 'Local time unavailable',
  sunAbove: (n: number) => `Sun ${n}${DEG} above the horizon`,
  sunBelow: (n: number) => `Sun ${n}${DEG} below the horizon`,
  sunOnHorizon: 'Sun on the horizon',
  // ── the per-day list's moon and sun-peak line (FR-34, FR-35) ────────────────
  sunPeak: (time: string, n: number) =>
    n >= 0 ? `Sun highest at ${time}, ${n}${DEG} above the horizon` : `Sun highest at ${time}, ${-n}${DEG} below the horizon`,
  sunPast: (time: string, n: number) =>
    n >= 0 ? `Sun past its highest today, ${n}${DEG} above the horizon at ${time}` : `Sun past its highest today, ${-n}${DEG} below the horizon at ${time}`,
  /** The first day's heading suffix: the entry is the rest of today (D4-08). */
  fromSuffix: (time: string) => `· from ${time}`,
} as const
