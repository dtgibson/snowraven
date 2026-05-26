# Schema — API Key Settings

## New file: `backend/routers/apikeys.py`

```python
import os
from pathlib import Path
from dotenv import get_key, set_key, unset_key
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

KEY_MAP: dict[str, str] = {
    "ebird":       "EBIRD_API_KEY",
    "openweather": "OPENWEATHER_API_KEY",
}

class KeyValue(BaseModel):
    value: str

@router.get("/settings/keys")
def get_keys() -> dict:
    return {
        slot: get_key(ENV_FILE, var) or None
        for slot, var in KEY_MAP.items()
    }

@router.post("/settings/keys/{key_name}")
def save_key(key_name: str, body: KeyValue) -> dict:
    if key_name not in KEY_MAP:
        raise HTTPException(status_code=404, detail="Unknown key.")
    value = body.value.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Key value cannot be blank.")
    var = KEY_MAP[key_name]
    set_key(ENV_FILE, var, value)
    os.environ[var] = value
    return {"ok": True}

@router.delete("/settings/keys/{key_name}")
def delete_key(key_name: str) -> dict:
    if key_name not in KEY_MAP:
        raise HTTPException(status_code=404, detail="Unknown key.")
    var = KEY_MAP[key_name]
    unset_key(ENV_FILE, var)
    os.environ.pop(var, None)
    return {"ok": True}
```

## Modified: `backend/main.py`

```python
from routers.apikeys import router as apikeys_router
app.include_router(apikeys_router)
```

## Modified: `frontend/src/components/Settings.tsx`

### New local type
```typescript
interface ApiKeyStatus {
  ebird: string | null
  openweather: string | null
}
```

### New KeyRow props
```typescript
interface KeyRowProps {
  label: string
  sublabel: string
  value: string | null
  visible: boolean
  editing: boolean
  input: string
  saving: boolean
  error: string | null
  onToggleVisible: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onInputChange: (v: string) => void
  onSave: () => void
  onDelete: () => void
}
```

### New state in Settings
```typescript
const [keys, setKeys] = useState<ApiKeyStatus>({ ebird: null, openweather: null })
// per-key: visible, editing, input, saving, error (boolean/string pairs)
```

### Extended useEffect
Existing fetch of `/settings/files` extended to also fetch `/settings/keys`.

### New handlers
```typescript
handleSaveKey(slot: 'ebird' | 'openweather'): Promise<void>
// POST /settings/keys/{slot} { value: input }
// On success: update keys state, exit edit mode

handleDeleteKey(slot: 'ebird' | 'openweather'): Promise<void>
// DELETE /settings/keys/{slot}
// On success: set keys[slot] = null, setVisible(false)
```

## Files affected

| File | Change |
|------|--------|
| `backend/routers/apikeys.py` | New — 3 endpoints |
| `backend/main.py` | +2 lines: import + include_router |
| `frontend/src/components/Settings.tsx` | New KeyRow, new state, extended fetch |

No new frontend files. No Vite proxy changes. No new dependencies.
