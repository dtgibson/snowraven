# Change Brief — Derive Upload Size Copy

## What is changing
The frontend refusal sentence and FastAPI 413 detail will format their “50 MB” label from the byte-limit constants they describe. The shipped wording and enforcement stay unchanged at the current limit.

## Why now
The ML export hardening audit found that both messages repeat the limit as an independent literal. A later cap change could therefore leave either surface giving users a false number while its tests still exercise the right enforcement constant.

## User-facing impact
None at the current 50 MiB limit: both sentences remain byte-identical. Future limit changes update enforcement and copy together.

## Design pass
Not needed — no visual or copy change.

## Decisions touched
The v1.0.23 upload-refusals registry decision is strengthened, not reversed: its single chokepoint and cross-runtime cap parity remain intact, and the messages now derive from the same enforcement values.

## What done looks like
Both runtimes emit their existing 50 MB sentences from their byte constants. Tests change the enforced cap and prove the corresponding detail changes, while the frontend/backend parity, boundary behavior, and all focused upload suites stay green.
