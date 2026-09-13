// Predict's daily-summary wording, extracted so the single-moment result and the
// Weather/tide Planner label a daily reading with ONE constant rather than two
// copies that can drift (tide-weather-planner FR-17 / FR-53; schema section 11).
//
// EXTRACTED, NOT COPIED: WeatherForecastPanel imports these and renders exactly
// the bytes it rendered before, so Predict's output is byte-identical. The
// hourly label is new and parallel; Predict never shows it.

/** The pill text Predict shows on a daily-summary result, and the plan's
 *  daily resolution micro-label. */
export const FORECAST_DAILY_LABEL = 'FORECAST · DAILY'

/** The suffix Predict appends to a daily reading's description. */
export const FORECAST_DAILY_DESCRIPTION_SUFFIX = ', forecast for that day'

/** The plan's hourly resolution micro-label (new; parallel to the daily one). */
export const FORECAST_HOURLY_LABEL = 'FORECAST · HOURLY'
