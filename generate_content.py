#!/usr/bin/env python3
"""
Generate TikTok carousel slide content using GPT-4o.

Reads persona.yaml, optionally downloads a reference TikTok carousel,
analyzes its text style and background aesthetic, then generates new
content that matches both — with updated Gemini image prompts.

Usage:
    python generate_content.py [--persona persona.yaml] [--count 3] [--output-dir ./output]
                               [--reference <tiktok-url>] [topic seeds...]
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


def download_reference_slides(url: str, tmp_dir: Path) -> List[Path]:
    # Strip shell-escape backslashes (e.g. \? → ?) that terminals sometimes inject
    url = url.replace("\\", "")
    print(f"  Downloading reference from {url}...")
    result = subprocess.run(
        [
            "yt-dlp",
            "--quiet",
            "--no-warnings",
            "-o", str(tmp_dir / "slide_%(autonumber)s.%(ext)s"),
            url,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  Warning: yt-dlp failed ({result.stderr.strip()[:200]})", file=sys.stderr)
        return []
    images = sorted(
        p for p in tmp_dir.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    print(f"  Downloaded {len(images)} slide(s)")
    return images


def encode_image(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def mime_type(path: Path) -> str:
    ext = path.suffix.lower().lstrip(".")
    return {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")


def image_content_block(path: Path, detail: str = "high") -> dict:
    return {
        "type": "image_url",
        "image_url": {
            "url": f"data:{mime_type(path)};base64,{encode_image(path)}",
            "detail": detail,
        },
    }


def analyze_reference(images: List[Path], client: OpenAI) -> dict:
    """
    Pass 1: Analyze reference carousel images with GPT-4o vision.
    Returns a structured dict with text style rules and background aesthetic details.
    """
    print("  Analyzing reference style (text + backgrounds)...")

    content = [
        {
            "type": "text",
            "text": textwrap.dedent("""
                Analyze these TikTok carousel slides carefully. Extract two things:

                1. TEXT STYLE — how the on-slide text is written:
                   - hook_format: the structural pattern of the title/hook on slide 1
                     (e.g. "Starts with a number + lowercase verb phrase", "Title-Case listicle")
                   - body_length: approximate word count for body text per slide
                   - casing: how titles and body text are cased
                   - tone_markers: list of adjectives describing the voice
                     (e.g. ["gentle", "first-person", "reassuring", "casual"])
                   - example_hooks: list of the actual title/hook text visible on the slides
                     (transcribe verbatim what you can read)

                2. BACKGROUND AESTHETIC — the visual style of the background images:
                   - lighting: describe the light quality, direction, and warmth
                   - scene_type: what kind of scene/setting is shown
                   - color_temperature: warm/cool/neutral + dominant hues
                   - composition: how the shot is framed (close-up, wide, POV, flat-lay, etc.)
                   - props: list of objects/elements visible in the backgrounds
                   - mood: 2-3 adjectives describing the emotional tone of the imagery
                   - gemini_prompt_fragment: a concise phrase (20-40 words) ready to be injected
                     into a Gemini image generation prompt to reproduce this exact background style.
                     Be specific about lighting, props, colors, and composition. No text in images.

                Respond with ONLY valid JSON — no markdown, no commentary:
                {
                  "text_style": {
                    "hook_format": "...",
                    "body_length": "...",
                    "casing": "...",
                    "tone_markers": ["..."],
                    "example_hooks": ["..."]
                  },
                  "background": {
                    "lighting": "...",
                    "scene_type": "...",
                    "color_temperature": "...",
                    "composition": "...",
                    "props": ["..."],
                    "mood": "...",
                    "gemini_prompt_fragment": "..."
                  }
                }
            """).strip(),
        }
    ]

    # Use high detail for the first slide (title — most text), low for the rest (backgrounds)
    for i, img in enumerate(images[:8]):
        detail = "high" if i == 0 else "low"
        content.append(image_content_block(img, detail=detail))

    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=1024,
        messages=[{"role": "user", "content": content}],
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    analysis = json.loads(raw)

    # Print summary for the user
    ts = analysis.get("text_style", {})
    bg = analysis.get("background", {})
    print(f"  Text style: {ts.get('hook_format', '?')}")
    print(f"  Background: {bg.get('gemini_prompt_fragment', '?')[:80]}...")

    return analysis


def build_system_prompt(persona: dict, analysis: Optional[dict] = None) -> str:
    p = persona
    aud = p["audience"]
    tone = p["tone"]
    vis = p["visual_identity"]
    img = p["image_generation"]

    # Base image prompt: persona base + reference background if available
    base_prompt = img["base_prompt"].strip()
    if analysis and analysis.get("background", {}).get("gemini_prompt_fragment"):
        bg_fragment = analysis["background"]["gemini_prompt_fragment"]
        base_prompt = f"{base_prompt}\nReference background style: {bg_fragment}"

    # Text style rules: persona defaults + reference overrides if available
    if analysis and analysis.get("text_style"):
        ts = analysis["text_style"]
        text_style_rules = textwrap.dedent(f"""
            TEXT STYLE (extracted from reference carousel — follow precisely):
            Hook format: {ts.get("hook_format", tone["title_style"])}
            Body length: {ts.get("body_length", "7-12 words")}
            Casing: {ts.get("casing", "Title Case titles, sentence case body")}
            Tone markers: {", ".join(ts.get("tone_markers", [tone["voice"]]))}
            Example hooks from reference (match this register exactly):
            {chr(10).join(f'  - "{h}"' for h in ts.get("example_hooks", tone["example_hooks"]))}
        """).strip()
    else:
        text_style_rules = textwrap.dedent(f"""
            TEXT STYLE:
            {tone["voice"]}
            Title style: {tone["title_style"]}
            Example hooks: {", ".join(f'"{h}"' for h in tone["example_hooks"])}
        """).strip()

    return textwrap.dedent(f"""
        You are a TikTok content strategist creating carousel posts for {p["account"]["handle"]}.

        TARGET AUDIENCE
        {aud["description"]}
        Pain points: {", ".join(aud["pain_points"])}
        Seeking: {aud["seeking"]}

        {text_style_rules}

        VISUAL IDENTITY
        Vibe: {vis["vibe"]}
        Aesthetic: {", ".join(vis["aesthetic_keywords"])}
        Color palette: {", ".join(vis["color_palette"])}
        Do NOT show: {", ".join(vis["what_not_to_show"])}

        IMAGE PROMPT BASE (use this as the foundation for every per-slide image_prompt):
        {base_prompt}

        OUTPUT FORMAT
        You must respond with ONLY valid JSON — no markdown, no commentary, no code fences.
        {{
          "topics": [
            {{
              "slug": "kebab-case-topic-slug",
              "title_slide": "Hook that exactly matches the text style above",
              "subtitle": "Short supporting line below the title (1 sentence, softer tone)",
              "slides": [
                {{
                  "title": "Slide Title (no number — numbering added automatically)",
                  "body": "Paragraph-style explanation. 3-5 sentences totalling 50-80 words. Specific and actionable. Each sentence builds on the previous.",
                  "image_prompt": "Realistic candid lifestyle photography prompt for this slide's background — specific scene, natural lighting, no people unless essential, no text in image, photorealistic iPhone quality"
                }}
              ],
              "caption": "Long-form TikTok caption with 5 hashtags at the end"
            }}
          ]
        }}

        RULES
        - Each topic has exactly {p["content"]["slides_per_carousel"] - 1} slides (title slide is separate)
        - title_slide: match the hook format and register from TEXT STYLE — not a generic working title
        - subtitle: 1 short sentence framing who this is for or why it matters (e.g. "From someone who learned the hard way.")
        - slide title: concise, no number prefix
        - slide body: paragraph-style, 3-5 sentences, ~50-80 words — specific, actionable, builds naturally
        - image_prompt: VARIED scenes per slide — bedroom, food, outdoor, urban, interior, etc. Each slide a different setting. Photorealistic, candid, natural lighting. No text. No staged AI aesthetic.
        - caption: strong opening line, SEO keywords, exactly 5 hashtags, no emojis
        - Vary topic angles — no two topics should share the same opener template
    """).strip()


def build_user_prompt(persona: dict, count: int, seeds: List[str]) -> str:
    slides_per = persona["content"]["slides_per_carousel"] - 1
    seed_text = f"\nUse these as topic seeds: {', '.join(seeds)}" if seeds else ""
    return (
        f"Generate {count} TikTok carousel topics.{seed_text}\n"
        f"Each topic needs a title_slide + {slides_per} slides.\n"
        "Output only the JSON object."
    )


def extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    return text.strip("-")


def write_captions(topics: list, output_dir: Path) -> None:
    lines = []
    for topic in topics:
        lines.append(f"--- {topic['title_slide']} ---")
        lines.append(topic["caption"])
        lines.append("")
    (output_dir / "captions.txt").write_text("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description="Generate carousel content via GPT-4o")
    parser.add_argument("--persona", default="persona.yaml", help="Path to persona.yaml")
    parser.add_argument("--count", "-n", type=int, default=None, help="Number of topics")
    parser.add_argument("--output-dir", "-o", default="output", help="Output directory")
    parser.add_argument("--reference", metavar="URL", help="TikTok carousel URL to use as style reference")
    parser.add_argument("seeds", nargs="*", help="Optional topic seed words")
    args = parser.parse_args()

    persona = load_persona(args.persona)
    count = args.count or persona["content"]["topics_per_batch"]
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating {count} topics for {persona['account']['handle']}...")

    client = OpenAI()
    analysis = None

    if args.reference:
        with tempfile.TemporaryDirectory() as tmp:
            images = download_reference_slides(args.reference, Path(tmp))
            if images:
                analysis = analyze_reference(images, client)
                # Save analysis for inspection
                (output_dir / "reference_analysis.json").write_text(
                    json.dumps(analysis, indent=2, ensure_ascii=False)
                )
                print(f"  → {output_dir}/reference_analysis.json")

    system = build_system_prompt(persona, analysis)
    user = build_user_prompt(persona, count, args.seeds)

    print("  Generating content...")
    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=8096,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    try:
        data = extract_json(raw)
    except json.JSONDecodeError as e:
        print(f"Failed to parse GPT-4o response as JSON: {e}", file=sys.stderr)
        print("Raw response:", raw[:500], file=sys.stderr)
        sys.exit(1)

    for topic in data["topics"]:
        if not topic.get("slug"):
            topic["slug"] = slugify(topic["title_slide"])

    slide_data_path = output_dir / "slide_data.json"
    slide_data_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"  → {slide_data_path}")

    write_captions(data["topics"], output_dir)
    print(f"  → {output_dir / 'captions.txt'}")

    print(f"\nGenerated {len(data['topics'])} topics:")
    for t in data["topics"]:
        print(f"  [{t['slug']}] {t['title_slide']} ({len(t['slides'])} slides)")


if __name__ == "__main__":
    main()
