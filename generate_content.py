#!/usr/bin/env python3
"""
Generate TikTok carousel slide content using Claude.

Reads persona.yaml, calls Claude to brainstorm topics + generate per-slide text
and image prompts, writes slide_data.json + captions.txt to the output directory.

Usage:
    python generate_content.py [--persona persona.yaml] [--count 3] [--output-dir ./output] [topic seeds...]
"""

import argparse
import json
import re
import sys
import textwrap
from pathlib import Path

import yaml
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


def load_persona(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def build_system_prompt(persona: dict) -> str:
    p = persona
    aud = p["audience"]
    tone = p["tone"]
    vis = p["visual_identity"]
    img = p["image_generation"]

    return textwrap.dedent(f"""
        You are a TikTok content strategist creating carousel posts for {p["account"]["handle"]}.

        TARGET AUDIENCE
        {aud["description"]}
        Pain points: {", ".join(aud["pain_points"])}
        Seeking: {aud["seeking"]}

        TONE & VOICE
        {tone["voice"]}
        Title style: {tone["title_style"]}
        Example hooks: {", ".join(f'"{h}"' for h in tone["example_hooks"])}

        VISUAL IDENTITY
        Vibe: {vis["vibe"]}
        Aesthetic: {", ".join(vis["aesthetic_keywords"])}
        Color palette: {", ".join(vis["color_palette"])}
        Do NOT show: {", ".join(vis["what_not_to_show"])}

        IMAGE PROMPT BASE (append to every per-slide image prompt):
        {img["base_prompt"].strip()}

        OUTPUT FORMAT
        You must respond with ONLY valid JSON — no markdown, no commentary, no code fences.
        The JSON must match this exact structure:
        {{
          "topics": [
            {{
              "slug": "kebab-case-topic-slug",
              "title_slide": "Short Title-Case Hook for Slide 1",
              "slides": [
                {{
                  "title": "Slide Title (app name or concept)",
                  "body": "One concise line, 7-12 words, no em dashes, no commas",
                  "image_prompt": "Full Gemini image generation prompt for this slide's background"
                }}
              ],
              "caption": "Long-form TikTok caption with 5 hashtags at the end"
            }}
          ]
        }}

        RULES
        - Each topic has exactly {p["content"]["slides_per_carousel"] - 1} slides (the title slide is separate)
        - title_slide: short, scroll-stopping, matches the tone examples above
        - slide body: no commas, no em dashes, no filler words — concise and punchy
        - image_prompt: combine the slide's concept with the base prompt above; be specific and visual
        - caption: strong opening line, SEO keywords, exactly 5 hashtags, no emojis
        - Vary topic angles — no two topics should share the same hook template
    """).strip()


def build_user_prompt(persona: dict, count: int, seeds: list[str]) -> str:
    slides_per = persona["content"]["slides_per_carousel"] - 1  # exclude title
    seed_text = f"\nUse these as topic seeds: {', '.join(seeds)}" if seeds else ""
    return (
        f"Generate {count} TikTok carousel topics.{seed_text}\n"
        f"Each topic needs a title_slide + {slides_per} slides.\n"
        "Output only the JSON object."
    )


def extract_json(text: str) -> dict:
    text = text.strip()
    # Strip markdown code fences if Claude wrapped the response
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    return text.strip("-")


def write_captions(topics: list[dict], output_dir: Path) -> None:
    lines = []
    for topic in topics:
        lines.append(f"--- {topic['title_slide']} ---")
        lines.append(topic["caption"])
        lines.append("")
    (output_dir / "captions.txt").write_text("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description="Generate carousel content via Claude")
    parser.add_argument("--persona", default="persona.yaml", help="Path to persona.yaml")
    parser.add_argument("--count", "-n", type=int, default=None, help="Number of topics")
    parser.add_argument("--output-dir", "-o", default="output", help="Output directory")
    parser.add_argument("seeds", nargs="*", help="Optional topic seed words")
    args = parser.parse_args()

    persona = load_persona(args.persona)
    count = args.count or persona["content"]["topics_per_batch"]
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating {count} topics for {persona['account']['handle']}...")

    client = OpenAI()
    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=8096,
        messages=[
            {"role": "system", "content": build_system_prompt(persona)},
            {"role": "user", "content": build_user_prompt(persona, count, args.seeds)},
        ],
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    try:
        data = extract_json(raw)
    except json.JSONDecodeError as e:
        print(f"Failed to parse Claude response as JSON: {e}", file=sys.stderr)
        print("Raw response:", raw[:500], file=sys.stderr)
        sys.exit(1)

    # Ensure slugs are safe
    for topic in data["topics"]:
        if not topic.get("slug"):
            topic["slug"] = slugify(topic["title_slide"])

    # Write slide_data.json
    slide_data_path = output_dir / "slide_data.json"
    slide_data_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"  → {slide_data_path}")

    # Write captions.txt
    write_captions(data["topics"], output_dir)
    print(f"  → {output_dir / 'captions.txt'}")

    print(f"\nGenerated {len(data['topics'])} topics:")
    for t in data["topics"]:
        print(f"  [{t['slug']}] {t['title_slide']} ({len(t['slides'])} slides)")


if __name__ == "__main__":
    main()
