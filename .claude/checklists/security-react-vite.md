<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# Security Checklist — React + Vite

Loaded by the Security Builder for projects with
`frontend: "react-vite"`.

---

## API Keys & Secrets

- [ ] No API keys, tokens, or secrets appear in any source file —
      all sensitive values come from environment variables
- [ ] Only `VITE_` prefixed variables are used client-side —
      these are intentionally exposed to the browser
- [ ] `VITE_` prefixed variables contain only non-sensitive values —
      they are bundled into the client-side code
- [ ] `.env` and `.env.local` are in `.gitignore` — verified
- [ ] No credentials appear in `vite.config.ts` or any committed
      configuration file

## CORS & API Communication

- [ ] All API calls go through the configured backend — no direct
      calls to third-party APIs that would expose keys client-side
- [ ] API base URLs are environment variables — not hardcoded
- [ ] Error responses from the API are handled gracefully —
      raw error details are not displayed to users
- [ ] Requests include appropriate authentication headers —
      Bearer tokens are not stored in localStorage

## Authentication State

- [ ] Authentication tokens are stored in httpOnly cookies or
      in-memory — not localStorage or sessionStorage
- [ ] Logout clears all authentication state — tokens, user data,
      and cached responses
- [ ] Protected routes redirect unauthenticated users —
      no client-side-only route guards without server validation
- [ ] Token refresh logic handles expiry gracefully —
      users are redirected to login, not shown a broken state

## Input Handling

- [ ] User-generated content rendered as HTML uses a sanitization
      library — no `dangerouslySetInnerHTML` with unsanitized input
- [ ] URLs from user input or external data are validated before
      use in `href` or `src` attributes — no `javascript:` URLs
- [ ] Form inputs that affect navigation or state changes are
      validated client-side before submission

## Dependencies

- [ ] No known vulnerable packages in `package.json`
- [ ] `react`, `vite`, and direct dependencies are on
      current, supported versions
- [ ] Unused dependencies are not present

## Build Output

- [ ] Source maps are not deployed to production — they expose
      source code
- [ ] Console logs that contain sensitive data are removed
      before production build
- [ ] The production build does not include development-only
      code paths or debug tooling
