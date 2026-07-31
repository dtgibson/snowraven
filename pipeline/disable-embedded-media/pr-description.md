## Disable Embedded Media

### What this does
Adds an off-by-default Settings preference that prevents Macaulay Library embed iframes from mounting in Species Detail and Named Birds. Disabled player areas show one consistent note while local metadata, checklist links, direct media links, counts, comments, and analytics remain available.

The preference hydrates through SnowRaven's existing storage seam with iframe eligibility closed until the read completes. Changes apply immediately, persist across launches, and roll back visibly if a save fails.

### How to test
1. Start SnowRaven and load an eBird backup plus a Macaulay Library export containing media.
2. Confirm Species Detail Recent Media and an expanded Named Birds row show their normal embedded players while the new setting is off.
3. Turn on Settings → Disable embedded media.
4. Confirm both open surfaces immediately remove every iframe and show “Embedded media is disabled in Settings.” while their dates, checklist links, and direct Macaulay Library links remain.
5. Relaunch SnowRaven and confirm the disabled state appears without a player flash or embed request.
6. Turn the setting off and confirm the existing lazy, resilient players return without a reload.

### Notes for reviewer
`MediaFrame` remains the only iframe constructor and now requires an explicit eligibility gate. The web storage adapter also rejects non-successful settings responses so the controlled preference can restore its last durable value. No backend schema, provider, account, proxy, or media caching path was added.
