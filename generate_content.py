#!/usr/bin/env python3
"""
Generate TikTok carousel slide content using GPT-4o.

Outputs CSV files compatible with canva-upload-pipeline, plus captions.txt.

Usage:
    python generate_content.py [--persona persona.yaml] [--count 3]
                               [--output-dir ~/Desktop/content] [--reference URL]
                               [topic seeds...]
"""

import argparse
import base64
import json
import re
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path
from typing import List, Optional

import yaml
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


def load_persona(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    return text.strip("-")


def download_reference_slides(url: str, tmp_dir: Path) -> List[Path]:
    url = url.replace("\\", "")
    print(f"  Downloading reference from {url}...")
    result = subprocess.run(
        ["yt-dlp", "--quiet", "--no-warnings",
         "-o", str(tmp_dir / "slide_%(autonumber)s.%(ext)s"), url],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"  Warning: yt-dlp failed ({result.stderr.strip()[:200]})", file=sys.stderr)
        return []
    images = sorted(p for p in tmp_dir.iterdir()
                    if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    print(f"  Downloaded {len(images)} slide(s)")
    return images


def encode_image(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def mime_type(path: Path) -> str:
    ext = path.suffix.lower().lstrip(".")
    return {"jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")


def analyze_reference(images: List[Path], client: OpenAI) -> dict:
    print("  Analyzing reference style...")
    content = [{"type": "text", "text": textwrap.dedent("""
        Analyze these TikTok carousel slides. Extract:

        1. TEXT STYLE:
           - hook_format: structural pattern of the title hook on slide 1
           - body_length: word count per slide body
           - casing: title and body casing style
           - tone_markers: list of tone adjectives
           - example_hooks: verbatim title text visible on the slides

        2. BACKGROUND AESTHETIC:
           - lighting, scene_type, color_temperature, composition, props, mood
           - gemini_prompt_fragment: 20-40 word phrase for Gemini image generation
             to reproduce this background style. No text in images.

        Respond ONLY with valid JSON:
        {
          "text_style": {
            "hook_format": "...", "body_length": "...", "casing": "...",
            "tone_markers": ["..."], "example_hooks": ["..."]
          },
          "background": {
            "lighting": "...", "scene_type": "...", "color_temperature": "...",
            "composition": "...", "props": ["..."], "mood": "...",
            "gemini_prompt_fragment": "..."
          }
        }
    """).strip()}]

    for i, img in enumerate(images[:8]):
        content.append({"type": "image_url", "image_url": {
            "url": f"data:{mime_type(img)};base64,{encode_image(img)}",
            "detail": "high" if i == 0 else "low",
        }})

    response = client.chat.completions.create(
        model="gpt-4o", max_tokens=1024,
        messages=[{"role": "user", "content": content}],
        response_format={"type": "json_object"},
    )
    analysis = json.loads(response.choices[0].message.content)
    bg = analysis.get("background", {})
    print(f"  Background: {bg.get('gemini_prompt_fragment', '?')[:80]}...")
    return analysis


def build_system_prompt(persona: dict, analysis: Optional[dict] = None) -> str:
    p = persona
    aud = p["audience"]
    tone = p["tone"]
    vis = p["visual_identity"]
    n_slides = p["content"]["slides_per_carousel"] - 1  # exclude title slide

    if analysis and analysis.get("text_style"):
        ts = analysis["text_style"]
        text_rules = textwrap.dedent(f"""
            TEXT STYLE (from reference — follow precisely):
            Hook format: {ts.get("hook_format", tone["title_style"])}
            Body length: {ts.get("body_length", "7-12 words")}
            Casing: {ts.get("casing", "Title Case")}
            Tone: {", ".join(ts.get("tone_markers", []))}
            Example hooks (match this register exactly):
            {chr(10).join(f'  "{h}"' for h in ts.get("example_hooks", tone["example_hooks"]))}
        """).strip()
    else:
        text_rules = textwrap.dedent(f"""
            TEXT STYLE:
            {tone["voice"]}
            Title style: {tone["title_style"]}
            Example hooks: {", ".join(f'"{h}"' for h in tone["example_hooks"])}
        """).strip()

    lifestack_rule = ""
    if p["content"].get("include_lifestack"):
        lifestack_rule = (
            f'\n- ONE slide per topic MUST have title exactly "Lifestack" '
            f'and body exactly "{p["content"]["lifestack_body"]}"'
        )

    return textwrap.dedent(f"""
        You are a TikTok content strategist creating carousel posts for {p["account"]["handle"]}.

        AUDIENCE: {aud["description"]}
        Pain points: {", ".join(aud["pain_points"])}
        Seeking: {aud["seeking"]}

        {text_rules}

        VISUAL IDENTITY: {vis["vibe"]}
        Aesthetic: {", ".join(vis["aesthetic_keywords"])}
        Do NOT show: {", ".join(vis["what_not_to_show"])}

        OUTPUT — valid JSON only, no markdown:
        {{
          "topics": [{{
            "slug": "kebab-case-slug",
            "title_slide": "Short hook matching text style above",
            "slides": [
              {{"title": "App or Concept Name", "body": "1 line, 7-12 words, no commas, no em dashes"}}
            ],
            "caption": "Long-form TikTok caption, 5 hashtags at end, no emojis"
          }}]
        }}

        RULES:
        - Each topic: {n_slides} slides (title slide separate){lifestack_rule}
        - body: no commas, no em dashes, concise
        - caption: strong opener, SEO keywords, exactly 5 hashtags
        - Vary opener templates across topics
    """).strip()


def write_csv(topic: dict, output_dir: Path) -> Path:
    slug = topic["slug"]
    csv_path = output_dir / f"{slug}.csv"
    lines = ['"Title","Body"']
    # Row 2: title slide
    title_hook = topic["title_slide"].replace('"', '""')
    lines.append(f'"{title_hook}",""')
    # Rows 3+: content slides
    for slide in topic["slides"]:
        t = slide["title"].replace('"', '""')
        b = slide["body"].replace('"', '""')
        lines.append(f'"{t}","{b}"')
    csv_path.write_text("\n".join(lines))
    return csv_path


def write_captions(topics: list, output_dir: Path) -> None:
    lines = []
    for topic in topics:
        lines.append(f"--- {topic['title_slide']} ---")
        lines.append(topic["caption"])
        lines.append("")
    (output_dir / "captions.txt").write_text("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description="Generate carousel CSV content")
    parser.add_argument("--persona", default="persona.yaml")
    parser.add_argument("--count", "-n", type=int, default=None)
    parser.add_argument("--output-dir", "-o", default=None)
    parser.add_argument("--reference", metavar="URL")
    parser.add_argument("seeds", nargs="*")
    args = parser.parse_args()

    persona = load_persona(args.persona)
    count = args.count or persona["content"]["topics_per_batch"]
    output_dir = Path(args.output_dir or f"~/Desktop/{persona['account']['name']}-content").expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating {count} topic(s) for {persona['account']['handle']}...")

    client = OpenAI()
    analysis = None

    if args.reference:
        with tempfile.TemporaryDirectory() as tmp:
            images = download_reference_slides(args.reference, Path(tmp))
            if images:
                analysis = analyze_reference(images, client)
                (output_dir / "reference_analysis.json").write_text(
                    json.dumps(analysis, indent=2))

    n_slides = persona["content"]["slides_per_carousel"] - 1
    seed_text = f"\nTopic seeds: {', '.join(args.seeds)}" if args.seeds else ""
    user_prompt = (
        f"Generate {count} TikTok carousel topics.{seed_text}\n"
        f"Each needs a title_slide + {n_slides} slides. JSON only."
    )

    print("  Generating content...")
    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=8096,
        messages=[
            {"role": "system", "content": build_system_prompt(persona, analysis)},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}", file=sys.stderr)
        sys.exit(1)

    for topic in data["topics"]:
        if not topic.get("slug"):
            topic["slug"] = slugify(topic["title_slide"])
        csv_path = write_csv(topic, output_dir)
        print(f"  → {csv_path.name}  ({len(topic['slides'])} slides)")

    write_captions(data["topics"], output_dir)
    print(f"  → captions.txt")
    print(f"\nOutput: {output_dir}")


if __name__ == "__main__":
    main()
