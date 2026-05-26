# Schema — Desktop App Phase 1: Weather Formatter

## Path
Frontend Only — No data layer changes required

## Confirmation
This feature has been assessed against all user stories and functional requirements (FR-01 through FR-13) and confirmed to require no database, filesystem, or API changes. The formatter is a pure function; the test suite is entirely static.

## Existing Data Used by This Feature

### OpenWeather One Call Timemachine Response
The formatter's input type mirrors the response shape already consumed by `backend/services/openweather.py` and mocked in `backend/tests/test_weather_router.py`. No new fetch calls — this shape is passed in as a function argument.

- Fields used: `data[0].temp`, `data[0].humidity`, `data[0].dew_point`, `data[0].wind_speed`, `data[0].wind_deg`, `data[0].clouds`, `data[0].weather[0].id`, `data[0].weather[0].description`, `data[0].sunrise`, `data[0].sunset`
- How used: Consumed by `formatWeather()` to produce the formatted text block

### Python Reference Formatter
- File: `backend/formatters/weather.py`
- How used: The golden Python helper script (`weatherFormatter.golden.py`) imports this module directly to generate reference output for each test fixture. The TypeScript implementation is validated against that output.

### Existing Test Infrastructure
- Vitest is already configured in `frontend/`; no new test runner setup needed
- `frontend/src/lib/` is where the new module lives, consistent with `transport.ts`, `storage.ts`, and `platform.ts`

## No Data Layer Work Required
The Engineer can proceed directly to implementation. No migrations need to be written or run for this feature.
