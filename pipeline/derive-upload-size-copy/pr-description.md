## Derive Upload Size Copy

### What this does
The frontend upload refusal and FastAPI 413 detail now format their size label from the same byte constants that enforce the limit. At the current limit both user-facing sentences remain exactly unchanged at 50 MB.

### How to test
1. Run `npm test -- --run src/lib/uploadGuard.test.ts src/components/Settings.upload.test.tsx` from `frontend`.
2. Run `.venv/bin/python -m pytest tests/test_settings_router.py -q` from `backend`.
3. Change either test-time cap and confirm the expected refusal detail follows it while exact-cap uploads still succeed.

### Notes for reviewer
The frontend formula is checked against a deliberately changed limit and rejects the former hardcoded sentence. Backend endpoint tests lower `MAX_BYTES` to 1 MiB and require the returned detail to say 1 MB, proving the response reads the enforcement constant rather than a parallel label.
