<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# Security Checklist — Supabase

Loaded by the Security Builder for projects with `backend: "supabase"`.

---

## Authentication

- [ ] All authenticated routes check `auth.uid()` — no route assumes
      the user is logged in without verification
- [ ] Sign-up, login, and password reset flows use Supabase Auth
      methods — no custom auth logic
- [ ] Session tokens are never stored in localStorage — use
      Supabase's built-in session management
- [ ] Auth state changes are handled with `onAuthStateChange` —
      no manual token parsing
- [ ] Email confirmation is enabled for new accounts if the product
      requires verified emails
- [ ] Password reset tokens expire appropriately — not extended
      beyond Supabase defaults without justification

## Row Level Security (RLS)

- [ ] RLS is enabled on every table that stores user data
- [ ] Every RLS policy is tested — not just present but actually
      restrictive
- [ ] No table has a policy of `USING (true)` without documented
      justification
- [ ] Users can only read their own rows unless cross-user access
      is explicitly required
- [ ] Users can only write their own rows — no policy allows a
      user to update another user's data
- [ ] Service role key is never used client-side — only in
      server-side or edge function contexts
- [ ] Anon key permissions are reviewed — anon users should have
      the minimum access required

## Storage

- [ ] Storage bucket policies restrict access to authenticated
      users unless public access is explicitly required
- [ ] File upload size limits are configured
- [ ] Allowed file types are restricted — no open accept-all
      upload policies
- [ ] Uploaded files are not directly executable — no `.js`,
      `.html`, or script files in user-controlled buckets
- [ ] Storage URLs are not exposed in client-side code beyond
      what is necessary

## Edge Functions

- [ ] Edge functions verify the JWT from the Authorization header
      before processing any request
- [ ] Edge functions do not expose the service role key in
      response bodies or logs
- [ ] CORS headers are configured restrictively — not wildcard
      unless explicitly required
- [ ] Edge function environment variables are set in Supabase
      dashboard — not hardcoded in function source
- [ ] Error responses do not leak internal implementation details

## Environment Variables

- [ ] `SUPABASE_URL` is present in `.env` — not hardcoded
- [ ] `SUPABASE_ANON_KEY` is present in `.env` — not hardcoded
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is present in `.env` — not
      hardcoded and never used client-side
- [ ] No Supabase credentials appear in any committed file
- [ ] `.env` is in `.gitignore` — verified, not assumed

## Data Handling

- [ ] User-provided input is not inserted into queries without
      using Supabase's parameterized query methods
- [ ] Sensitive user data (passwords, payment info) is never
      stored in Supabase directly — use appropriate services
- [ ] Personal data fields are only returned in queries that
      need them — no `SELECT *` on tables with PII
