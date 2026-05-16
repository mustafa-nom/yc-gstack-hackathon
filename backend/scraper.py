from __future__ import annotations
import asyncio
import json
import re
from urllib.parse import urlparse, urlunparse, urljoin
import httpx
from bs4 import BeautifulSoup

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}
_MAX_CHARS_PER_PAGE = 3500
_MAX_TOTAL_CHARS = 12000
_MAX_SUBPAGES = 5
_TLD_FALLBACKS = (".com", ".ai", ".io", ".co", ".app", ".dev", ".xyz")

# Internal paths likely to contain high-signal info about a product brand.
_SUBPAGE_HINTS = (
    "/about", "/about-us", "/story", "/mission",
    "/features", "/product", "/products", "/how-it-works", "/how",
    "/pricing", "/plans",
    "/faq", "/faqs", "/help",
    "/testimonials", "/customers", "/case-studies", "/reviews",
    "/blog", "/resources",
    "/manifesto",
)


def _candidate_urls(raw: str) -> list[str]:
    raw = raw.strip()
    if not raw:
        return []

    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw

    parsed = urlparse(raw)
    host = parsed.netloc
    candidates: list[str] = [urlunparse(parsed)]

    if host and not host.startswith("www."):
        candidates.append(urlunparse(parsed._replace(netloc="www." + host)))

    for tld in _TLD_FALLBACKS:
        if host.endswith(tld):
            stem = host[: -len(tld)]
            for alt in _TLD_FALLBACKS:
                if alt == tld:
                    continue
                alt_host = stem + alt
                candidates.append(urlunparse(parsed._replace(netloc=alt_host)))
                if not alt_host.startswith("www."):
                    candidates.append(
                        urlunparse(parsed._replace(netloc="www." + alt_host))
                    )
            break

    seen: set[str] = set()
    return [c for c in candidates if not (c in seen or seen.add(c))]


async def _try_fetch(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        response = await client.get(url, headers=_HEADERS)
        response.raise_for_status()
        return response.text
    except Exception:
        return None


async def resolve_url(url: str) -> str | None:
    candidates = _candidate_urls(url)
    if not candidates:
        return None
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for candidate in candidates:
            try:
                resp = await client.head(candidate, headers=_HEADERS)
                if resp.status_code < 400:
                    return candidate
            except Exception:
                pass
            if await _try_fetch(client, candidate):
                return candidate
    return None


def _extract_visible_text(soup: BeautifulSoup, *, max_chars: int) -> str:
    parts: list[str] = []
    title = soup.find("title")
    if title:
        parts.append(title.get_text(strip=True))
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        parts.append(meta_desc["content"])
    for tag in soup.find_all(["h1", "h2", "h3", "li", "p"]):
        text = tag.get_text(strip=True)
        if text and len(text) > 3:
            parts.append(text)
    combined = "\n".join(parts)
    return combined[:max_chars]


def _extract_meta(soup: BeautifulSoup) -> dict:
    out: dict = {}
    title = soup.find("title")
    if title:
        out["title"] = title.get_text(strip=True)
    for meta_name in ("description", "keywords"):
        tag = soup.find("meta", attrs={"name": meta_name})
        if tag and tag.get("content"):
            out[meta_name] = tag["content"].strip()
    for prop in ("og:title", "og:description", "og:site_name", "og:type", "twitter:description"):
        tag = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            out[prop] = tag["content"].strip()
    return out


def _extract_jsonld(soup: BeautifulSoup) -> list[dict]:
    out: list[dict] = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except Exception:
            continue
        if isinstance(data, list):
            out.extend([d for d in data if isinstance(d, dict)])
        elif isinstance(data, dict):
            out.append(data)
    return out


def _extract_social_links(soup: BeautifulSoup, base_url: str) -> dict:
    socials: dict = {}
    patterns = {
        "twitter": re.compile(r"(?:twitter\.com|x\.com)/(?!share|intent)([^/?#]+)"),
        "instagram": re.compile(r"instagram\.com/([^/?#]+)"),
        "tiktok": re.compile(r"tiktok\.com/@?([^/?#]+)"),
        "linkedin": re.compile(r"linkedin\.com/(?:company|in)/([^/?#]+)"),
        "youtube": re.compile(r"youtube\.com/(?:@|channel/|c/)?([^/?#]+)"),
    }
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("/"):
            href = urljoin(base_url, href)
        for name, pat in patterns.items():
            if name in socials:
                continue
            m = pat.search(href)
            if m:
                socials[name] = href
    return socials


def _pick_subpages(soup: BeautifulSoup, base_url: str, limit: int) -> list[str]:
    base_host = urlparse(base_url).netloc
    found: list[tuple[str, int]] = []  # (url, priority)
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)
        if parsed.netloc and parsed.netloc != base_host:
            continue
        path = parsed.path.rstrip("/").lower()
        if not path or path == "/":
            continue
        if absolute in seen:
            continue
        for i, hint in enumerate(_SUBPAGE_HINTS):
            if path == hint or path.startswith(hint + "/") or path.endswith(hint):
                found.append((absolute, i))
                seen.add(absolute)
                break
    found.sort(key=lambda x: x[1])
    return [u for u, _ in found[:limit]]


