---
name: feedback-versioning
description: Version bump convention — patch increments for all features and fixes in this project; minor bumps are not used
metadata:
  type: feedback
---

Always use patch version increments (e.g. 0.3.21 → 0.3.22) for both features and bug fixes. Minor bumps (0.3.x → 0.4.0) are not used in this project's convention — even substantial new features ship as patch increments. Looking at history: county filters (0.0.34), location access (0.3.22), all patch bumps.

**Why:** The user corrected a 0.3.21 → 0.4.0 minor bump for the "Use my location" feature, redirecting to 0.3.22.

**How to apply:** Always increment the last digit only. Do not attempt minor bumps.
