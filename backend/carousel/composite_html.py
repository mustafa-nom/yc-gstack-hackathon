#!/usr/bin/env python3
"""
Composite text over background images using HTML/CSS + headless browser.

Produces pill-box style slides matching the chey.jada TikTok aesthetic:
  - Slide 1: bold text directly on photo (no boxes)
  - Slides 2+: dark semi-transparent rounded pill boxes over photo

Drop-in replacement for composite.py — same CLI interface, better output.

Usage:
    python composite_html.py [--data output/slide_data.json]
                             [--bg-dir output/backgrounds]
                             [--output-dir output/final]
                             [--persona persona.yaml]
                             [--topics slug1,slug2]
                             [--scale 2]
"""

import argparse
import base64
import html as html_lib
import json
import sys
import tempfile
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()

SLIDE_W = 390
SLIDE_H = 692

CSS = """
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: %(W)spx;
  height: %(H)spx;
  overflow: hidden;
  font-family: -apple-system, 'Helvetica Neue', 'Inter', Arial, sans-serif;
  background: #111;
}

.slide {
  width: %(W)spx;
  height: %(H)spx;
  position: relative;
  overflow: hidden;
}

.bg {
  position: absolute;
  inset: 0;
  width: 100%%;
  height: 100%%;
  object-fit: cover;
  object-position: center;
}

.scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
}

/* ── Cover slide: text directly on photo ── */
.cover-text {
  position: absolute;
  top: 50%%;
  left: 50%%;
  transform: translate(-50%%, -55%%);
  text-align: center;
  width: 85%%;
  z-index: 2;
}

.cover-text .headline {
  font-size: 36px;
  font-weight: 700;
  color: white;
  line-height: 1.2;
  letter-spacing: -0.5px;
  text-shadow: 0 2px 20px rgba(0,0,0,0.65);
}

.cover-text .subline {
  margin-top: 10px;
  font-size: 15px;
  font-weight: 400;
  color: rgba(255,255,255,0.92);
  text-shadow: 0 1px 8px rgba(0,0,0,0.5);
}

/* ── Content slides: pill boxes ── */
.pills {
  position: absolute;
  top: 40%%;
  left: 50%%;
  transform: translate(-50%%, -50%%);
  width: 88%%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 2;
}

.pill {
  background: rgba(10, 8, 15, 0.72);
  border-radius: 10px;
  padding: 13px 18px;
  text-align: center;
}

.pill-title {
  font-size: 15.5px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.35;
  letter-spacing: -0.1px;
}

.pill-body {
  font-size: 14px;
  font-weight: 400;
  color: #ffffff;
  line-height: 1.5;
}
""" % {"W": SLIDE_W, "H": SLIDE_H}


def e(text: str) -> str:
    """HTML-escape a string."""
    return html_lib.escape(str(text))


def bg_data_uri(bg_path: Optional[Path]) -> str:
    """Convert background image to a base64 data URI so Playwright can load it."""
    if not bg_path or not bg_path.exists():
        return ""
    data = base64.b64encode(bg_path.read_bytes()).decode()
    return f"data:image/png;base64,{data}"


def cover_html(bg_path: Optional[Path], title: str, subtitle: str) -> str:
    uri = bg_data_uri(bg_path)
    bg_tag = f'<img class="bg" src="{uri}" alt="">' if uri else ""
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>{CSS}</style>
</head><body>
<div class="slide">
  {bg_tag}
  <div class="scrim"></div>
  <div class="cover-text">
    <div class="headline">{e(title)}</div>
    <div class="subline">{e(subtitle)}</div>
  </div>
</div>
</body></html>"""


def content_html(bg_path: Optional[Path], slide_num: int, title: str, body: str) -> str:
    uri = bg_data_uri(bg_path)
    bg_tag = f'<img class="bg" src="{uri}" alt="">' if uri else ""
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>{CSS}</style>
</head><body>
<div class="slide">
  {bg_tag}
  <div class="scrim"></div>
  <div class="pills">
    <div class="pill"><div class="pill-title">{slide_num}. {e(title)}</div></div>
    <div class="pill"><div class="pill-body">{e(body)}</div></div>
  </div>
</div>
</body></html>"""


def screenshot_html(page, html_content: str, out_path: Path, scale: int) -> None:
    page.set_content(html_content, wait_until="domcontentloaded")
    page.screenshot(
        path=str(out_path),
        clip={"x": 0, "y": 0, "width": SLIDE_W, "height": SLIDE_H},
    )


def main():
    parser = argparse.ArgumentParser(description="Composite slides via HTML/CSS + Playwright")
    parser.add_argument("--data", default="output/slide_data.json")
    parser.add_argument("--bg-dir", default="output/backgrounds")
    parser.add_argument("--output-dir", "-o", default="output/final")
    parser.add_argument("--persona", default="persona.yaml")
    parser.add_argument("--topics", help="Comma-separated slugs (default: all)")
    parser.add_argument("--scale", type=int, default=2, help="Device scale factor for retina output (default: 2)")
    args = parser.parse_args()

    data_path = Path(args.data)

    if not data_path.exists():
        print(f"Error: {data_path} not found. Run generate_content.py first.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(data_path.read_text())
    topics = data["topics"]

    if args.topics:
        slugs = set(args.topics.split(","))
        topics = [t for t in topics if t["slug"] in slugs]
        if not topics:
            print(f"No topics matched: {args.topics}", file=sys.stderr)
            sys.exit(1)

    bg_dir = Path(args.bg_dir)
    out_dir = Path(args.output_dir)
    total, done = 0, 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": SLIDE_W, "height": SLIDE_H},
            device_scale_factor=args.scale,
        )
        page = ctx.new_page()

        for topic in topics:
            slug = topic["slug"]
            slides = topic["slides"]
            topic_out = out_dir / slug
            topic_out.mkdir(parents=True, exist_ok=True)
            print(f"  [{slug}] {len(slides) + 1} slides")

            # Slide 1 — cover/title
            total += 1
            bg = bg_dir / slug / "slide_01.png"
            out = topic_out / "slide_01.png"
            html = cover_html(bg if bg.exists() else None, topic["title_slide"], topic.get("subtitle", ""))
            screenshot_html(page, html, out, args.scale)
            print(f"    slide_01 (cover) ✓")
            done += 1

            # Slides 2+
            for i, slide in enumerate(slides, start=1):
                total += 1
                bg = bg_dir / slug / f"slide_{i+1:02d}.png"
                out = topic_out / f"slide_{i+1:02d}.png"
                html = content_html(bg if bg.exists() else None, i, slide["title"], slide["body"])
                screenshot_html(page, html, out, args.scale)
                print(f"    slide_{i+1:02d} (#{i}: {slide['title'][:40]}) ✓")
                done += 1

        browser.close()

    print(f"\nDone. {done}/{total} slides → {out_dir.resolve()}")
    if done < total:
        sys.exit(1)


if __name__ == "__main__":
    main()
