import json
import re
import anthropic

_client = anthropic.AsyncAnthropic()
_MODEL = "claude-sonnet-4-6"

_SYSTEM_PROMPT = [
    {
        "type": "text",
        "text": (
            "You are a TikTok content strategist specializing in viral carousel content for product brands. "
            "Analyze brand positioning, audience psychology, and trending content patterns to produce "
            "high-converting carousel scripts. Be direct and specific. Use conversational, plain language. "
            "Do not add commentary beyond what is requested."
        ),
        "cache_control": {"type": "ephemeral"},
    }
]

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


async def analyze_brand(website_content: str, description: str, audience: str) -> str:
    user_msg = (
        "Analyze this product based on the following information.\n\n"
        f"Website content:\n<website>\n{website_content}\n</website>\n\n"
        f"Product description: {description or 'Not provided'}\n"
        f"Target audience: {audience}\n\n"
        "Return a concise brand summary (3-5 sentences) covering: what the product does, "
        "its unique value proposition, its tone of voice, and who it serves."
    )
    response = await _client.messages.create(
        model=_MODEL,
        max_tokens=512,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    return response.content[0].text.strip()


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
    response = await _client.messages.create(
        model=_MODEL,
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    try:
        return json.loads(_strip_fences(response.content[0].text))
    except Exception:
        return _STRATEGY_FALLBACK


async def generate_slides(strategy: dict, brand_summary: str) -> list[dict]:
    user_msg = (
        "Using this brand summary and content strategy, write the copy for a 7-slide TikTok carousel.\n\n"
        f"Brand summary:\n{brand_summary}\n\n"
        f"Strategy:\n"
        f"- Hook pattern: {strategy.get('hookPattern', '')}\n"
        f"- Structure: {strategy.get('slideStructure', '')}\n"
        f"- CTA style: {strategy.get('ctaStyle', '')}\n\n"
        "Return a JSON array ONLY, no explanation, with exactly 7 objects, each having:\n"
        "- number: integer (1-7)\n"
        "- headline: string (3-6 words, punchy)\n"
        "- body: string (1-3 sentences, direct)"
    )
    response = await _client.messages.create(
        model=_MODEL,
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    try:
        slides = json.loads(_strip_fences(response.content[0].text))
        # Pad to 7 if Claude returns fewer
        while len(slides) < 7:
            n = len(slides) + 1
            slides.append({"number": n, "headline": f"Slide {n}", "body": "Content coming soon."})
        return slides[:7]
    except Exception:
        return _SLIDE_FALLBACK
