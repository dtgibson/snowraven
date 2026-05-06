<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# Security Checklist — Next.js

Loaded by the Security Builder for projects with `backend: "nextjs"`
or `frontend: "nextjs"`.

---

## API Routes

- [ ] Every API route that requires authentication checks the session
      before processing — no route assumes the user is logged in
- [ ] API routes validate and sanitize all input — no raw
      `req.body` access without validation
- [ ] API routes return appropriate HTTP status codes — 401 for
      unauthenticated, 403 for unauthorized, not always 200
- [ ] Internal API routes (not meant to be public) are protected —
      not just undocumented
- [ ] API routes do not expose server-side environment variables
      in responses

## Environment Variables

- [ ] All `NEXT_PUBLIC_` variables contain only non-sensitive values —
      these are exposed to the browser
- [ ] Secret keys, API tokens, and credentials use non-public
      variable names (no `NEXT_PUBLIC_` prefix)
- [ ] `.env.local` is in `.gitignore` — verified, not assumed
- [ ] No credentials appear in any committed file including
      `next.config.js`
- [ ] `NEXTAUTH_SECRET` (if using NextAuth) is a strong random
      value set in environment variables

## Content Security Policy

- [ ] A Content Security Policy header is configured — either
      in `next.config.js` headers or middleware
- [ ] CSP does not use `unsafe-inline` for scripts without a
      nonce or hash strategy
- [ ] CSP does not use `unsafe-eval`
- [ ] Trusted external script domains are explicitly listed —
      no wildcard script sources

## Authentication (if using NextAuth or similar)

- [ ] Session tokens are httpOnly cookies — not localStorage
- [ ] CSRF protection is enabled — NextAuth handles this by
      default, verify it hasn't been disabled
- [ ] OAuth callback URLs are validated against an allowlist
- [ ] JWT session tokens have a reasonable expiry

## Server Components & Data Fetching

- [ ] Server Components do not pass sensitive data as props
      to Client Components unnecessarily
- [ ] `fetch` calls in Server Components do not expose API keys
      in URLs that could appear in logs
- [ ] Database queries in Server Components use parameterized
      statements — no string interpolation
- [ ] `getServerSideProps` and `getStaticProps` do not return
      sensitive fields that aren't needed client-side

## Headers

- [ ] Security headers are configured in `next.config.js`:
      X-Frame-Options, X-Content-Type-Options,
      Referrer-Policy, Permissions-Policy
- [ ] HTTPS is enforced — `next.config.js` redirects HTTP to HTTPS
      in production

## Dependencies

- [ ] No known vulnerable packages in `package.json` —
      check for advisories on direct dependencies
- [ ] `next` and related packages are on a current, supported version
