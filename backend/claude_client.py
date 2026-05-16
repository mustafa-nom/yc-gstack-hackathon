import json
import re
from urllib.parse import urlparse
from openai import AsyncOpenAI

_client = AsyncOpenAI()
_MODEL = "gpt-4o"

_SYSTEM_PROMPT = (
    "You are a TikTok content strategist specializing in viral carousel content for product brands. "
    "Analyze brand positioning, audience psychology, and trending content patterns to produce "
    "high-converting carousel scripts. Be direct and specific. Use conversational, plain language. "
    "Do not add commentary beyond what is requested. "
    "CRITICAL: Never invent specific product features, claims, ingredients, or capabilities that are "
    "not supported by the source material the user provides. If source material is thin, write "
    "category-level copy grounded only in what you actually know."
)

_STRATEGY_FALLBACK = {
    "hookPattern": "Contrarian opener",
    "slideStructure": "Hook → Problem → 3 Tips → CTA",
    "ctaStyle": "Soft CTA with profile mention",
    "nicheScore": 70,
}

_SLIDE_FALLBACK = [
    {"number": i, "headline": f"Slide {i}", "body": "Content coming soon."}
    for i in range(1, 8)
]


def _strip_fences(text: str) -> str:
    return re.sub(r"```(?:json)?\s*|\s*```", "", text).strip()


def _domain_slug(website: str) -> str:
    try:
        host = urlparse(website if "://" in website else "https://" + website).netloc
        host = host.removeprefix("www.")
        return host.split(".")[0] if host else website
    except Exception:
        return website


async def analyze_brand(
    website_content: str,
    description: str,
    *,
    scrape_ok: bool = True,
    website: str = "",
) -> str:
    if scrape_ok:
        user_msg = (
            "Analyze this product based on the following information.\n\n"
            f"Website content:\n<website>\n{website_content}\n</website>\n\n"
            f"Product description: {description or 'Not provided'}\n\n"
            "Return a concise brand summary (3-5 sentences) covering: what the product does, "
            "its unique value proposition, and its tone of voice. Ground every claim in the "
            "website content or the description — do not invent features."
        )
    else:
        slug = _domain_slug(website)
        if description.strip():
            user_msg = (
                "The product website could not be reached. Build the brand summary using ONLY the "
                "user's description below. Do not invent features that are not stated.\n\n"
                f"Brand handle (from URL): {slug}\n"
                f"Product description: {description}\n\n"
                "Return a concise brand summary (3-5 sentences) covering: what the product does "
                "based on the description, its likely value proposition, and a plausible tone of "
                "voice. If a fact is not in the description, say it is unspecified rather than "
                "guessing."
            )
        else:
            user_msg = (
                "The product website could not be reached and no description was provided.\n\n"
                f"Brand handle (from URL): {slug}\n\n"
                "Return a SHORT (2-3 sentence) brand summary that:\n"
                "1. Names the brand by its handle.\n"
                "2. Explicitly states that product details were not available.\n"
                "3. Does NOT invent any features, claims, or product category.\n"
                "Example shape: \"<Brand> is a brand we could not retrieve details on. Without "
                "access to the product website or a description, no specific features or positioning "
                "can be determined. The carousel that follows is intentionally generic until source "
                "material is provided.\""
            )
    response = await _client.chat.completions.create(
        model=_MODEL,
        max_tokens=512,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
    )
    return response.choices[0].message.content.strip()


async def extract_strategy(
    brand_summary: str, trending_videos: list[dict], tiktok_url: str
) -> dict:
    videos_fmt = "\n".join(
        f'- "{v["hook"]}" — {v["views"]:,} views — {v["niche"]} — {v["structure"]}'
        for v in trending_videos
    )
    user_msg = (
        "Given this brand summary and trending TikTok data, determine the optimal content strategy.\n\n"
        f"Brand summary:\n{brand_summary}\n\n"
        f"Trending videos (sample):\n{videos_fmt}\n\n"
        f"Reference TikTok URL: {tiktok_url}\n\n"
        "Return a JSON object ONLY, no explanation, with exactly these keys:\n"
        "- hookPattern: string describing the best hook style\n"
        "- slideStructure: string describing the carousel flow (e.g. \"Hook → Problem → 3 Tips → CTA\")\n"
        "- ctaStyle: string describing the call-to-action approach\n"
        "- nicheScore: integer 0-100 representing how well the product fits current trending niches"
    )
    response = await _client.chat.completions.create(
        model=_MODEL,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
    )
    try:
        return json.loads(_strip_fences(response.choices[0].message.content))
    except Exception:
        return _STRATEGY_FALLBACK


