# Proposed CHANGELOG line: desktop-csp-frame-protection

For the bundle's version entry in `CHANGELOG.md`. Not written there: this is a
Spool spin, so the version stamp and the changelog are applied at the bundle
ship. `CHANGELOG.md` is not a held published surface, so no copy approval is
needed; it is proposed here only because the spin does not bump.

Section: `### Changed`

```
- The Mac, Windows, iPhone and iPad apps now run under a content security policy: the app's window runs only SnowRaven's own code, and loads map tiles, the eBird and Birds of the World link icons and Macaulay Library players only from the services it already used. Nothing you see or do in the app changes.
```

Notes for whoever stamps it:

- American spelling, no em dashes, no counts.
- It names no host and claims no new protection for the web or Raspberry Pi
  install, which got its own headers in 1.0.48.
- It does not claim the app "cannot send data anywhere else": requests the app
  makes through its native networking (every API call) are outside the page's
  policy, so that sentence would be false.
