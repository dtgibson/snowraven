# Schema — Checklist Weather Lookup

## Path
Frontend Only — No data layer changes required

## Confirmation
Every user story and functional requirement in the PRD has been reviewed. No data is created, stored, updated, or deleted. The feature fetches from two external APIs on demand and returns a formatted string. No tables, columns, relationships, or migrations are needed.

## Existing Data Used by This Feature

This is a new project with no persistent data. There is no existing schema. The feature works entirely with transient data from two external sources:

### eBird API
- Endpoint: `GET https://api.ebird.org/v2/product/checklist/view/{subId}`
- Fields consumed: `obsDt`, `loc.lat`, `loc.lng`, `durationHrs`
- Auth: `X-eBirdApiToken` header from `EBIRD_API_KEY` env var

### OpenWeather One Call API 3.0
- Endpoint: `GET https://api.openweathermap.org/data/3.0/onecall/timemachine`
- Fields consumed: `data[].temp`, `data[].humidity`, `data[].dew_point`, `data[].wind_speed`, `data[].wind_deg`, `data[].clouds`, `data[].weather[0].id`, `data[].weather[0].description`, `current.sunrise`, `current.sunset`
- Auth: `appid` query param from `OPENWEATHER_API_KEY` env var

### Internal API Contract
The FastAPI backend will expose one endpoint the frontend calls:

```
GET /weather/{checklist_id}

Response 200:
{
  "formatted": "<full plain-text weather block as defined in FR-14>"
}

Response 400:
{
  "error": "<user-facing error message>"
}

Response 500:
{
  "error": "API key not configured. Check your .env file."
}
```

The frontend renders `formatted` directly into the output block. No parsing or transformation needed on the frontend side.

## No Data Layer Work Required
The Engineer can proceed directly to implementation. No migrations need to be written or run for this feature.
