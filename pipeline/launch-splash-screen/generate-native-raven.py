"""Regenerate the iOS launch image set from SnowRaven's committed glyph master.

Requires rsvg-convert. Run from any directory with:
  python3 pipeline/launch-splash-screen/generate-native-raven.py
"""

from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "frontend/src/assets/snowraven-bird-glyph.svg"
IMAGE_SET = ROOT / "src-tauri/gen/apple/Assets.xcassets/LaunchRaven.imageset"

source = MASTER.read_text()
assert 'color="#2D8653"' in source, "Glyph master color changed; review launch asset"
white = source.replace('color="#2D8653"', 'color="#FFFFFF"', 1)

with tempfile.NamedTemporaryFile(suffix=".svg", mode="w") as asset:
    asset.write(white)
    asset.flush()
    for scale in (1, 2, 3):
        size = 88 * scale
        subprocess.run(
            [
                "rsvg-convert", "-w", str(size), "-h", str(size),
                "-o", str(IMAGE_SET / f"LaunchRaven@{scale}x.png"), asset.name,
            ],
            check=True,
        )
