#!/usr/bin/env python3
"""
Composite text over background images to produce final carousel slides.

Slide 1 (title): text in lower portion of image, dark gradient behind it, no box.
Slides 2+: text directly on (dark) background, numbered bold title + body, no box.

Usage:
    python composite.py [--data output/slide_data.json] [--bg-dir output/backgrounds]
                        [--output-dir output/final] [--persona persona.yaml]
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional

import yaml
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont

load_dotenv()

FONT_PATHS_BLACK = [
    "/Library/Fonts/SF-Pro-Display-Black.otf",
    "/System/Library/Fonts/Supplemental/Impact.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
]
FONT_PATHS_REGULAR = [
    "/Library/Fonts/SF-Pro-Display-Bold.otf",
    "/Library/Fonts/SF-Pro-Text-Heavy.otf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
]


def find_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    paths = FONT_PATHS_BLACK if bold else FONT_PATHS_REGULAR
    for path in paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size, index=0)
            except Exception:
                continue
    return ImageFont.load_default()


def hex_to_rgba(hex_color: str, alpha: int = 255) -> tuple:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (r, g, b, alpha)


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list:
    words = text.split()
    lines, current = [], []
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


def line_height(font: ImageFont.FreeTypeFont, leading: int = 8) -> int:
    bbox = font.getbbox("Ag")
    return (bbox[3] - bbox[1]) + leading


def draw_outlined_text(draw, xy, text, font, fill, stroke_width=4):
    x, y = xy
    draw.text((x, y), text, font=font, fill=fill,
              stroke_width=stroke_width, stroke_fill=(0, 0, 0, 255))


def draw_centered_text(draw, W, y, text, font, fill, stroke_width=4):
    bbox = font.getbbox(text)
    x = (W - (bbox[2] - bbox[0])) // 2
    draw_outlined_text(draw, (x, y), text, font, fill, stroke_width)


def add_gradient_overlay(img: Image.Image, start_y_frac: float, opacity: float) -> Image.Image:
    """Add a vertical gradient from transparent to dark, starting at start_y_frac."""
    W, H = img.size
    start_y = int(H * start_y_frac)
    gradient = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(gradient)
    max_alpha = int(opacity * 255)
    for y in range(start_y, H):
        progress = (y - start_y) / max(H - start_y, 1)
        alpha = int(max_alpha * progress)
        draw.line([(0, y), (W, y)], fill=(0, 0, 0, alpha))
    return Image.alpha_composite(img, gradient)


def add_dark_overlay(img: Image.Image, opacity: float) -> Image.Image:
    """Darken the entire image uniformly — helps text legibility on lighter bgs."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, int(opacity * 255)))
    return Image.alpha_composite(img, overlay)


# ---------------------------------------------------------------------------
# Slide 1 — title slide: gradient at bottom, text in lower area
# ---------------------------------------------------------------------------

def composite_title_slide(img, title, subtitle, config, out_path):
    overlay_cfg = config["text_overlay"]
    W, H = img.size
    margin = overlay_cfg.get("slide_margin", 44)
    text_color = hex_to_rgba(overlay_cfg["text_color"])

    title_font = find_font(overlay_cfg["font_size_title"], bold=True)
    sub_font = find_font(overlay_cfg.get("font_size_subtitle", 38), bold=False)

    img_rgba = img.convert("RGBA")
    # Dark gradient from 45% down so text in lower half is readable
    img_rgba = add_gradient_overlay(img_rgba, start_y_frac=0.45, opacity=0.85)

    draw = ImageDraw.Draw(img_rgba)
    max_w = W - margin * 2

    title_lines = wrap_text(title, title_font, max_w)
    sub_lines = wrap_text(subtitle, sub_font, max_w) if subtitle else []

    title_lh = line_height(title_font, leading=10)
    sub_lh = line_height(sub_font, leading=8)

    total_h = len(title_lines) * title_lh
    if sub_lines:
        total_h += 16 + len(sub_lines) * sub_lh

    # Bottom-anchor: text block ends ~10% from bottom
    y = H - int(H * 0.10) - total_h

    for line in title_lines:
        draw_centered_text(draw, W, y, line, title_font, text_color, stroke_width=5)
        y += title_lh

    if sub_lines:
        y += 16
        for line in sub_lines:
            draw_centered_text(draw, W, y, line, sub_font, text_color, stroke_width=3)
            y += sub_lh

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img_rgba.convert("RGB").save(out_path, "PNG", optimize=True)


