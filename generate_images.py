#!/usr/bin/env python3
"""
Generate background images for each carousel slide using Gemini.

Reads slide_data.json, generates one 9:16 PNG per slide via Gemini image generation,
saves to output/backgrounds/<slug>/slide_01.png ... slide_N.png.

Usage:
    python generate_images.py [--data output/slide_data.json] [--output-dir output/backgrounds]
                              [--topics slug1,slug2] [--api-key KEY]
"""

import argparse
import asyncio
import base64
import json
import os
import sys
import time
from pathlib import Path

import yaml
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

MODEL_ID = "gemini-3-pro-image-preview"
RETRYABLE_STATUS_CODES = {429, 500, 503}
MAX_RETRIES = 3
BACKOFF_BASE = 2.0


async def generate_image(client: genai.Client, prompt: str, aspect_ratio: str):
    for attempt in range(MAX_RETRIES):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=MODEL_ID,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                    image_config=types.ImageConfig(aspect_ratio=aspect_ratio),
                ),
            )
            for part in response.candidates[0].content.parts:
                if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                    data = part.inline_data.data
                    return data if isinstance(data, bytes) else base64.b64decode(data)
            return None
        except Exception as e:
            code = getattr(e, "code", None) or getattr(getattr(e, "response", None), "status_code", None)
            if attempt < MAX_RETRIES - 1 and (code in RETRYABLE_STATUS_CODES or "429" in str(e) or "503" in str(e)):
                wait = BACKOFF_BASE ** attempt
                print(f"    retrying in {wait:.0f}s ({e})")
                await asyncio.sleep(wait)
            else:
                print(f"    FAILED: {e}")
                return None


async def generate_topic_images(
    client: genai.Client,
    slug: str,
    slides: list[dict],
    output_dir: Path,
    aspect_ratio: str,
) -> int:
    topic_dir = output_dir / slug
    topic_dir.mkdir(parents=True, exist_ok=True)

    tasks = []
    for i, slide in enumerate(slides, start=1):
        tasks.append((i, slide["image_prompt"]))

    saved = 0
    results = await asyncio.gather(
        *[generate_image(client, prompt, aspect_ratio) for _, prompt in tasks],
        return_exceptions=False,
    )

    for (i, _), image_bytes in zip(tasks, results):
        out_path = topic_dir / f"slide_{i:02d}.png"
        if image_bytes:
            out_path.write_bytes(image_bytes)
            print(f"    slide_{i:02d}.png ✓")
            saved += 1
        else:
            print(f"    slide_{i:02d}.png ✗ (no image returned)")

    return saved


async def run(args):
    data_path = Path(args.data)
    if not data_path.exists():
        print(f"Error: {data_path} not found. Run generate_content.py first.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(data_path.read_text())
    topics = data["topics"]

    filter_slugs = set(args.topics.split(",")) if args.topics else None
    if filter_slugs:
        topics = [t for t in topics if t["slug"] in filter_slugs]
        if not topics:
            print(f"No topics matched: {args.topics}", file=sys.stderr)
            sys.exit(1)

    # Load aspect ratio from persona if available
    aspect_ratio = "9:16"
    persona_path = Path(args.persona) if args.persona else Path("persona.yaml")
    if persona_path.exists():
        persona = yaml.safe_load(persona_path.read_text())
        aspect_ratio = persona.get("image_generation", {}).get("aspect_ratio", "9:16")

    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not set.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    total_saved = 0
    total_expected = sum(len(t["slides"]) for t in topics)

    print(f"Generating images for {len(topics)} topic(s) ({total_expected} slides total)...")
    print(f"Aspect ratio: {aspect_ratio}  |  Model: {MODEL_ID}\n")

    for topic in topics:
        slug = topic["slug"]
        slides = topic["slides"]
        print(f"  [{slug}] {len(slides)} slides")
        saved = await generate_topic_images(client, slug, slides, output_dir, aspect_ratio)
        total_saved += saved
        if topic != topics[-1]:
            # Brief pause between topics to avoid rate-limit hammering
            await asyncio.sleep(1)

    print(f"\nDone. {total_saved}/{total_expected} images saved to {output_dir.resolve()}")
    if total_saved < total_expected:
        print(f"Warning: {total_expected - total_saved} slides failed — re-run with --topics to retry.")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Generate slide background images via Gemini")
    parser.add_argument("--data", default="output/slide_data.json", help="Path to slide_data.json")
    parser.add_argument("--output-dir", "-o", default="output/backgrounds", help="Output directory")
    parser.add_argument("--topics", help="Comma-separated slugs to regenerate (default: all)")
    parser.add_argument("--persona", default="persona.yaml", help="Path to persona.yaml (for aspect ratio)")
    parser.add_argument("--api-key", help="Gemini API key (overrides GEMINI_API_KEY env var)")
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
