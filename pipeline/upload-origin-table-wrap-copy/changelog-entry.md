# Proposed CHANGELOG entry (upload-origin-table-wrap-copy)

Written by The Engineer; NOT yet in `CHANGELOG.md`. This fix ships as 1.0.48
after 1.0.47 has shipped on every leg. The Deployer bumps the version, then
pastes the entry below under the new version heading with that day's date.
American spelling, no em dashes.

```markdown
### Fixed
- **On a web or Raspberry Pi install, only SnowRaven's own page can change what the server stores.** A page on another site could make your browser replace your eBird backup, your Macaulay Library export, a county's bar-chart file or a saved setting on a SnowRaven server you can reach. The server now refuses any such change that a browser sends from another site, and every page and answer it serves tells the browser not to show it inside another site's frame. The Mac, Windows, iPhone and iPad apps never use the server and are unaffected. After updating a web or Pi install, reload any SnowRaven tab that was already open, or its saves will be refused.
- On the Targets tab at phone widths and large text sizes, a long scientific name such as *Xanthocephalus xanthocephalus* no longer makes the table scroll sideways. The common and scientific names now wrap onto further lines inside the row, and are shown in full rather than cut short.
- Settings' Appearance section now says where your color scheme is really saved: in the app's settings on this device in the Mac, Windows, iPhone and iPad apps, and on the server, for every browser that opens it, on a web or Raspberry Pi install. It used to say "this browser's local storage", which was not true anywhere.
- On a web or Raspberry Pi install, Settings' Bar-chart files section now says the files are saved on "this server", which is where they are kept, instead of "this device".

### Internal
- The web/Pi backend's generic settings store now accepts a value only when it is sent as JSON, which is what the app always sends.
```
