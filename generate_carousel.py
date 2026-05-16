#!/usr/bin/env python3
"""
End-to-end TikTok carousel generator.

Orchestrates: generate_content.py → generate_images.py → composite.py

Usage:
    python generate_carousel.py [--persona persona.yaml] [--count 3]
                                [--output-dir ./output] [--skip-images] [topics...]
"""

import argparse
import subprocess
import sys
from pathlib import Path


def run(cmd: list[str], label: str) -> None:
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
    parser.add_argument("--count", "-n", type=int, help="Number of topics")
    parser.add_argument("--output-dir", "-o", default="output", help="Root output directory")
    parser.add_argument("--skip-images", action="store_true", help="Skip image generation (reuse existing)")
    parser.add_argument("topics", nargs="*", help="Optional topic seed words")
    args = parser.parse_args()

    out = Path(args.output_dir)
    slide_data = out / "slide_data.json"
    bg_dir = out / "backgrounds"
    final_dir = out / "final"

    # Step 1: Generate content
    content_cmd = ["python", "generate_content.py", "--persona", args.persona, "--output-dir", str(out)]
    if args.count:
        content_cmd += ["--count", str(args.count)]
    content_cmd += args.topics
    run(content_cmd, "Step 1/3 — Generating slide content (Claude)")

    # Step 2: Generate images
    if not args.skip_images:
        images_cmd = [
            "python", "generate_images.py",
            "--data", str(slide_data),
            "--output-dir", str(bg_dir),
            "--persona", args.persona,
        ]
        run(images_cmd, "Step 2/3 — Generating background images (Gemini)")
    else:
        print("\nStep 2/3 — Skipping image generation (--skip-images)")

    # Step 3: Composite
    composite_cmd = [
        "python", "composite.py",
        "--data", str(slide_data),
        "--bg-dir", str(bg_dir),
        "--output-dir", str(final_dir),
        "--persona", args.persona,
    ]
    run(composite_cmd, "Step 3/3 — Compositing text onto images (Pillow)")

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


if __name__ == "__main__":
    main()