_PERSONA_FALLBACK = {
    "audience": {
        "description": "General TikTok audience interested in this product",
        "pain_points": ["not aware of the product", "unsure how it helps them"],
        "seeking": "a clear reason to try the product",
    },
    "tone": {
        "voice": "Direct, conversational, benefit-led",
        "title_style": "Short punchy hook",
        "example_hooks": ["Here's what most people get wrong", "This changed everything for me"],
    },
    "visual_identity": {
        "vibe": "Clean, modern, authentic",
        "aesthetic_keywords": ["minimal", "clean", "modern"],
        "color_palette": ["white", "black", "neutral gray"],
        "what_not_to_show": ["stock photos", "corporate settings", "cluttered backgrounds"],
    },
    "image_generation": {
        "title_prompt": "Candid lifestyle photo, natural light, authentic feel, no text, no watermark",
        "scene_variety": [
            "Wide lifestyle shot in a clean modern interior, natural window light, no people",
            "Close-up product-adjacent detail, soft focus background, warm tones, no people",
            "Minimalist flat lay on neutral surface, overhead angle, soft shadows, no people",
            "Ambient indoor shot with bokeh background, clean and modern, no people",
            "Simple outdoor lifestyle scene, natural daylight, uncluttered, no people",
        ],
    },
}


async def generate_persona(brand_summary: str, strategy: dict, tiktok_url: str) -> dict:
    user_msg = (
        "Based on this brand and content strategy, generate a complete TikTok creator persona.\n\n"
        f"Brand summary:\n{brand_summary}\n\n"
        f"Content strategy:\n"
        f"- Hook pattern: {strategy.get('hookPattern', '')}\n"
        f"- Slide structure: {strategy.get('slideStructure', '')}\n"
        f"- CTA style: {strategy.get('ctaStyle', '')}\n"
        f"- Reference TikTok: {tiktok_url or 'not provided'}\n\n"
        "Return a JSON object ONLY with exactly these keys:\n"
        "{\n"
        '  "audience": {\n'
        '    "description": "2-3 sentence description of the exact target viewer (age, lifestyle, mindset)",\n'
        '    "pain_points": ["pain point 1", "pain point 2", "pain point 3"],\n'
        '    "seeking": "one sentence on what they want"\n'
        "  },\n"
        '  "tone": {\n'
        '    "voice": "2-3 sentence description of the creator voice and style",\n'
        '    "title_style": "short description of hook format (e.g. contrarian, listicle, question)",\n'
        '    "example_hooks": ["hook 1", "hook 2", "hook 3"]\n'
        "  },\n"
        '  "visual_identity": {\n'
        '    "vibe": "one sentence describing the overall visual feel",\n'
        '    "aesthetic_keywords": ["keyword1", "keyword2", "keyword3"],\n'
        '    "color_palette": ["color1", "color2", "color3"],\n'
        '    "what_not_to_show": ["thing1", "thing2", "thing3"]\n'
        "  },\n"
        '  "image_generation": {\n'
        '    "title_prompt": "40-60 word Gemini image prompt for the title slide background — specific scene, lighting, props, mood. No text, no watermark, photorealistic.",\n'
        '    "scene_variety": [\n'
        '      "scene 1 — 20-30 words, distinct composition for content slide",\n'
        '      "scene 2",\n'
        '      "scene 3",\n'
        '      "scene 4",\n'
        '      "scene 5"\n'
        "    ]\n"
        "  }\n"
        "}"
    )
    response = await _client.chat.completions.create(
        model=_MODEL,
        max_tokens=1500,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
    )
    try:
        return json.loads(_strip_fences(response.choices[0].message.content))
    except Exception:
        return _PERSONA_FALLBACK


async def generate_slides(
    strategy: dict, brand_summary: str, *, scrape_ok: bool = True
) -> list[dict]:
    grounding_note = (
        "Ground every slide in the brand summary above. Do not invent product features, "
        "ingredients, or claims that are not present in the brand summary."
        if scrape_ok
        else (
            "IMPORTANT: The brand summary above was generated without access to the product "
            "website. Do NOT invent specific product features, ingredients, statistics, or "
            "claims (e.g., '9 out of 10 users', 'eco-friendly formula'). Keep the copy "
            "category-level, addressing the audience's likely pain point and an aspirational "
            "outcome. Reference the brand by name only."
        )
    )
    user_msg = (
        "Using this brand summary and content strategy, write the copy for a 7-slide TikTok carousel.\n\n"
        f"Brand summary:\n{brand_summary}\n\n"
        "Strategy:\n"
        f"- Hook pattern: {strategy.get('hookPattern', '')}\n"
        f"- Structure: {strategy.get('slideStructure', '')}\n"
        f"- CTA style: {strategy.get('ctaStyle', '')}\n\n"
        f"{grounding_note}\n\n"
        "Return a JSON array ONLY, no explanation, with exactly 7 objects, each having:\n"
        "- number: integer (1-7)\n"
        "- headline: string (3-6 words, punchy)\n"
        "- body: string (1-3 sentences, direct)"
    )
    response = await _client.chat.completions.create(
        model=_MODEL,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
    )
    try:
        slides = json.loads(_strip_fences(response.choices[0].message.content))
        while len(slides) < 7:
            n = len(slides) + 1
            slides.append({"number": n, "headline": f"Slide {n}", "body": "Content coming soon."})
        return slides[:7]
    except Exception:
        return _SLIDE_FALLBACK
