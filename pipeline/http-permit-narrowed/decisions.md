# Decisions: http-permit-narrowed

## 2026-10-03: Security errand. L1 closed by a rule clause, not a tightness row

The security review's L1 found that `tauriHttpScope.test.ts` enforces a floor on how wide an entry may be, not tightness. If an entry is shortened to a broader prefix on the same host (NOAA's to `/api/*`, GitHub's to `/repos/*`), the guard stays green. The review offered two closes.

**Chosen:** a clause in the permit rule in `.claude/rules/security.md`, point (1). It says the guard enforces a floor:
- a fixed path segment
- no dot segment or percent escape
- origins equal to the call sites'
- no entry without a call site

It also says that holding each entry to the path its call sites fix is a review check on every `src-tauri/capabilities/**` diff, and is not enforced by the guard. The guard's header says the same.

**Why not the tightness row:**
- It would turn OpenWeather into two exact entries (`/data/3.0/onecall` and `/data/3.0/onecall/timemachine`). That changes `src-tauri/capabilities/default.json` after the brief approved `/data/3.0/*` and after the dev-mode check measured the entries as they ship, so it would also mean re-running that real-app check.
- A longest-common-prefix rule is a new model of the matcher, and it would need its own mutation table.
- The widening L1 describes stays on a host already listed. It adds no destination, and the query is already free.

**Reversal:** add the tightness row, and accept the two OpenWeather entries, if a shortened entry ever gets past a review unnoticed.

L2 (dot segments) and I5 (rule wording) were closed in the same errand. See `pr-description.md`, Security errand.
