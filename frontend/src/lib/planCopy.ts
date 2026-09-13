// Every user-facing string of the Weather/tide Planner (design-spec.md, Content
// Notes), in one module so the count-bearing ones are swept by planCopy.test.ts
// over a generated corpus and so the em-dash rule has one place to look. The
// daily resolution label is Predict's own, shared through lib/forecastLabels.ts
// (extracted, not copied). Entry-safe: no imports beyond that module.
//
// Voice: Predict's, short and factual. No em dash anywhere; ranges use the
// arrow in the window line and the middle dot everywhere else; negative
// heights use the minus sign (lib/planFormat.ts prints it).

import { FORECAST_DAILY_LABEL, FORECAST_HOURLY_LABEL } from './forecastLabels'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const PLAN_COPY = {
  actionLabel: 'Plan sunrises and sunsets',
  caption: 'The plan runs from now to the end of the forecast, about eight days, for the place above. The date and time apply only to Get forecast.',
  loading: (place: string) => `Building the plan for ${place}…`,
  ready: (place: string) => `Plan ready for ${place}.`,
  regionName: 'Weather and tide plan',
  listName: 'Sunrises and sunsets ahead',
  pill: (days: number) => `Plan · ${plural(days, 'day', 'days')}`,
  localTimeLine: (lat: string, lng: string, fetched: string) => `Local time at this spot · ${lat}, ${lng} · fetched ${fetched}`,
  stationLine: (name: string, id: string, distanceMi: string) => `Tide: ${name} (${id}) · ${distanceMi} mi · `,
  stationPredicted: 'Predicted',
  stationSuffix: ' · relative to MLLW',
  stationInterpolated: ' · heights between highs and lows are interpolated',
  hourlyLabel: FORECAST_HOURLY_LABEL,
  dailyLabel: FORECAST_DAILY_LABEL,
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
  chartNameWithTide: (place: string, start: string, end: string) =>
    `Chart of the predicted tide with sunrise, sunset, high and low markers and a weather strip for ${place}, ${start} to ${end}. Details are in the list below.`,
  chartNameNoTide: (place: string, start: string, end: string) =>
    `Chart of sunrise, sunset and weather for ${place}, ${start} to ${end}; no tide is shown. Details are in the list below.`,
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
  scrollHint: 'Scroll sideways for later days',
  nowLabel: 'Now',
  closingNote: 'The plan stops where the weather forecast stops. Tide predictions reach further ahead: for any later moment, use Get forecast with a date and time.',
  windLabel: 'Wind',
  humidityLabel: 'Humidity',
  dewPointLabel: 'Dew pt',
  cloudLabel: 'Cloud',
} as const
