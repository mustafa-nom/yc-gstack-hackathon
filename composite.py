#!/usr/bin/env python3
"""
Composite text over background images to produce final carousel slides.

Reads slide_data.json + persona.yaml, opens each background PNG,
draws a semi-transparent overlay + title/body text, saves final PNGs.

Usage:
    python composite.py [--data output/slide_data.json] [--bg-dir output/backgrounds]
                        [--output-dir output/final] [--persona persona.yaml]
"""

import argparse
import json
import os
import sys
import textwrap
from pathlib import Path
from typing import Optional

import yaml
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFilter, ImageFont

load_dotenv()

FONT_PATHS = [
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def find_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for path in FONT_PATHS:
        if os.path.exists(path):
            try:
                # TTC files may have multiple faces; index 0 = regular, 1 = bold (for HelveticaNeue)
                index = 1 if bold and path.endswith(".ttc") else 0
                return ImageFont.truetype(path, size, index=index)
            except Exception:
                continue
    return ImageFont.load_default()


def hex_to_rgba(hex_color: str, alpha: int = 255) -> tuple:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (r, g, b, alpha)


def draw_text_with_shadow(
    draw: ImageDraw.Draw,
    xy: tuple,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple,
    shadow_offset: int = 3,
) -> None:
    x, y = xy
    shadow_color = (0, 0, 0, 180)
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=shadow_color)
    draw.text((x, y), text, font=font, fill=fill)


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines = []
    current = []
    for word in words:
        test = " ".join(current + [word])
        bbox = font.getbbox(test)
        if bbox[2] - bbox[0] <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines or [""]


def line_height(font: ImageFont.FreeTypeFont) -> int:
    bbox = font.getbbox("Ag")
    return (bbox[3] - bbox[1]) + 8  # add 8px leading


def composite_slide(
    bg_path: Optional[Path],
    title: str,
    body: str,
    config: dict,
    out_path: Path,
    img: Optional[Image.Image] = None,
) -> None:
    overlay_cfg = config["text_overlay"]
    padding = overlay_cfg.get("padding", 60)
    text_color = hex_to_rgba(overlay_cfg["text_color"])
    overlay_alpha = int(overlay_cfg["overlay_opacity"] * 255)
    position = overlay_cfg.get("overlay_position", "bottom")
    use_shadow = overlay_cfg.get("text_shadow", True)

    title_font = find_font(overlay_cfg["font_size_title"], bold=True)
    body_font = find_font(overlay_cfg["font_size_body"], bold=False)

    if img is None:
        img = Image.open(bg_path).convert("RGBA")
    W, H = img.size
    max_text_w = W - padding * 2

    title_lines = wrap_text(title, title_font, max_text_w)
    body_lines = wrap_text(body, body_font, max_text_w) if body else []

    title_lh = line_height(title_font)
    body_lh = line_height(body_font)
    block_h = len(title_lines) * title_lh + (len(body_lines) * body_lh if body_lines else 0) + 20

    # Determine vertical region for the overlay
    overlay_margin = 40
    if position == "bottom":
        overlay_top = H - block_h - padding * 2 - overlay_margin
        overlay_bottom = H - overlay_margin
    elif position == "top":
        overlay_top = overlay_margin
        overlay_bottom = overlay_margin + block_h + padding * 2
    else:  # center
        mid = H // 2
        overlay_top = mid - block_h // 2 - padding
        overlay_bottom = mid + block_h // 2 + padding

    # Draw dark overlay band
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle(
        [(0, overlay_top), (W, overlay_bottom)],
        fill=(0, 0, 0, overlay_alpha),
    )
    img = Image.alpha_composite(img, overlay)

    draw = ImageDraw.Draw(img)

    # Draw title
    y = overlay_top + padding
    for line in title_lines:
        bbox = title_font.getbbox(line)
        x = (W - (bbox[2] - bbox[0])) // 2  # centered
        if use_shadow:
            draw_text_with_shadow(draw, (x, y), line, title_font, text_color)
        else:
            draw.text((x, y), line, font=title_font, fill=text_color)
        y += title_lh

    # Draw body with a small gap after title
    if body_lines:
        y += 12
        for line in body_lines:
            bbox = body_font.getbbox(line)
            x = (W - (bbox[2] - bbox[0])) // 2
            if use_shadow:
                draw_text_with_shadow(draw, (x, y), line, body_font, text_color)
            else:
                draw.text((x, y), line, font=body_font, fill=text_color)
            y += body_lh

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out_path, "PNG", optimize=True)


def main():
    parser = argparse.ArgumentParser(description="Composite text over backgrounds")
    parser.add_argument("--data", default="output/slide_data.json", help="Path to slide_data.json")
    parser.add_argument("--bg-dir", default="output/backgrounds", help="Background images directory")
    parser.add_argument("--output-dir", "-o", default="output/final", help="Output directory")
    parser.add_argument("--persona", default="persona.yaml", help="Path to persona.yaml")
    parser.add_argument("--topics", help="Comma-separated slugs to process (default: all)")
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"Error: {data_path} not found.", file=sys.stderr)
        sys.exit(1)

    persona_path = Path(args.persona)
    if not persona_path.exists():
        print(f"Error: {persona_path} not found.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(data_path.read_text())
    persona = yaml.safe_load(persona_path.read_text())
    topics = data["topics"]

    filter_slugs = set(args.topics.split(",")) if args.topics else None
    if filter_slugs:
        topics = [t for t in topics if t["slug"] in filter_slugs]

    bg_dir = Path(args.bg_dir)
    out_dir = Path(args.output_dir)

    total = 0
    done = 0

    for topic in topics:
        slug = topic["slug"]
        print(f"  [{slug}] compositing {len(topic['slides'])} slides...")

        def make_placeholder(size=(1080, 1920)) -> Image.Image:
            placeholder = Image.new("RGBA", size, (30, 30, 40, 255))
            return placeholder

        def open_or_placeholder(path: Path) -> Image.Image:
            if path.exists():
                return Image.open(path).convert("RGBA")
            return make_placeholder()

        # Slide 1 = title slide (title_slide text, no body)
        title_bg = bg_dir / slug / "slide_01.png"
        out_path = out_dir / slug / "slide_01.png"
        img = open_or_placeholder(title_bg)
        label = "✓" if title_bg.exists() else "✓ (placeholder bg)"
        composite_slide(title_bg if title_bg.exists() else None, topic["title_slide"], "", persona, out_path, img)
        print(f"    slide_01.png (title) {label}")
        done += 1
        total += 1

        # Slides 2..N = content slides
        for i, slide in enumerate(topic["slides"], start=2):
            bg_path = bg_dir / slug / f"slide_{i:02d}.png"
            out_path = out_dir / slug / f"slide_{i:02d}.png"
            total += 1
            img = open_or_placeholder(bg_path)
            label = "✓" if bg_path.exists() else "✓ (placeholder bg)"
            composite_slide(bg_path if bg_path.exists() else None, slide["title"], slide["body"], persona, out_path, img)
            print(f"    slide_{i:02d}.png {label}")
            done += 1

    print(f"\nDone. {done}/{total} slides composited → {out_dir.resolve()}")
    if done < total:
        sys.exit(1)


if __name__ == "__main__":
    main()
