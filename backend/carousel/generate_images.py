#!/usr/bin/env python3
"""
Generate background images for each carousel slide using Gemini.

Reads persona.yaml for image prompts (title_prompt + scene_variety for content slides).
Saves to output/backgrounds/<slug>/slide_01.png ... slide_N.png.

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

import yaml
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

MODEL_ID = "gemini-2.5-flash-image"
MAX_RETRIES = 4
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


def build_prompts(n_content_slides, persona):
    img_cfg = persona["image_generation"]
    base = img_cfg.get("base_prompt", "").strip()
    title_p = img_cfg.get("title_prompt", "").strip()
    scenes = img_cfg.get("scene_variety", [])

    title_prompt = f"{title_p}. {base}" if base else title_p

    content_prompts = []
    for i in range(n_content_slides):
        scene = scenes[i % len(scenes)] if scenes else base
        content_prompts.append(f"{scene}. {base}" if base and scene != base else scene)

    return title_prompt, content_prompts


async def generate_topic_images(client, slug, n_slides, persona, output_dir, aspect_ratio):
    topic_dir = output_dir / slug
    topic_dir.mkdir(parents=True, exist_ok=True)

    n_content = n_slides - 1  # slide 1 is title
    title_prompt, content_prompts = build_prompts(n_content, persona)

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
        if not topics:
            print(f"No topics matched: {args.topics}", file=sys.stderr)
            sys.exit(1)

    aspect_ratio = persona.get("image_generation", {}).get("aspect_ratio", "9:16")

    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not set.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    n_slides_per_topic = persona.get("content", {}).get("slides_per_carousel", 6)
    total_expected = len(topics) * n_slides_per_topic
    total_saved = 0

    print(f"Generating images for {len(topics)} topic(s) ({total_expected} slides total)...")
    print(f"Aspect ratio: {aspect_ratio}  |  Model: {MODEL_ID}\n")

    for i, topic in enumerate(topics):
        saved = await generate_topic_images(
            client, topic["slug"], n_slides_per_topic, persona, output_dir, aspect_ratio
        )
        total_saved += saved
        if i < len(topics) - 1:
            await asyncio.sleep(1)

    print(f"\nDone. {total_saved}/{total_expected} images saved to {output_dir.resolve()}")
    if total_saved < total_expected:
        print(f"Warning: {total_expected - total_saved} failed — re-run with --topics to retry.")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Generate slide background images via OpenAI gpt-image-1")
    parser.add_argument("--data", default="output/slide_data.json")
    parser.add_argument("--output-dir", "-o", default="output/backgrounds")
    parser.add_argument("--persona", default="persona.yaml")
    parser.add_argument("--topics", help="Comma-separated slugs to regenerate")
    parser.add_argument("--api-key")
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
