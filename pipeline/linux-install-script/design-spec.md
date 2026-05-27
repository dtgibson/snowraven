# Design Spec — Linux Install Script
**Feature:** linux-install-script
**Session:** 001
**Stage:** 4 — The Designer
**Date:** 2026-05-27

---

## Artifact

`install.sh` is a shell script, not a UI. This design spec documents the **user-facing interaction design** — what the user sees printed to the terminal at each step, not visual component design.

The full interactive mockup is at:
`pipeline/linux-install-script/design.html`

---

## Terminal Interaction Design

### Entry Point

Users run one of:
```
curl -fsSL https://raw.githubusercontent.com/dtgibson/snowraven/main/install.sh | bash
bash install.sh
```

### Banner

On launch, the script prints a branded SnowRaven ASCII banner in `#2D8653` (brand green) followed by the version and a one-line description.

```
███████╗███╗   ██╗ ██████╗ ██╗    ██╗██████╗  █████╗ ██╗   ██╗███████╗███╗   ██╗
██╔════╝████╗  ██║██╔═══██╗██║    ██║██╔══██╗██╔══██╗██║   ██║██╔════╝████╗  ██║
███████╗██╔██╗ ██║██║   ██║██║ █╗ ██║██████╔╝███████║██║   ██║█████╗  ██╔██╗ ██║
╚════██║██║╚██╗██║██║   ██║██║███╗██║██╔══██╗██╔══██║╚██╗ ██╔╝██╔══╝  ██║╚██╗██║
███████║██║ ╚████║╚██████╔╝╚███╔███╔╝██║  ██║██║  ██║ ╚████╔╝ ███████╗██║ ╚████║
╚══════╝╚═╝  ╚═══╝ ╚═════╝  ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝

  Your backyard bird data, on your own server.
  Installer v1.0
```

### Pre-flight Checks

Each check prints inline with a `✓` (green) or `✗` (red) result:

```
Checking system requirements...
  ✓ OS supported: Raspberry Pi OS (Debian GNU/Linux 12)
  ✓ sudo available
```

On failure, the script prints a clear single-line error and exits before modifying anything.

### Mode Prompt

```
How would you like to install SnowRaven?

  1) Service install  — runs automatically on boot (recommended for Pi)
  2) Local install    — set up dependencies; you start it manually

Enter 1 or 2:
```

Invalid input re-prompts once, then exits.

### Directory Prompt

```
Install directory [/home/pi/snowraven]:
```

User presses Enter to accept default or types a path. The chosen path is echoed in subsequent progress messages.

### Progress Steps

Each major step prints a status line before starting:

```
[1/5] Installing system packages (git, python3, node)...
[2/5] Cloning SnowRaven into /home/pi/snowraven...
[3/5] Building frontend (this may take a minute)...
[4/5] Setting up Python environment...
[5/5] Configuring API keys...
```

Progress bars use `████░░░░░░` style with percentage.

### API Key Prompts

```
eBird API key (or press Enter to skip — you can add this later in Settings):

OpenWeather API key (or press Enter to skip — you can add this later in Settings):
```

Skipping either writes a blank value in `.env`. Skipping does not produce a warning.

### Service Install — Systemd Steps (mode 1 only)

After the build, additional output:

```
[+] Installing systemd service...
[+] Enabling snowraven service...
[+] Starting snowraven service...
✓ Service is running
```

If `systemctl start` fails, the last 20 lines of `journalctl -u snowraven` are printed followed by a suggestion to check API keys in Settings.

### Success Box

Rendered as a bordered box in green:

```
╔══════════════════════════════════════════════════════════╗
║           SnowRaven installed successfully!              ║
╠══════════════════════════════════════════════════════════╣
║  Mode: Service install (auto-starts on boot)             ║
║                                                          ║
║  Open SnowRaven in your browser:                         ║
║    → http://raspberrypi.local:1620                       ║
║    → http://192.168.1.42:1620                            ║
║                                                          ║
║  API keys and data files: Settings tab in the app        ║
╚══════════════════════════════════════════════════════════╝
```

For local mode, the box also includes:

```
║  To start SnowRaven:                                     ║
║    cd /home/pi/snowraven && ./start.sh                   ║
```

---

## Error States

### Unsupported OS

```
✗ Unsupported OS: Arch Linux
  This installer requires Debian or Ubuntu (including Raspberry Pi OS).
  No changes were made to your system.
```

### Service Failed to Start

```
✗ Service failed to start. Here are the last 20 lines of the log:

  [journal output...]

  Check your API keys in the Settings tab, then run:
    sudo systemctl start snowraven
```

---

## Design Decisions

- **No flags required** — mode selection is always interactive via the numbered prompt
- **ASCII banner** — establishes the product identity before any work begins; consistent with the brand
- **Numbered steps** — `[1/5]` prefix sets expectations for how long the process takes
- **Both URLs in success box** — `hostname.local` (mDNS) and LAN IP (fallback), per OQ-02
- **Skip-friendly key prompts** — explicit "you can add this later in Settings" inline in the prompt itself, not as a footnote
- **Green success box border** — matches brand green `#2D8653`; no color used for in-progress steps (plain white/gray terminal text)
