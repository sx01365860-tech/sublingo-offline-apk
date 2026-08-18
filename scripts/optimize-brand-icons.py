from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "images" / "icon.png"
TARGETS = [
    ROOT / "assets" / "images" / "icon.png",
    ROOT / "assets" / "images" / "splash-icon.png",
    ROOT / "assets" / "images" / "favicon.png",
    ROOT / "assets" / "images" / "android-icon-foreground.png",
]


def main() -> None:
    with Image.open(SOURCE) as image:
        optimized = image.convert("RGBA").resize((512, 512), Image.Resampling.LANCZOS)
        for target in TARGETS:
            optimized.save(target, "PNG", optimize=True, compress_level=9)


if __name__ == "__main__":
    main()
