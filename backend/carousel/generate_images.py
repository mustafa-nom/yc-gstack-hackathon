#!/usr/bin/env python3
"""
Generate background images for each carousel slide using Gemini.

If reference_analysis.json exists alongside slide_data.json (written by generate_content.py
when --reference / --account is used), image prompts are built by blending the reference's
gemini_prompt_fragment (the aesthetic extracted from the real TikTok account) with the
persona's visual_identity fields (color_palette, aesthetic_keywords, vibe, scene_elements).

Falls back to persona-only prompts (title_prompt + scene_variety) when no analysis is found.

Usage:
    python generate_images.py [--data output/slide_data.json] [--output-dir output/backgrounds]
                              [--persona persona.yaml] [--topics slug1,slug2] [--api-key KEY]
"""

import argparse
import asyncio
import base64
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

MODEL_ID = "gemini-3-pro-image-preview"
MAX_RETRIES = 3
BACKOFF_BASE = 2.0


async def generate_image(client, prompt, aspect_ratio):
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
            retryable = any(c in str(e) for c in ["429", "500", "503"])
            if attempt < MAX_RETRIES - 1 and retryable:
                wait = BACKOFF_BASE ** attempt
                print(f"    retry in {wait:.0f}s")
                await asyncio.sleep(wait)
            else:
                print(f"    FAILED: {e}")
                return None


_BASE_PROMPT = (
    "Candid iPhone photo, no text, no watermark, no phone frame, "
    "full bleed edge-to-edge, photorealistic, natural grain"
)


def build_prompts(n_content_slides, reference_analysis=None):
    ref_frag = (
        reference_analysis.get("background", {}).get("gemini_prompt_fragment", "")
        if reference_analysis
        else ""
    )

    if ref_frag:
        prompt = f"{ref_frag}. {_BASE_PROMPT}"
        print(f"  Image prompts: reference mode — {ref_frag[:80]}...")
        return prompt, [prompt] * n_content_slides
    else:
        print("  Image prompts: generic mode (no reference analysis found)")
        return _BASE_PROMPT, [_BASE_PROMPT] * n_content_slides


async def generate_topic_images(client, slug, n_slides, output_dir, aspect_ratio, reference_analysis=None):
    topic_dir = output_dir / slug
    topic_dir.mkdir(parents=True, exist_ok=True)

    n_content = n_slides - 1  # slide 1 is title
    title_prompt, content_prompts = build_prompts(n_content, reference_analysis)

    all_prompts = [title_prompt] + content_prompts
    print(f"  [{slug}] {n_slides} slides...")

    results = await asyncio.gather(*[generate_image(client, p, aspect_ratio) for p in all_prompts])

    saved = 0
    for i, image_bytes in enumerate(results, start=1):
        out_path = topic_dir / f"slide_{i:02d}.png"
        if image_bytes:
            out_path.write_bytes(image_bytes)
            print(f"    slide_{i:02d}.png ✓")
            saved += 1
        else:
            print(f"    slide_{i:02d}.png ✗")
    return saved


async def run(args):
    data_path = Path(args.data)
    if not data_path.exists():
        print(f"Error: {data_path} not found. Run generate_content.py first.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(data_path.read_text())
    topics = data["topics"]

    # Auto-load reference analysis produced by generate_content.py (same dir as slide_data.json)
    analysis_path = data_path.parent / "reference_analysis.json"
    reference_analysis = None
    if analysis_path.exists():
        reference_analysis = json.loads(analysis_path.read_text())
        print(f"  Loaded reference analysis from {analysis_path}")

    filter_slugs = set(args.topics.split(",")) if args.topics else None
    if filter_slugs:
        topics = [t for t in topics if t["slug"] in filter_slugs]
        if not topics:
            print(f"No topics matched: {args.topics}", file=sys.stderr)
            sys.exit(1)

    aspect_ratio = (
        reference_analysis.get("format", {}).get("aspect_ratio", "9:16")
        if reference_analysis else "9:16"
    )
    n_slides_per_topic = (
        reference_analysis.get("format", {}).get("slides_per_carousel", 6)
        if reference_analysis else 6
    )

    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not set.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    total_expected = len(topics) * n_slides_per_topic
    total_saved = 0

    print(f"Generating images for {len(topics)} topic(s) ({total_expected} slides total)...")
    print(f"Aspect ratio: {aspect_ratio}  |  Model: {MODEL_ID}\n")

    for i, topic in enumerate(topics):
        saved = await generate_topic_images(
            client, topic["slug"], n_slides_per_topic, output_dir, aspect_ratio, reference_analysis
        )
        total_saved += saved
        if i < len(topics) - 1:
            await asyncio.sleep(1)

    print(f"\nDone. {total_saved}/{total_expected} images saved to {output_dir.resolve()}")
    if total_saved < total_expected:
        print(f"Warning: {total_expected - total_saved} failed — re-run with --topics to retry.")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Generate slide background images via Gemini")
    parser.add_argument("--data", default="output/slide_data.json")
    parser.add_argument("--output-dir", "-o", default="output/backgrounds")
    parser.add_argument("--topics", help="Comma-separated slugs to regenerate")
    parser.add_argument("--api-key")
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
