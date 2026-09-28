# Launch splash decisions

## Saved SnowRaven green for the launch field

The user asked for the splash to use their saved SnowRaven green, `#2D8653`, exactly. This supersedes the earlier design choice of the darker `#277448` app accent for the launch field. The native storyboard, native window background, pre-React surface, and design preview now use the saved green in both appearances. The white raven and immediate readiness handoff stay as approved; the app-wide `--sr-accent` token is unchanged.

## TestFlight scope and device boundary

On 2026-09-26 the user directed this build to TestFlight only and said Hydra must never be updated. They then clarified the broader boundary: agents must never access, discover, query, pair, install on, or otherwise interact with any physical, production, or personal device, including Hydra and Telesto. Development and QA by agents use only the developer Mac and its local simulators. Do not assume what devices the user has or ask them to connect one. If a physical-device test is genuinely needed, ask the user to perform it and report the result. The earlier proposal to reconnect Telesto or find a non-Hydra QA device is withdrawn. QA-03 in this feature's PRD requires recorded iPhone and iPad cold launches, not physical-device installs; the simulator recordings meet that device-neutral visual criterion. The historical exact-build launch check applies before App Store submission and would be performed by the user after an explicit request. No App Store submission is part of this TestFlight scope.

## Defer remaining breadth checks for this TestFlight build

The user reports that the splash seems to work well on an iPhone. The build number was not specified, so record this as a user observation without attributing it to a particular artifact. The user explicitly deferred **all seven** remaining checks and said SnowRaven usually sticks with automated tests. The still-partial PRD rows cover broader platform, layout, destination, widget, launch-trace, and assistive-technology cases. Leave them Partial and deferred for this TestFlight scope, without further manual testing requests or device activity. Revisit a specific row only if the user requests it or a later release requires it.
