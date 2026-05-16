#!/usr/bin/env python3
"""
Composite text over background images to produce final carousel slides.

Slide 1 (title): text directly on image, no box, centered, upper area.
Slides 2+ (content): dark rounded-rectangle box in upper area,
                     numbered title (bold) + multi-sentence paragraph body.

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
                index = 1 if bold and path.endswith(".ttc") else 0
                return ImageFont.truetype(path, size, index=index)
            except Exception:
                continue
    return ImageFont.load_default()


def hex_to_rgba(hex_color: str, alpha: int = 255) -> tuple:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (r, g, b, alpha)


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list:
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


def line_height(font: ImageFont.FreeTypeFont, leading: int = 10) -> int:
    bbox = font.getbbox("Ag")
    return (bbox[3] - bbox[1]) + leading


def draw_text_shadow(draw, xy, text, font, fill, offset=3):
    x, y = xy
    draw.text((x + offset, y + offset), text, font=font, fill=(0, 0, 0, 160))
    draw.text((x, y), text, font=font, fill=fill)


# ---------------------------------------------------------------------------
# Slide 1 — title slide: no box, text directly on image
# ---------------------------------------------------------------------------

def composite_title_slide(
    img: Image.Image,
    title: str,
    subtitle: str,
    config: dict,
    out_path: Path,
) -> None:
    overlay_cfg = config["text_overlay"]
    W, H = img.size
    padding = overlay_cfg.get("padding", 60)
    text_color = hex_to_rgba(overlay_cfg["text_color"])

    title_font = find_font(overlay_cfg["font_size_title"], bold=False)
    sub_font = find_font(overlay_cfg.get("font_size_subtitle", 36), bold=False)

    img_rgba = img.convert("RGBA")
    draw = ImageDraw.Draw(img_rgba)

    max_w = W - padding * 2
    title_lines = wrap_text(title, title_font, max_w)
    sub_lines = wrap_text(subtitle, sub_font, max_w) if subtitle else []

    title_lh = line_height(title_font, leading=12)
    sub_lh = line_height(sub_font, leading=8)

    # Position: start at 20% from top
    y = int(H * 0.20)

    for line in title_lines:
        # Centered
        bbox = title_font.getbbox(line)
        x = (W - (bbox[2] - bbox[0])) // 2
        draw_text_shadow(draw, (x, y), line, title_font, text_color, offset=3)
        y += title_lh

    if sub_lines:
        y += 18
        for line in sub_lines:
            bbox = sub_font.getbbox(line)
            x = (W - (bbox[2] - bbox[0])) // 2
            draw_text_shadow(draw, (x, y), line, sub_font, text_color, offset=2)
            y += sub_lh

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img_rgba.convert("RGB").save(out_path, "PNG", optimize=True)


# ---------------------------------------------------------------------------
# Slides 2+ — content slides: rounded dark box + numbered title + paragraph
# ---------------------------------------------------------------------------

def composite_content_slide(
    img: Image.Image,
    slide_num: int,
    title: str,
    body: str,
    config: dict,
    out_path: Path,
) -> None:
    overlay_cfg = config["text_overlay"]
    W, H = img.size
    slide_margin = overlay_cfg.get("slide_margin", 48)
    box_padding = overlay_cfg.get("box_padding", 28)
    overlay_alpha = int(overlay_cfg["overlay_opacity"] * 255)
    text_color = hex_to_rgba(overlay_cfg["text_color"])

    title_font = find_font(overlay_cfg["font_size_title"], bold=True)
    body_font = find_font(overlay_cfg["font_size_body"], bold=False)

    img_rgba = img.convert("RGBA")

    # Text area width inside the box
    box_left = slide_margin
    box_right = W - slide_margin
    max_text_w = (box_right - box_left) - box_padding * 2

    numbered_title = f"{slide_num}. {title}"
    title_lines = wrap_text(numbered_title, title_font, max_text_w)
    body_lines = wrap_text(body, body_font, max_text_w) if body else []

    title_lh = line_height(title_font, leading=10)
    body_lh = line_height(body_font, leading=8)

    content_h = len(title_lines) * title_lh
    if body_lines:
        content_h += 20 + len(body_lines) * body_lh  # 20px gap between title and body

    box_h = content_h + box_padding * 2
    box_top = int(H * 0.05)
    box_bottom = box_top + box_h

    # Draw rounded dark box
    overlay = Image.new("RGBA", img_rgba.size, (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.rounded_rectangle(
        [(box_left, box_top), (box_right, box_bottom)],
        radius=18,
        fill=(0, 0, 0, overlay_alpha),
    )
    img_rgba = Image.alpha_composite(img_rgba, overlay)
    draw = ImageDraw.Draw(img_rgba)

    # Draw title (left-aligned inside box)
    y = box_top + box_padding
    x = box_left + box_padding
    for line in title_lines:
        draw_text_shadow(draw, (x, y), line, title_font, text_color, offset=2)
        y += title_lh

    # Draw body paragraph
    if body_lines:
        y += 20
        for line in body_lines:
            draw_text_shadow(draw, (x, y), line, body_font, text_color, offset=1)
            y += body_lh

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img_rgba.convert("RGB").save(out_path, "PNG", optimize=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def open_or_placeholder(path: Optional[Path], size=(1080, 1920)) -> Image.Image:
    if path and path.exists():
        return Image.open(path).convert("RGBA")
    # Dark neutral placeholder
    return Image.new("RGBA", size, (28, 28, 35, 255))


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
        print(f"  [{slug}] {len(slides) + 1} slides (1 title + {len(slides)} content)")

        # --- Slide 1: title slide ---
        total += 1
        bg = bg_dir / slug / "slide_01.png"
        out = out_dir / slug / "slide_01.png"
        img = open_or_placeholder(bg if bg.exists() else None)
        subtitle = topic.get("subtitle", "")
        composite_title_slide(img, topic["title_slide"], subtitle, persona, out)
        label = "✓" if bg.exists() else "✓ (placeholder bg)"
        print(f"    slide_01 (title) {label}")
        done += 1

        # --- Slides 2+: content slides ---
        for i, slide in enumerate(slides, start=1):
            total += 1
            bg = bg_dir / slug / f"slide_{i+1:02d}.png"
            out = out_dir / slug / f"slide_{i+1:02d}.png"
            img = open_or_placeholder(bg if bg.exists() else None)
            composite_content_slide(img, i, slide["title"], slide["body"], persona, out)
            label = "✓" if bg.exists() else "✓ (placeholder bg)"
            print(f"    slide_{i+1:02d} (#{i}: {slide['title'][:30]}) {label}")
            done += 1

    print(f"\nDone. {done}/{total} slides → {out_dir.resolve()}")
    if done < total:
        sys.exit(1)


if __name__ == "__main__":
    main()