async def scrape_website(url: str) -> tuple[str, str | None]:
    """Crawl the homepage plus a few high-signal internal pages.
    Returns (formatted_content, resolved_homepage_url).
    """
    candidates = _candidate_urls(url)
    if not candidates:
        return "Could not fetch website content.", None

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        # 1. Resolve the homepage.
        home_html: str | None = None
        resolved: str | None = None
        for candidate in candidates:
            home_html = await _try_fetch(client, candidate)
            if home_html:
                resolved = candidate
                break

        if not home_html or not resolved:
            return "Could not fetch website content.", None

        home_soup = BeautifulSoup(home_html, "html.parser")
        home_text = _extract_visible_text(home_soup, max_chars=_MAX_CHARS_PER_PAGE)
        meta = _extract_meta(home_soup)
        jsonld = _extract_jsonld(home_soup)
        socials = _extract_social_links(home_soup, resolved)
        subpage_urls = _pick_subpages(home_soup, resolved, _MAX_SUBPAGES)

        # 2. Crawl subpages in parallel.
        sub_htmls = await asyncio.gather(*[_try_fetch(client, u) for u in subpage_urls])

    sections: list[str] = []
    sections.append(f"# Homepage ({resolved})\n{home_text}")

    if meta:
        meta_lines = [f"- {k}: {v}" for k, v in meta.items()]
        sections.append("# Meta\n" + "\n".join(meta_lines))

    if socials:
        sections.append("# Social Links\n" + "\n".join(f"- {k}: {v}" for k, v in socials.items()))

    if jsonld:
        # Pull only useful fields from JSON-LD.
        compact_jsonld = []
        for entry in jsonld[:5]:
            kind = entry.get("@type")
            keep = {k: v for k, v in entry.items() if k in (
                "name", "description", "offers", "brand", "founder",
                "keywords", "audience", "category"
            )}
            if kind:
                keep["@type"] = kind
            if keep:
                compact_jsonld.append(keep)
        if compact_jsonld:
            sections.append("# Structured Data (JSON-LD)\n" + json.dumps(compact_jsonld, indent=2)[:1500])

    for sub_url, sub_html in zip(subpage_urls, sub_htmls):
        if not sub_html:
            continue
        sub_soup = BeautifulSoup(sub_html, "html.parser")
        sub_text = _extract_visible_text(sub_soup, max_chars=_MAX_CHARS_PER_PAGE)
        if sub_text.strip():
            label = urlparse(sub_url).path or sub_url
            sections.append(f"# {label}\n{sub_text}")

    combined = "\n\n".join(sections)
    return combined[:_MAX_TOTAL_CHARS], resolved
