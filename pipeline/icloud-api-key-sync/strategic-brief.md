# Strategic Brief: iCloud API Key Sync

## What We're Building

A second, separate, off-by-default switch inside the iCloud Sync section of Settings on the Mac, iPhone and iPad apps that shares the user's two API keys (eBird and OpenWeather) across their own Apple devices through their own iCloud account. It is available only once file sync is on. Enter a key once on any device and every other device that has also turned the key switch on uses it.

## Why Now

iCloud Sync shipped in 1.0.11 and deliberately left keys out because they are secrets; the roadmap named this as the explicit follow-on ("its own switch with its own note, never folded into the file toggle, and the privacy pages change with it"). With file sync on, the one remaining per-device setup step is typing two keys into each device, and a device without a key is a device where Weather, Map Explorer and the rest of the networked features silently do nothing. The mechanism, container, entitlements, record validator, states and Settings surface all exist; this adds one small record and one switch to a path that is already provisioned and proven on both Apple builds.

Windows code signing stays first on the roadmap. This jumps ahead because it closes the last friction the primary user hits every time they set up or wipe an Apple device, and nothing in it touches the Windows item.

## The User Problem

A birder runs SnowRaven on a Mac, an iPhone and an iPad. File sync now means one upload reaches all three, but each device still has to be given the eBird key and the OpenWeather key by hand, which means finding them again on the provider sites or copying them across devices through some other channel. A new or reset device works for the offline tabs and looks broken for the rest until the user notices the empty key rows. The founding line is "your own API keys, entered once"; today on Apple that is once per device.

## Success Criteria

- On a fresh install of every platform the key switch is off. It is visible but disabled, with a one-line reason, until file sync is on and iCloud is available. Nothing about keys is written to iCloud before the user presses Turn on.
- The Windows app and the web/Pi build show no key switch and no dead controls; a Mac build without the iCloud entitlements stays in "This build cannot use iCloud" for keys as for files.
- The user turns key sync on on the Mac, which already holds both keys. They turn it on on an iPhone with no keys: both key rows fill in without typing, masked by default, each showing it came from the Mac and when. Weather and Map Explorer work on the phone at once.
- The user presses Update on the eBird key on the iPad. At their next check the Mac and the iPhone use the new key, and each of their eBird rows says it was replaced by the key from the iPad until the user's next action on that row.
- A device that receives a key identical to the one it already holds shows Up to date, not Replaced.
- With key sync on, Clear on a key row asks first and says it reaches every device sharing keys; confirming removes the key from this device, from iCloud, and from every other device with key sync on at its next check. With key sync off, Clear is the same instant local action as today.
- Turning the key switch off leaves this device's keys in place and working, stops all key checks and uploads, and removes the key copy from iCloud. If iCloud cannot be reached at that moment the switch still goes off and a Remove synced keys from iCloud control stays visible until the copy is gone.
- Turning file sync off turns the key switch off too, with the same effect. Remove synced files from iCloud never touches the key copy, and Remove synced keys from iCloud never touches the files.
- With key sync on and no network, each device keeps working with the keys it has; the key rows show an honest state (waiting to upload, iCloud unavailable) and nothing hangs or empties.
- A key value never appears in a filename, a record name, an error message, a sync state string, a log line or the enable note. Key rows stay masked unless the user presses Show, for a received key as for a typed one.
- With key sync off on both devices, the container holds exactly what 1.0.11 holds: the two files and their records. With key sync on, it holds one additional key record and nothing else; settings, caches and map style still never appear.
- PRIVACY_POLICY.md, docs/HELP.md, README.md and website/ describe the key path in the same change, the policy page parity test passes, and no published sentence claims more protection than iCloud provides.

## Scope

- One additional switch in the iCloud Sync section on macOS and iOS, below the file switch, off by default, enabled only when file sync is on and iCloud is available, with its own plain-language note before it turns on. The note says: what goes to iCloud (the eBird and OpenWeather keys as entered, and for each when it was last changed and which device changed it); whose account (the user's own iCloud account, on Apple's servers, in the same private SnowRaven container as the files, with no SnowRaven server in the path and nothing the developer can see); how Apple protects it (encrypted in transit and at rest by Apple, end-to-end only if the user has Advanced Data Protection turned on for their account); which devices (every Mac, iPhone and iPad signed in to this iCloud account that also turns key sync on); what happens next (a device with no key takes the shared one, the most recently changed key wins, a Clear reaches every sharing device); and how to stop (turning the switch off removes the copy from iCloud, and Remove synced keys from iCloud is available at any time). Turn on / Cancel; nothing is written before Turn on.
- Sync of exactly the two keys the app holds, eBird and OpenWeather, under the one switch, each as its own slot with its own change time and origin (device name, kind, and the random device id file sync already mints).
- Latest change wins, per key, whole, with the origin-id tiebreaker file sync already uses. A set and a clear are both changes. From this version every key save and clear through the storage seam records a change time on Apple builds; a key with no recorded change time counts as older than any synced key.
- Provenance and state on each key row in the API Keys section, in plain text, the way Default Files rows show them: where the current key came from and when, and a state from the file feature's vocabulary as applicable (Up to date; Syncing; Waiting to upload; iCloud unavailable; Sync off; Could not sync with Retry; Replaced by the key from another device).
- Clear on a key row with key sync on asks first and propagates through a cleared marker, latest event wins, exactly as the file rows do.
- Turning the key switch off, directly or because file sync was turned off, removes the key copy from iCloud when iCloud is reachable. A Remove synced keys from iCloud control appears whenever iCloud holds a key copy, on or off, separate from the files' control.
- The received key lands in the same device-local store the user's own entry lands in, through the storage seam and its per-document write chain, and is used by every networked feature immediately, without a relaunch.
- The key record is untrusted on read and on write, with the same validator discipline as the file records: bounded field lengths, a fixed charset for a key value, malformed treated as absent, sanitized before every write, round-trip proven.
- Published statements and documentation updated in the same change: PRIVACY_POLICY.md and website/privacy.html (what is stored, how it is protected, how to remove it, and the sentence that today says keys are never synced), docs/HELP.md (the iCloud Sync section and the API Keys section), README.md and the website feature prose, and a re-read of the App Store privacy label reasoning in appstore/LISTING.md.

