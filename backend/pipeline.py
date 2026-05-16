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
    resolved_url: str | None,
    brand_summary: str,
    strategy: dict,
    slides: List[dict],
) -> str:
    slide_lines = "\n".join(
        f"  {s['number']}. **{s['headline']}** — {s['body']}" for s in slides
    )

    if resolved_url and website_content and website_content != "Could not fetch website content.":
        resolved_line = (
            f"- **Resolved URL:** {resolved_url}"
            if resolved_url.rstrip("/") != website.rstrip("/")
            else None
        )
        scraped_section = (
            f"## Scraped Website Content\n\n```\n{website_content[:2000]}\n```\n"
        )
    else:
        resolved_line = "- **Scrape Status:** ⚠ Could not fetch website content"
        scraped_section = ""

    return "\n".join(filter(None, [
        "# Personal Profile",
        "",
        "## Product",
        f"- **Website:** {website}",
        resolved_line,
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
    website_content, resolved_url = await scrape_website(website)
    scrape_ok = resolved_url is not None

    if scrape_ok and resolved_url and resolved_url.rstrip("/") != website.rstrip("/"):
        yield f"Resolved to {resolved_url}", None
    elif not scrape_ok:
        yield "⚠ Could not fetch website — falling back to description.", None

    yield "Analyzing brand positioning…", None
    brand_summary = await analyze_brand(
        website_content, description, scrape_ok=scrape_ok, website=website
    )

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

    yield "Generating persona.md profile…", None

    yield "Selecting optimal carousel template…", None
    slides = await generate_slides(strategy, brand_summary, scrape_ok=scrape_ok)

    personal_md = _build_personal_md(
        website, description, tiktok, website_content, resolved_url,
        brand_summary, strategy, slides,
    )

    yield "Pipeline complete — strategy ready.", {
        "strategy": strategy,
        "slides": slides,
        "persona": persona,
        "personalMd": personal_md,
    }