# ---------------------------------------------------------------------------
# Slides 2+ — content slides: no box, text at top on dark background
# ---------------------------------------------------------------------------

def composite_content_slide(img, slide_num, title, body, config, out_path):
    overlay_cfg = config["text_overlay"]
    W, H = img.size
    margin = overlay_cfg.get("slide_margin", 44)
    text_color = hex_to_rgba(overlay_cfg["text_color"])

    title_font = find_font(overlay_cfg["font_size_title"], bold=True)
    body_font = find_font(overlay_cfg["font_size_body"], bold=False)

    img_rgba = img.convert("RGBA")
    # Slight overall darkening so white text reads on any gym bg
    img_rgba = add_dark_overlay(img_rgba, opacity=0.35)

    draw = ImageDraw.Draw(img_rgba)
    max_w = W - margin * 2

    numbered_title = f"{slide_num}. {title.upper()}"
    title_lines = wrap_text(numbered_title, title_font, max_w)
    body_lines = wrap_text(body, body_font, max_w) if body else []

    title_lh = line_height(title_font, leading=12)
    body_lh = line_height(body_font, leading=10)

    total_h = len(title_lines) * title_lh
    if body_lines:
        total_h += 24 + len(body_lines) * body_lh

    # Center the text block vertically (slightly above center)
    y = int(H * 0.35) - total_h // 2

    for line in title_lines:
        draw_centered_text(draw, W, y, line, title_font, text_color, stroke_width=5)
        y += title_lh

    if body_lines:
        y += 24
        for line in body_lines:
            draw_centered_text(draw, W, y, line, body_font, text_color, stroke_width=3)
            y += body_lh

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img_rgba.convert("RGB").save(out_path, "PNG", optimize=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def open_or_placeholder(path: Optional[Path], size=(1080, 1920)) -> Image.Image:
    if path and path.exists():
        return Image.open(path).convert("RGBA")
    return Image.new("RGBA", size, (18, 18, 22, 255))


def main():
    parser = argparse.ArgumentParser(description="Composite text over backgrounds")
    parser.add_argument("--data", default="output/slide_data.json")
    parser.add_argument("--bg-dir", default="output/backgrounds")
    parser.add_argument("--output-dir", "-o", default="output/final")
    parser.add_argument("--persona", default="persona.yaml")
    parser.add_argument("--topics", help="Comma-separated slugs (default: all)")
    args = parser.parse_args()

    data_path = Path(args.data)
    persona_path = Path(args.persona)

    if not data_path.exists():
        print(f"Error: {data_path} not found.", file=sys.stderr)
        sys.exit(1)
    if not persona_path.exists():
        print(f"Error: {persona_path} not found.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(data_path.read_text())
    persona = yaml.safe_load(persona_path.read_text())
    topics = data["topics"]

    if args.topics:
        filter_slugs = set(args.topics.split(","))
        topics = [t for t in topics if t["slug"] in filter_slugs]

    bg_dir = Path(args.bg_dir)
    out_dir = Path(args.output_dir)
    total, done = 0, 0

    for topic in topics:
        slug = topic["slug"]
        slides = topic["slides"]
        print(f"  [{slug}] {len(slides) + 1} slides")

        total += 1
        bg = bg_dir / slug / "slide_01.png"
        out = out_dir / slug / "slide_01.png"
        img = open_or_placeholder(bg if bg.exists() else None)
        composite_title_slide(img, topic["title_slide"], topic.get("subtitle", ""), persona, out)
        print(f"    slide_01 (title) {'✓' if bg.exists() else '✓ (placeholder bg)'}")
        done += 1

        for i, slide in enumerate(slides, start=1):
            total += 1
            bg = bg_dir / slug / f"slide_{i+1:02d}.png"
            out = out_dir / slug / f"slide_{i+1:02d}.png"
            img = open_or_placeholder(bg if bg.exists() else None)
            composite_content_slide(img, i, slide["title"], slide["body"], persona, out)
            print(f"    slide_{i+1:02d} (#{i}: {slide['title'][:30]}) {'✓' if bg.exists() else '✓ (placeholder bg)'}")
            done += 1

    print(f"\nDone. {done}/{total} slides → {out_dir.resolve()}")
    if done < total:
        sys.exit(1)


if __name__ == "__main__":
    main()
