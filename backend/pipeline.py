from typing import AsyncGenerator
from scraper import scrape_website
from apify_mock import get_trending_videos
from claude_client import analyze_brand, extract_strategy, generate_slides


def _build_personal_md(website: str, description: str, audience: str, tiktok: str) -> str:
    return "\n".join([
        "# Personal Profile",
        "",
        "## Product",
        f"- **Website:** {website}",
        f"- **Description:** {description or 'Not provided'}",
        "",
        "## Content Strategy",
        f"- **Target Audience:** {audience}",
        f"- **Reference TikTok:** {tiktok}",
        "",
    ])


async def run_pipeline(
    website: str, description: str, audience: str, tiktok: str
) -> AsyncGenerator[tuple[str, dict | None], None]:
    yield "Initializing agent pipeline…", None

    yield "Crawling product website…", None
    website_content = await scrape_website(website)

    yield "Analyzing brand positioning…", None
    brand_summary = await analyze_brand(website_content, description, audience)

    yield "Fetching trending videos via Apify…", None
    trending_videos = get_trending_videos()

    yield "Extracting hook patterns from high-performers…", None
    yield "Identifying slide structure templates…", None
    yield "Scoring CTA effectiveness across samples…", None
    strategy = await extract_strategy(brand_summary, trending_videos, tiktok)

    yield "Analyzing reference TikTok content…", None
    yield "Building audience engagement model…", None
    yield "Writing strategy context to GBrain memory…", None

    yield "Generating personal.md profile…", None
    personal_md = _build_personal_md(website, description, audience, tiktok)

    yield "Selecting optimal carousel template…", None
    slides = await generate_slides(strategy, brand_summary)

    yield "Pipeline complete — strategy ready.", {
        "strategy": strategy,
        "slides": slides,
        "personalMd": personal_md,
    }
