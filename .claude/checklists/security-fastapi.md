<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# Security Checklist — Python / FastAPI

Loaded by the Security Builder for projects with
`backend: "python-fastapi"`.

---

## Authentication & Authorization

- [ ] All protected endpoints use a dependency that verifies
      the JWT or API key — no endpoint assumes authentication
- [ ] JWT validation uses a trusted library (e.g. `python-jose`,
      `PyJWT`) — no manual token parsing
- [ ] JWT secret is loaded from environment variables — never
      hardcoded
- [ ] Token expiry is enforced — expired tokens are rejected
- [ ] Role or permission checks are applied at the endpoint level
      where needed — not just at login
- [ ] API keys (if used) are hashed before storage — never stored
      in plaintext

## Injection

- [ ] All database queries use parameterized statements or an ORM —
      no string formatting or f-strings used to construct queries
- [ ] User input is never passed directly to `eval()`, `exec()`,
      `subprocess`, or `os.system()`
- [ ] File paths derived from user input are sanitized —
      no path traversal vulnerabilities (e.g. `../` sequences)
- [ ] XML input (if any) uses a safe parser with external entity
      processing disabled

## Dependencies

- [ ] `requirements.txt` or `pyproject.toml` pins specific versions —
      no unpinned dependencies
- [ ] No known vulnerable packages — check against current CVE
      databases for packages in use
- [ ] Unused dependencies are not present — smaller surface area
- [ ] Development dependencies are not included in production
      requirements

## Input Validation

- [ ] All request bodies are validated with Pydantic models —
      no raw dict access without validation
- [ ] Query parameters and path parameters are typed and validated
- [ ] File uploads (if any) validate file type by content, not
      just extension
- [ ] Request size limits are configured to prevent oversized
      payloads

## Error Handling

- [ ] Unhandled exceptions return a generic 500 response —
      stack traces are never exposed to clients
- [ ] Validation errors return structured responses without
      internal implementation details
- [ ] Database errors are caught and logged internally —
      not returned in API responses
- [ ] Debug mode (`DEBUG=True`) is disabled in production

## Environment Variables

- [ ] `SECRET_KEY` or JWT secret is set in `.env` — not hardcoded
- [ ] `DATABASE_URL` is set in `.env` — not hardcoded
- [ ] No credentials appear in any committed file
- [ ] `.env` is in `.gitignore` — verified, not assumed
- [ ] Production environment variables differ from development —
      no shared secrets across environments

## CORS & Headers

- [ ] CORS origins are explicitly configured — not wildcard
      unless the API is genuinely public
- [ ] Security headers are set (X-Content-Type-Options,
      X-Frame-Options, etc.) — consider `secure-headers` middleware
- [ ] HTTPS is enforced in production — no plaintext HTTP

## Rate Limiting

- [ ] Rate limiting is applied to authentication endpoints —
      login, password reset, token refresh
- [ ] Rate limiting is applied to any compute-heavy or
      external-call endpoints
