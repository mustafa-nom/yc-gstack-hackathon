#!/usr/bin/env python3
"""
Generate background images for carousel slides using Gemini.

Generates:
  - Title slide bgs: one per topic (cycles through 6 pose variants)
    → <output_dir>/title_bgs/variation_01.jpeg ...
  - Content slide bgs: 5 per topic (pages 2-6, distinct compositions)
    → <output_dir>/content_bgs/<slug>/page_02.jpeg ... page_06.jpeg

Usage:
    python generate_images.py [--persona persona.yaml]
                              [--output-dir ~/Desktop/hackathon-demo-content]
                              [--topics slug1,slug2]
                              [--skip-title] [--skip-content]
"""

import argparse
import asyncio
import base64
import csv
import os
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

MODEL_ID = "gemini-3-pro-image-preview"
MAX_RETRIES = 3
BACKOFF_BASE = 2.0


def read_topics_from_csvs(content_dir: Path) -> list:
    topics = []
    for f in sorted(content_dir.glob("*.csv")):
        with open(f) as fp:
            rows = list(csv.reader(fp))
        if len(rows) >= 2:
            topics.append({"slug": f.stem, "title_hook": rows[1][0]})
    return topics


async def generate_image(client: genai.Client, prompt: str):
    for attempt in range(MAX_RETRIES):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=MODEL_ID,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                    image_config=types.ImageConfig(aspect_ratio="1:1"),
                ),
            )
            for part in response.candidates[0].content.parts:
                if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                    data = part.inline_data.data
                    return data if isinstance(data, bytes) else base64.b64decode(data)
            return None
        except Exception as e:
            if attempt < MAX_RETRIES - 1 and any(c in str(e) for c in ["429", "500", "503"]):
                wait = BACKOFF_BASE ** attempt
                print(f"    retry in {wait:.0f}s")
                await asyncio.sleep(wait)
            else:
                print(f"    FAILED: {e}")
                return None


async def generate_title_bgs(client, topics, persona, title_dir, filter_slugs):
    title_dir.mkdir(parents=True, exist_ok=True)
    base = persona["image_generation"]["title_prompt_base"].strip()
    variants = persona["image_generation"]["title_prompt_variants"]

    filtered = [(i + 1, t) for i, t in enumerate(topics)
                if not filter_slugs or t["slug"] in filter_slugs]

    print(f"\n  Title backgrounds ({len(filtered)} topics)...")
    for idx, (i, topic) in enumerate(filtered):
        variant = variants[idx % len(variants)]
        prompt = f"{variant}. {base}"
        out = title_dir / f"variation_{i:02d}.jpeg"
        print(f"    variation_{i:02d} [{topic['slug']}]...", end="", flush=True)
        img = await generate_image(client, prompt)
        if img:
            out.write_bytes(img)
            print(" ✓")
        else:
            print(" ✗")
        await asyncio.sleep(0.5)


async def generate_content_bgs(client, topics, persona, content_bg_dir, filter_slugs):
    tail = persona["image_generation"]["content_prompt_tail"].strip()
    compositions = persona["image_generation"]["content_prompt_compositions"]

    for topic in topics:
        slug = topic["slug"]
        if filter_slugs and slug not in filter_slugs:
            continue

        topic_dir = content_bg_dir / slug
        topic_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n  Content bgs [{slug}] (pages 2-6)...")

        # pages 2-6 → compositions 0-4
        page_nums = list(range(2, 7))
        prompts = [f"{compositions[i % len(compositions)]} {tail}"
                   for i in range(len(page_nums))]

        results = await asyncio.gather(*[generate_image(client, p) for p in prompts])

        for page_num, img in zip(page_nums, results):
            out = topic_dir / f"page_{page_num:02d}.jpeg"
            if img:
                out.write_bytes(img)
                print(f"    page_{page_num:02d}.jpeg ✓")
            else:
                print(f"    page_{page_num:02d}.jpeg ✗")

        await asyncio.sleep(1)


async def run(args):
    persona = yaml.safe_load(Path(args.persona).read_text())
    content_dir = Path(
        args.output_dir or f"~/Desktop/{persona['account']['name']}-content"
    ).expanduser()

    if not content_dir.exists():
        print(f"Error: {content_dir} not found. Run generate_content.py first.", file=sys.stderr)
        sys.exit(1)

    topics = read_topics_from_csvs(content_dir)
    if not topics:
        print(f"No CSV files in {content_dir}", file=sys.stderr)
        sys.exit(1)

    filter_slugs = set(args.topics.split(",")) if args.topics else set()

    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not set.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    print(f"Generating images for {len(topics)} topic(s) from {content_dir}...")

    if not args.skip_title:
        await generate_title_bgs(client, topics, persona, content_dir / "title_bgs", filter_slugs)

    if not args.skip_content:
        await generate_content_bgs(client, topics, persona, content_dir / "content_bgs", filter_slugs)

    print(f"\nDone.")


def main():
    parser = argparse.ArgumentParser(description="Generate slide background images via Gemini")
    parser.add_argument("--persona", default="persona.yaml")
    parser.add_argument("--output-dir", "-o", default=None)
    parser.add_argument("--topics", help="Comma-separated slugs to regenerate")
    parser.add_argument("--skip-title", action="store_true")
    parser.add_argument("--skip-content", action="store_true")
    parser.add_argument("--api-key")
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
