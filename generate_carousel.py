#!/usr/bin/env python3
"""
End-to-end carousel generator (Canva pipeline version).

Runs generate_content.py → generate_images.py, then prints the
canva-pipeline skill invocation for the next step.

Usage:
    python generate_carousel.py [--persona persona.yaml] [--count 3]
                                [--reference URL] [--skip-images] [topics...]
"""

import argparse
import subprocess
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv

load_dotenv()


def run(cmd: list, label: str) -> None:
    print(f"\n{'='*60}\n  {label}\n{'='*60}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"\nError: {label} failed (exit {result.returncode})", file=sys.stderr)
        sys.exit(result.returncode)


def main():
    parser = argparse.ArgumentParser(description="Generate TikTok carousel (Canva pipeline)")
    parser.add_argument("--persona", default="persona.yaml")
    parser.add_argument("--count", "-n", type=int)
    parser.add_argument("--reference", metavar="URL")
    parser.add_argument("--skip-images", action="store_true")
    parser.add_argument("topics", nargs="*")
    args = parser.parse_args()

    persona = yaml.safe_load(Path(args.persona).read_text())
    account_name = persona["account"]["name"]
    canva_url = persona["account"]["canva_template_url"]
    content_dir = Path(f"~/Desktop/{account_name}-content").expanduser()

    # Step 1: Generate content (CSVs)
    content_cmd = ["python", "generate_content.py", "--persona", args.persona]
    if args.count:
        content_cmd += ["--count", str(args.count)]
    if args.reference:
        content_cmd += ["--reference", args.reference]
    content_cmd += args.topics
    run(content_cmd, "Step 1/2 — Generate content (GPT-4o)")

    # Step 2: Generate images
    if not args.skip_images:
        run(["python", "generate_images.py", "--persona", args.persona],
            "Step 2/2 — Generate images (Gemini)")
    else:
        print("\nStep 2/2 — Skipping image generation (--skip-images)")

    # Print handoff instructions for the Canva pipeline skill
    title_bgs = content_dir / "title_bgs"
    content_bgs = content_dir / "content_bgs"

    print(f"\n{'='*60}")
    print("  DONE — run the Canva pipeline skill next:")
    print(f"{'='*60}")
    print(f"\n  /hackathon-demo-canva-pipeline")
    print(f"\n  Or manually invoke canva-upload-pipeline with:")
    print(f"    content_dir:  {content_dir}")
    print(f"    canva_url:    {canva_url}")
    print(f"    title_bgs:    {title_bgs}")
    print(f"    content_bgs:  {content_bgs}")
    print()


if __name__ == "__main__":
    main()
