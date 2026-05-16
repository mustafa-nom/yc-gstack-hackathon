from __future__ import annotations
from typing import AsyncGenerator, List, Optional
from scraper import scrape_website
from apify_mock import get_trending_videos
from claude_client import analyze_brand, extract_strategy, generate_slides, generate_persona


def _build_personal_md(
    website: str,
    description: str,
    tiktok: str,
    website_content: str,
    brand_summary: str,
    strategy: dict,
    slides: List[dict],
) -> str:
    slide_lines = "\n".join(
        f"  {s['number']}. **{s['headline']}** — {s['body']}" for s in slides
    )
    scraped_section = (
        f"## Scraped Website Content\n\n```\n{website_content[:2000]}\n```\n"
        if website_content and website_content != "Could not fetch website content."
        else ""
    )
    return "\n".join(filter(None, [
        "# Personal Profile",
        "",
        "## Product",
        f"- **Website:** {website}",
        f"- **Description:** {description or 'Not provided'}",
        f"- **Reference TikTok:** {tiktok or 'Not provided'}",
        "",
        scraped_section,
        "## Brand Summary",
        "",
        brand_summary,
        "",
        "## Content Strategy",
        "",
        f"- **Hook Pattern:** {strategy.get('hookPattern', '')}",
        f"- **Slide Structure:** {strategy.get('slideStructure', '')}",
        f"- **CTA Style:** {strategy.get('ctaStyle', '')}",
        f"- **Niche Score:** {strategy.get('nicheScore', '')} / 100",
        "",
        "## Carousel Script",
        "",
        slide_lines,
        "",
    ]))


async def run_pipeline(
    website: str, description: str, tiktok: str
) -> AsyncGenerator[tuple[str, Optional[dict]], None]:
    yield "Initializing agent pipeline…", None

    yield "Crawling product website…", None
    website_content = await scrape_website(website)

    yield "Analyzing brand positioning…", None
    brand_summary = await analyze_brand(website_content, description)

    yield "Fetching trending videos via Apify…", None
    trending_videos = get_trending_videos()

    yield "Extracting hook patterns from high-performers…", None
    yield "Identifying slide structure templates…", None
    yield "Scoring CTA effectiveness across samples…", None
    strategy = await extract_strategy(brand_summary, trending_videos, tiktok)

    yield "Analyzing reference TikTok content…", None
    yield "Building audience engagement model…", None
    yield "Writing strategy context to GBrain memory…", None

    yield "Generating creator persona…", None
    persona = await generate_persona(brand_summary, strategy, tiktok)

    yield "Generating personal.md profile…", None

    yield "Selecting optimal carousel template…", None
    slides = await generate_slides(strategy, brand_summary)

    personal_md = _build_personal_md(website, description, tiktok, website_content, brand_summary, strategy, slides)

    yield "Pipeline complete — strategy ready.", {
        "strategy": strategy,
        "slides": slides,
        "persona": persona,
        "personalMd": personal_md,
    }
