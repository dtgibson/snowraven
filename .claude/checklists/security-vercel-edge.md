<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# Security Checklist — Vercel Edge Functions

Loaded by the Security Builder for projects with
`backend: "vercel-edge"`.

---

## Authentication

- [ ] Every edge function that requires authentication verifies
      the JWT or session token before processing
- [ ] Token verification uses `jose` or an equivalent — no
      manual JWT parsing
- [ ] JWT secret is loaded from Vercel environment variables —
      never hardcoded
- [ ] Unauthenticated requests receive a 401 response —
      not a 200 with empty data

## Environment Variables

- [ ] All secrets are stored in Vercel project environment
      variables — not in source files
- [ ] Production environment variables are separate from
      preview/development variables in the Vercel dashboard
- [ ] No credentials appear in `vercel.json` or any
      committed configuration file
- [ ] Edge functions access secrets via `process.env` —
      not via hardcoded values

## CORS

- [ ] CORS headers are explicitly configured on all edge functions
- [ ] `Access-Control-Allow-Origin` is set to specific allowed
      origins — not `*` unless the function is genuinely public
- [ ] Preflight OPTIONS requests are handled correctly
- [ ] CORS configuration matches what the frontend actually needs —
      no overly permissive configuration

## Rate Limiting

- [ ] Authentication and sensitive endpoints implement rate
      limiting — either via Vercel's built-in features or
      a middleware layer
- [ ] Rate limit responses return 429 with a `Retry-After` header
- [ ] Rate limits are appropriate for the expected traffic —
      not so tight they affect legitimate users

## Input Validation

- [ ] All request body parsing includes error handling —
      malformed JSON does not cause unhandled exceptions
- [ ] Query parameters used in logic are validated and typed —
      not used raw
- [ ] File uploads (if any) validate content type and size

## Secrets Handling

- [ ] Edge functions do not log secret values — even partially
- [ ] Error responses do not include environment variable names
      or values
- [ ] Vercel's edge runtime does not persist secrets between
      requests — verify no accidental global state

## Headers

- [ ] Security headers are set on responses:
      `X-Content-Type-Options: nosniff`
      `X-Frame-Options: DENY`
      `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Content-Type` is explicitly set on all responses —
      not left to browser inference

## Dependencies

- [ ] Edge function dependencies are compatible with the
      Vercel Edge Runtime — not all Node.js APIs are available
- [ ] No known vulnerable packages in dependencies used
      by edge functions
