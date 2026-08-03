## Toggle Box and iOS Ship (v0.5.73)

### What this does
Removes the empty bordered box around the Settings "Disable embedded media"
switch. The shared `ToggleSwitch` always drew a bordered pill-button designed to
carry a visible label; Settings hides that label (the row title is the visible
name), so only the orphan frame remained. `ToggleSwitch` gains an opt-in `bare`
prop — no border/background/frame, a slightly larger 36×20 track with a 16px
knob — and Settings' `EmbeddedMediaRow` is its only consumer. The release also
ships iOS 0.5.73 build 1 to TestFlight, closing the gap left when v0.5.72 went
desktop-only (last TestFlight build was 0.5.71).

### How to test
1. `cd frontend && npm run dev`, open the app, go to Settings → Appearance.
2. The "Disable embedded media" row shows a bare switch (no surrounding box) in
   both themes; clicking it still saves and flips immediately.
3. Tab to the switch: the global green focus ring draws around the pill.
4. Check any other switch (Calendar's spuh toggle, Map Explorer's County lines,
   Checklists' weather/tide toggle): unchanged boxed treatment.
5. `npx vitest run src/components/ui/ToggleSwitch.test.tsx` locks both
   treatments' geometry and the a11y contract.

### Notes for reviewer
- The default (boxed) render path is byte-identical: geometry values are
  computed (`trackW`/`trackH`/`knob`) but resolve to the exact previous numbers
  (28×16 track, 12px knob, left 14 when on; track radius 8 = height/2).
- `bare` adds `.sr-touch-target` so the ≤640 tier reaches the ~44px tap-area
  posture; invisible 7px padding keeps the desktop hit area ≥30px.
- Switch-thumb tokens (`--sr-switch-thumb`, `--sr-switch-thumb-shadow`) and the
  `--sr-gray-400` off-track are reused untouched (the v0.5.68 tokenization
  convention holds).
- design-lint reduced-motion note on `ToggleSwitch.tsx` is justified: the 180ms
  transitions are the pre-existing app-wide switch motion, deliberately kept
  identical; no new motion introduced.
- Version bumped in BOTH `frontend/package.json` and
  `src-tauri/tauri.conf.json`; CHANGELOG and the website version pill/footer are
  in lockstep. `docs/HELP.md` needs no change (it documents behavior, not the
  frame).
