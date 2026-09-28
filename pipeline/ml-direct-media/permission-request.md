# Draft Permission Request to the Macaulay Library

**Status:** Draft for the user's review. Do not send or submit without the user's explicit authorization.

**Subject:** Permission guidance for displaying a contributor's own Macaulay Library media in SnowRaven

Hello Macaulay Library team,

I maintain SnowRaven, a free, local-first birding app that helps people explore their own eBird and Macaulay Library exports. The app currently links to Macaulay Library specimen pages and uses your supplied embed player when available. I understand that contributors can download their own originals through the **Download original** link on each specimen page.

I am considering an optional, off-by-default feature that would show a contributor's own photos, audio, and video within their personal life list. Before building it, I would appreciate your guidance:

- Do you permit an app to request a user's own media directly from the Macaulay Library CDN, without going through the specimen page or embed player? Does your answer differ for original files and derivative sizes or formats, or for inline display and file download?
- An ML export supplies catalog numbers but does not prove ownership. What method, if any, would you accept for verifying that the user owns each asset? Is there an approved authenticated URL or API instead of constructing CDN URLs?
- Which URL or API path should an app use, and what attribution, link back to the specimen, request-rate or volume limits, and local caching rules would apply?
- Your site uses a bot-protection check that embedded players cannot always pass in an app. How can SnowRaven provide this feature without bypassing protection you intend to enforce? If direct access is not appropriate, is there another approved way to show a contributor's own media locally?

We will leave direct CDN access unimplemented unless you confirm an appropriate route and its conditions. Thank you for the archive and for any guidance you can share.

Best,

SnowRaven maintainer
