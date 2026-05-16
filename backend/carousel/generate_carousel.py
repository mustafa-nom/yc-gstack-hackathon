#!/usr/bin/env python3
"""
End-to-end TikTok carousel generator.

Orchestrates: generate_content.py → generate_images.py → composite.py

Usage:
    python generate_carousel.py [--persona persona.yaml] [--count 3]
                                [--output-dir ./output] [--skip-images] [topics...]
"""

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml


def run(cmd: list, label: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"\nError: {label} failed (exit {result.returncode})", file=sys.stderr)
        sys.exit(result.returncode)


def main():
    parser = argparse.ArgumentParser(description="Generate TikTok carousel posts end-to-end")
    parser.add_argument("--persona", default="persona.yaml", help="Path to persona.yaml")
    parser.add_argument("--persona-json", help="Persona as a JSON string (overrides --persona file)")
    parser.add_argument("--count", "-n", type=int, help="Number of topics")
    parser.add_argument("--output-dir", "-o", default="output", help="Root output directory")
    parser.add_argument("--skip-images", action="store_true", help="Skip image generation (reuse existing)")
    parser.add_argument("--html", action="store_true", help="Use HTML/CSS compositor (pill-box style) instead of Pillow")
    parser.add_argument("--reference", metavar="URL", action="append", dest="references",
                        help="TikTok post URL to use as style reference (repeat for multiple)")
    parser.add_argument("--account", metavar="URL", help="TikTok account URL — scrape top posts as reference")
    parser.add_argument("--top", type=int, default=7, help="Number of top posts to scrape from --account (default: 7)")
    parser.add_argument("topics", nargs="*", help="Optional topic seed words")
    args = parser.parse_args()

    # If a dynamic persona dict was passed as JSON, write it to a temp file
    tmp_persona = None
    if args.persona_json:
        try:
            persona_dict = json.loads(args.persona_json)
            # Merge with base defaults (text_overlay, content settings stay fixed)
            base = yaml.safe_load(Path(args.persona).read_text()) if Path(args.persona).exists() else {}
            base.update(persona_dict)
            tmp_persona = tempfile.NamedTemporaryFile(
                mode="w", suffix=".yaml", delete=False
            )
            yaml.dump(base, tmp_persona)
            tmp_persona.flush()
            args.persona = tmp_persona.name
        except Exception as e:
            print(f"Warning: could not parse --persona-json: {e}", file=sys.stderr)

    out = Path(args.output_dir)
    slide_data = out / "slide_data.json"
    bg_dir = out / "backgrounds"
    final_dir = out / "final"

    # Step 0 (optional): Scrape top posts from account as reference
    reference_urls = list(args.references or [])
    if args.account:
        print(f"\n{'='*60}")
        print(f"  Step 0 — Scraping top {args.top} posts from {args.account}")
        print(f"{'='*60}")
        result = subprocess.run(
            ["python", "scrape_tiktok_account.py", "--url", args.account, "--top", str(args.top)],
            capture_output=True, text=True,
        )
        # stderr has progress info, stdout has the URLs
        if result.stderr:
            print(result.stderr, end="")
        if result.returncode != 0:
            print("Warning: scraper failed — continuing without account reference.", file=sys.stderr)
        else:
            scraped = [u.strip() for u in result.stdout.splitlines() if u.strip().startswith("http")]
            if not scraped:
                print("Warning: no post URLs found — continuing without account reference.", file=sys.stderr)
            else:
                print(f"  Using {len(scraped)} scraped posts as reference.")
                reference_urls = scraped + reference_urls

    # Step 1: Generate content
    content_cmd = ["python", "generate_content.py", "--persona", args.persona, "--output-dir", str(out)]
    if args.count:
        content_cmd += ["--count", str(args.count)]
    for ref_url in reference_urls:
        content_cmd += ["--reference", ref_url]
    content_cmd += args.topics
    run(content_cmd, "Step 1/3 — Generating slide content (Claude)")

    # Step 2: Generate images
    if not args.skip_images:
        images_cmd = [
            "python", "generate_images.py",
            "--data", str(slide_data),
            "--output-dir", str(bg_dir),
        ]
        run(images_cmd, "Step 2/3 — Generating background images (Gemini)")
    else:
        print("\nStep 2/3 — Skipping image generation (--skip-images)")

    # Step 3: Composite
    compositor = "composite_html.py" if args.html else "composite.py"
    compositor_label = "HTML/CSS + Playwright" if args.html else "Pillow"
    composite_cmd = [
        "python", compositor,
        "--data", str(slide_data),
        "--bg-dir", str(bg_dir),
        "--output-dir", str(final_dir),
        "--persona", args.persona,
    ]
    run(composite_cmd, f"Step 3/3 — Compositing text onto images ({compositor_label})")

    # Summary
    final_slides = list(final_dir.rglob("slide_*.png"))
    topics = [d.name for d in final_dir.iterdir() if d.is_dir()] if final_dir.exists() else []

    print(f"\n{'='*60}")
    print(f"  DONE")
    print(f"{'='*60}")
    print(f"  Topics:   {len(topics)}")
    print(f"  Slides:   {len(final_slides)} PNG files")
    print(f"  Output:   {final_dir.resolve()}/")
    print(f"  Captions: {out / 'captions.txt'}")
    print()
    for topic in sorted(topics):
        slides = sorted((final_dir / topic).glob("slide_*.png"))
        print(f"  {topic}/ ({len(slides)} slides)")
    print()

    if tmp_persona:
        Path(tmp_persona.name).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
