# PRD — API Key Settings

## Overview

Add an "API Keys" section to the Settings tab with two rows — eBird API Key and OpenWeather API Key. Each row lets the user enter and save a key to `backend/.env`, view it masked with a toggle to reveal, and clear it. The backend updates `os.environ` in-process so saved keys take effect without a server restart.

---

## Backend

**New file:** `backend/routers/apikeys.py`

**ENV_FILE path:** `Path(__file__).resolve().parent.parent / ".env"` → `backend/.env`

**Valid slot names and env var mappings:**
```python
KEY_MAP = {
    "ebird":       "EBIRD_API_KEY",
    "openweather": "OPENWEATHER_API_KEY",
}
```

Any request with a `key_name` not in `KEY_MAP` returns 404.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings/keys` | Returns current value of both keys (or null) |
| `POST` | `/settings/keys/{key_name}` | Saves key to `.env` and updates `os.environ` |
| `DELETE` | `/settings/keys/{key_name}` | Removes key from `.env` and from `os.environ` |

**`GET /settings/keys`**
Response: `{ "ebird": "abc123..." | null, "openweather": "xyz..." | null }`
Reads values via `get_key(ENV_FILE, var_name)` from python-dotenv. Returns `null` for missing or empty values.

**`POST /settings/keys/{key_name}`**
Request body (JSON): `{ "value": "abc123" }`
- Validates `key_name` in `KEY_MAP`; 404 if not
- Validates `value` is a non-empty string after strip; 400 if blank
- Calls `set_key(ENV_FILE, var_name, value)` — creates `.env` if absent
- Calls `os.environ[var_name] = value` for immediate in-process effect
- Returns `{ "ok": true }`

**`DELETE /settings/keys/{key_name}`**
- Validates `key_name` in `KEY_MAP`; 404 if not
- Calls `unset_key(ENV_FILE, var_name)` — no-ops gracefully if key absent
- Calls `os.environ.pop(var_name, None)`
- Returns `{ "ok": true }`

**Register in `main.py`:**
```python
from routers.apikeys import router as apikeys_router
app.include_router(apikeys_router)
```

---

## Frontend

**New `KeyRow` component** inside `Settings.tsx` (not a separate file).

**`ApiKeyStatus` type** (local to Settings.tsx):
```typescript
interface ApiKeyStatus {
  ebird: string | null
  openweather: string | null
}
```

**State added to `Settings`:**
```typescript
const [keys, setKeys] = useState<ApiKeyStatus>({ ebird: null, openweather: null })
// per-key: visible, editing, input, saving, error
```

**Fetch keys on mount** — extend the existing `useEffect` to also call `GET /settings/keys`.

### `KeyRow` visual states

*Not set, not editing:*
- Grey key icon
- Label + sublabel ("Not configured")
- "No key saved" chip
- [Add key] button

*Not set, editing:*
- Grey key icon
- Label + input (type="text", placeholder="Paste your API key")
- [Save] (disabled if blank) + [Cancel]

*Set, not editing:*
- Green key icon
- Label + `••••••••••••••••` or revealed value + [Show / Hide] toggle
- [Update] + [Clear]

*Set, editing:*
- Green key icon
- Label + input (placeholder="Enter new key to replace")
- [Save] + [Cancel]

**Section placement:** "API Keys" section above "Default Files", same header pattern.

---

## Acceptance Criteria

1. `GET /settings/keys` returns actual key values (or null) for both slots
2. Saving a key writes it to `backend/.env` with the correct variable name
3. The saved key takes effect in the running server immediately — no restart required
4. A saved key displays as `••••••••••••••••` by default
5. Clicking "Show" reveals the actual key; "Hide" masks it again
6. Clicking "Clear" removes the key from `.env`, `os.environ`, and the UI
7. "Add key" / "Update" shows an input field; "Cancel" dismisses without saving
8. Save button disabled when input is blank
9. Error message below the row if save or delete fails
10. "API Keys" section appears above "Default Files"
11. Invalid `key_name` returns 404
12. Blank `value` on POST returns 400
13. Clearing a key that isn't set is a no-op
14. Keys state loads on Settings mount alongside file status
