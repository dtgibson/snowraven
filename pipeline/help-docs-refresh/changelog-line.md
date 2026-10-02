# Owed CHANGELOG line (help-docs-refresh)

Not written to `CHANGELOG.md`: no version bump in this run. It belongs under `### Changed` in the
entry for whichever release carries this change (the pending Spool bundle, by the change brief's
recommendation). The release decision is made at the deploy gate.

```markdown
### Changed
- **The in-app Help is brought up to date.** Its tab sections now run in the same order as the app's own tabs, and it covers what has shipped since it was last read whole: the iPhone and iPad apps wherever it lists where SnowRaven runs or where your files and keys are kept, the welcome screen and where Help itself opens, Settings' Help & Documentation section, Show non-bird on Multimedia, the Target Species picker and Filter by Type chips on Media Targets, the Alerts inbox in Search, and Plan filling in your location. It corrects several labels and descriptions that had drifted: the Find Hotspots button, Multimedia's Show subspecies switch (off by default), Install update and restart (the app restarts by itself), Rebuild caches on iPhone and iPad, the Targets tab's default sort, and where a bar-chart file is kept on a web or Raspberry Pi install. The same text is the online documentation linked from the website.
```

If the release also carries the held patch (`held-patch.md`), add under `### Internal` or
`### Changed` as the bundle's other entries do:

```markdown
- The privacy policy and its web page now mention Copy iCloud details and the Weather tab's Plan form reading your location, and say that, with iCloud Sync on, the Targets tab's day-by-day answers are copied to your own iCloud account; the accessibility statement names the iPhone and iPad apps in its opening, updates its Calendar example, and no longer counts the tabs that announce a load failure.
```
