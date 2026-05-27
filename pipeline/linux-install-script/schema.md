# Schema — Linux Install Script

## Path
Frontend Only — No data layer changes required

## Confirmation
All 15 functional requirements and 6 user stories were reviewed. The script creates system files (`.env`, `/etc/systemd/system/snowraven.service`) and builds static assets — none of these are application data structures. The running SnowRaven app's data layer is unchanged.

## Existing Artifacts the Engineer Will Work With

### `backend/.env`
- Fields written: `EBIRD_API_KEY`, `OPENWEATHER_API_KEY`
- How used: The install script creates this file if it doesn't exist. Format must match what `python-dotenv` loads in `backend/main.py`. Both keys default to empty string if the user skips at the prompt.

### `deploy/snowraven.service`
- Fields modified by script: `User=pi` → `User=$USER`; `WorkingDirectory=` and `ExecStart=` paths → chosen install directory
- How used: The script copies this file to `/etc/systemd/system/snowraven.service` with substitutions applied via `sed`. The Engineer should verify all hardcoded paths in the unit file before substituting.

### `start.sh`
- How used: The local install mode's success message directs the user to run `./start.sh` from the install directory. The script assumes `start.sh` exists at the repo root and is executable. No changes to `start.sh`.

### `frontend/` and `backend/requirements.txt`
- How used: The script runs `npm ci && npm run build` in `frontend/` and `pip install -r requirements.txt` in `backend/`. No changes to either — the script consumes them as-is.

## No Data Layer Work Required
The Engineer can proceed directly to writing `install.sh`.
