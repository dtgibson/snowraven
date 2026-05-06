<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# Security Checklist — React Native + Expo

Loaded by the Security Builder for projects with
`frontend: "react-native-expo"`.

---

## Secure Storage

- [ ] Authentication tokens are stored in `expo-secure-store` —
      not in `AsyncStorage` which is unencrypted
- [ ] Sensitive user data (PII, payment tokens) is stored in
      `expo-secure-store` or not stored on device at all
- [ ] No secrets or API keys are hardcoded in source files —
      all sensitive values are environment variables or
      fetched from a secure backend
- [ ] `expo-constants` `expoConfig.extra` fields do not contain
      secrets — they are bundled into the app binary

## API Communication

- [ ] All API calls use HTTPS — no plaintext HTTP in production
- [ ] Certificate pinning is implemented for APIs handling
      sensitive data — or a documented decision exists explaining
      why it is not needed
- [ ] Authentication tokens are sent in Authorization headers —
      not in URL parameters (URL parameters appear in logs)
- [ ] API keys for third-party services are called through
      a backend proxy — not directly from the mobile app

## Deep Links

- [ ] Deep link handlers validate the URL scheme and host
      before processing — no open redirect vulnerabilities
- [ ] Deep links that trigger authenticated actions verify
      the user's session before proceeding
- [ ] OAuth callback deep links validate the `state` parameter —
      not just the `code`

## Authentication

- [ ] Biometric authentication (if used) falls back to PIN or
      password — it does not fall back to no authentication
- [ ] Session expiry is enforced — users are prompted to
      re-authenticate after inactivity
- [ ] Logout removes all tokens from secure storage —
      verified, not assumed

## App Binary & Build

- [ ] No secrets, API keys, or credentials appear in
      `app.json`, `app.config.js`, or `eas.json`
- [ ] EAS secrets are used for build-time environment variables —
      not committed values
- [ ] The production build has debug mode disabled
- [ ] Source maps are not included in the production binary

## Permissions

- [ ] The app only requests permissions it actually uses —
      no speculative permission requests
- [ ] Sensitive permissions (camera, location, contacts) have
      a clear user-facing explanation of why they are needed
- [ ] Location permission uses the minimum precision needed —
      `approximate` instead of `precise` unless precise is required

## Dependencies

- [ ] No known vulnerable packages in `package.json`
- [ ] `expo`, `react-native`, and SDK packages are on a
      current, supported version
- [ ] Native modules from third parties are reviewed —
      third-party native code has full access to the device
