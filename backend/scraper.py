from __future__ import annotations
from urllib.parse import urlparse, urlunparse
import httpx
from bs4 import BeautifulSoup

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}
_MAX_CHARS = 4000
_TLD_FALLBACKS = (".com", ".ai", ".io", ".co", ".app", ".dev", ".xyz")


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

    # If the host has a recognizable TLD, also try swapping it.
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

    # Dedupe while preserving order.
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
    """Returns the first reachable variant of url, or None."""
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
            # Some sites refuse HEAD; fall back to GET.
            if await _try_fetch(client, candidate):
                return candidate
    return None


async def scrape_website(url: str) -> tuple[str, str | None]:
    """Returns (content, resolved_url). resolved_url is None if all attempts failed."""
    candidates = _candidate_urls(url)
    if not candidates:
        return "Could not fetch website content.", None

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        html: str | None = None
        resolved: str | None = None
        for candidate in candidates:
            html = await _try_fetch(client, candidate)
            if html:
                resolved = candidate
                break

    if not html:
        return "Could not fetch website content.", None

    soup = BeautifulSoup(html, "html.parser")
    parts: list[str] = []

    title = soup.find("title")
    if title:
        parts.append(title.get_text(strip=True))

    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        parts.append(meta_desc["content"])

    for tag in soup.find_all(["h1", "h2", "h3", "p"]):
        text = tag.get_text(strip=True)
        if text:
            parts.append(text)

    combined = "\n".join(parts)
    return combined[:_MAX_CHARS] or "Could not fetch website content.", resolved
