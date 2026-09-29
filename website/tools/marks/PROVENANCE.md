# Where these two icons came from

These are the Cornell Lab of Ornithology's marks for eBird and Birds of the
World. They are here for one purpose: so the screenshot capture scripts beside
this folder (`capture.mjs`, `capture-appstore.mjs`, through `loadSiteMarks` in
`capture-lib.mjs`) can render SnowRaven's own UI faithfully, with the two marks
an online user sees beside every species name. They are not part of the app,
are not bundled into any build, and are used for nothing else.

The capture scripts never request either icon. eBird's bot filter refuses
headless browsers on purpose, and the scripts do not disguise themselves to
get past it; they serve these copies instead.

## The files

| File | Requested | Answer |
|---|---|---|
| `ebird-favicon.ico` | `https://ebird.org/favicon.ico` | `302` to `https://is-ebird-web-static-content-prod.s3.amazonaws.com/content/releases/20260923_152816/eBirdCommon/lib/images/favicons/ebird/favicon.ico`, which returned 1,166 bytes as `image/vnd.microsoft.icon` (`Last-Modified: Wed, 23 Sep 2026 15:28:35 GMT`). The bytes are a 48x48 PNG. SHA-256 `cf869d60af8a8822b05bd092eb35dd8d05aa400fa14ed2015ce71f6235c8e064`. |
| `birdsoftheworld-favicon.ico` | `https://birdsoftheworld.org/favicon.ico` | `200`, 15,086 bytes as `image/x-icon` (`Last-Modified: Wed, 16 Sep 2026 17:13:14 GMT`). An ICO holding 48, 32 and 16 px images. SHA-256 `3267ad4796dba86c613cf365c4e4962ebb0dd67d627b459d7d461c10936d85a7`. |

Both were fetched on 2026-09-28 (22:58 PDT, 2026-09-29 05:58 UTC) with a
plain `curl -L` request carrying curl 8.7.1's default user agent
(`curl/8.7.1`) and no other headers: a request that identified itself
truthfully, never a browser-imitating user agent. eBird answered it with its
icon.

## The decision

The user decided on 2026-09-28 to keep these copies in the repository rather
than out of git, obtained only by an honest request as above
(`pipeline/screenshot-tool-ebird-icon/decisions.md`).

To refresh them, repeat the same kind of request, check the answer is an image
rather than a refusal page (`loadSiteMarks` refuses an HTML page in either
file), and update this note. If either site refuses an honest request, stop
there rather than working around it.
