# Strategic Brief — API Key Settings

## What We're Building

A section on the Settings tab where the user can enter, save, and view their eBird and OpenWeather API keys. Saving writes the keys to `backend/.env` and updates the running process's environment so new keys take effect immediately — no terminal required.

## Why Now

Setting up SnowRaven today requires editing a hidden file in a terminal. For a self-hosted personal tool, that's a meaningful barrier — especially when sharing with birding friends who aren't developers. The Settings tab already handles the "data files" problem in the same spirit; API keys are the other half of first-run setup. Solving both in the same place makes the app genuinely self-contained.

## The User Problem

A new user installs SnowRaven, opens the app, tries a weather lookup, and gets an error — because they haven't configured their API keys yet. The fix requires finding the `backend/.env` file, knowing to create it if it doesn't exist, knowing which variable names to use, and restarting the server. None of that is obvious. A UI for this removes the only remaining setup step that requires developer knowledge.

## Success Criteria

- User can enter and save an eBird API key and an OpenWeather API key from the Settings tab
- Saving writes the values to `backend/.env` using the correct variable names (`EBIRD_API_KEY`, `OPENWEATHER_API_KEY`)
- The running server's environment is updated in-process so the keys work immediately — no restart required
- Saved keys are shown masked by default; a show/hide toggle reveals the actual value
- A "saved" indicator confirms when a key is stored; an empty state makes clear when it isn't
- Clearing a key removes it from `.env` and from the in-process environment

## Scope

- Two key fields: `EBIRD_API_KEY` and `OPENWEATHER_API_KEY`
- Backend: new endpoints to read, write, and delete individual keys from `.env`
- Frontend: two key-management rows on the Settings tab (same visual pattern as the file rows)
- In-process env update: after writing to `.env`, also call `os.environ[key] = value` so the running server picks it up without restart
- Show/hide toggle per key field

## Out of Scope

- Validating keys against the eBird or OpenWeather APIs
- Any key types beyond the two already in use
- Encryption of the `.env` file at rest
- Key rotation, expiry, or audit logging

## Key Decisions

- **Write to `.env` AND update `os.environ` in-process.** Writing to `.env` alone would require a server restart to take effect. Updating `os.environ` immediately makes the key usable right away; `.env` ensures persistence across restarts.
- **Return actual key values from the read endpoint.** The Settings tab needs to show the key when unmasked. This is appropriate for a self-hosted personal tool accessible only on localhost. Key values are never logged.
- **Use `python-dotenv` for `.env` parsing and writing.** Handles the file format correctly without a hand-rolled parser.
- **Same visual pattern as file rows.** Reuses the existing Settings UI structure for cohesion.