## Out of Scope

- Windows, web/Pi and Android: no switch, no copy, no behavior change. The FastAPI backend's keys in backend/.env are untouched.
- Syncing settings, map style, the replay store, or any derived eBird cache (county completeness, hotspot activity, checklist projects, escapee provenance, taxonomy).
- Per-key switches. One switch covers both keys.
- Any encryption layer of SnowRaven's own on top of iCloud (a passphrase, a device-shared secret). The keys travel exactly as the files do, under Apple's protection and the user's own account security.
- Validating a key against eBird or OpenWeather on arrival. A received key is applied as entered, as a typed key is.
- Any SnowRaven server, relay, CloudKit database or non-Apple cloud. A key never leaves the user's own iCloud account.
- Sharing between different people or Apple IDs, including Family Sharing.
- Showing the container in Finder or the Files app (its own roadmap item).
- Any change to how keys are entered, shown, masked or stored on a device today, beyond the change time and origin the sync needs.

## Key Decisions

- A second switch, never folded into the file toggle, off by default on every install. It is a sub-switch of file sync: visible but disabled with a reason until file sync is on, and it goes off when file sync goes off. Why: the roadmap commitment, and the honest model that a secret leaves the device only by its own explicit act.
- One switch for both keys. Why: the app holds exactly two keys of the same kind, obtained the same way and used together; nobody wants one everywhere and the other nowhere, and a second switch would double the note and the states for a decision no one makes.
- Latest change wins, per key, with the existing origin-id tiebreaker; a set and a clear are both changes. Why: the same rule the user already learned for files, and a key is a single value with nothing to merge.
- Keys gain a device-local change time from this version, and an untimed key counts as older than any synced key. Why: today's keys carry no timestamp, so without a rule the first two devices to enable would race; this makes the first device to turn key sync on the seed and lets a later device win only by actually pressing Update.
- Clear with key sync on propagates and asks first. Why: the user's control over a secret must be complete from any device, and a Clear the user believes removed a key everywhere must not leave it live on two devices. The confirmation names the reach, as the file Clear does.
- Turning the key switch off removes the copy from iCloud; turning the file switch off does the same by turning the key switch off; a separate Remove synced keys from iCloud control covers a copy left behind by an offline turn-off or put back by a device still sharing. Why: for a file, leaving the copy in iCloud serves the other devices; for a secret, the copy is the thing the user wants to be sure about, another sharing device restores it in seconds, and Remove synced files stays about files.
- The ubiquity container, the same one the files use, not NSUbiquitousKeyValueStore. Why: it is already provisioned on both App IDs, gives the same coordinated atomic write, offline queueing, change query, validator and Remove path, and keeps the user's mental model to one place in one account; the key-value store would be a second native path with its own availability rules and its own last-writer semantics without the origin the rows show. The Architect finalizes.
- The published statements say exactly what iCloud provides: encrypted in transit and at rest by Apple, in the user's own account, invisible to the developer, and end-to-end encrypted only when the user has Advanced Data Protection on. Why: the founding privacy guarantee is honest disclosure, not a claim; over-stating the protection of a secret would be the one way to break it.
- A key value never appears anywhere but its slot: not in record names, states, errors, logs or copy. Why: the record is untrusted and inspected on both sides, and the diagnostics around it must stay safe to show and to quote.
- Alignment with the founding brief, stated plainly: this stays device-to-provider with no developer server and the user's own keys, and it makes "entered once" true across Apple devices. The one tension is that a secret now leaves the device, for the user's own iCloud account, under Apple's protection rather than the device's. That is acceptable because it is a second explicit opt-in that says exactly what leaves, where it goes and how to take it back, and because the guarantee the product actually makes is that the developer collects nothing and runs no server, which holds unchanged.
