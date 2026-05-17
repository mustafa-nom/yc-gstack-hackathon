#!/usr/bin/env python3
"""
Scrape a TikTok account and return the top N posts by view count.

Uses yt-dlp (no browser, no bot detection) to list post IDs, then fetches
view counts from each post page's __UNIVERSAL_DATA_FOR_REHYDRATION__ script tag.

Usage:
    python scrape_tiktok_account.py --url https://www.tiktok.com/@chey.jada --top 7
    python scrape_tiktok_account.py --url @chey.jada --top 7 --json
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
_DATA_RE = re.compile(
    r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.+?)</script>',
    re.DOTALL,
)


def normalize_url(url: str) -> tuple[str, str]:
    """Return (account_url, handle)."""
    url = url.strip().rstrip("/")
    if url.startswith("@"):
        handle = url.lstrip("@")
        return f"https://www.tiktok.com/@{handle}", handle
    if not url.startswith("http"):
        handle = url.lstrip("@")
        return f"https://www.tiktok.com/@{handle}", handle
    # Extract handle from URL
    m = re.search(r"tiktok\.com/@([^/?#]+)", url)
    handle = m.group(1) if m else url.split("/")[-1].lstrip("@")
    return url if url.startswith("http") else f"https://www.tiktok.com/@{handle}", handle


def list_post_ids(account_url: str, limit: int = 50) -> list[str]:
    """Use yt-dlp flat-playlist to get recent post IDs without triggering bot detection."""
    try:
        result = subprocess.run(
            [
                "yt-dlp",
                "--flat-playlist",
                "--no-warnings",
                "--print", "%(id)s",
                "--playlist-items", f"1:{limit}",
                account_url,
            ],
            capture_output=True, text=True, timeout=90,
        )
    except subprocess.TimeoutExpired:
        print("yt-dlp timed out", file=sys.stderr)
        return []
    except FileNotFoundError:
        print("yt-dlp not found — install with: pip install yt-dlp", file=sys.stderr)
        return []

    if result.returncode != 0:
        print(f"yt-dlp failed: {result.stderr.strip()[:300]}", file=sys.stderr)
        return []

    ids = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return ids


def fetch_post_views(handle: str, video_id: str) -> dict:
    """Fetch view count for a single post by scraping its page."""
    # TikTok posts can be /video/ or /photo/ — try video first, fall back to photo
    for path in ("video", "photo"):
        url = f"https://www.tiktok.com/@{handle}/{path}/{video_id}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": _UA})
            html = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", errors="ignore")
        except Exception:
            continue

        m = _DATA_RE.search(html)
        if not m:
            continue

        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue

        item = (
            data.get("__DEFAULT_SCOPE__", {})
            .get("webapp.video-detail", {})
            .get("itemInfo", {})
            .get("itemStruct", {})
        )
        if not item:
            continue

        stats = item.get("stats") or item.get("statsV2") or {}

        def _int(x):
            try:
                return int(x)
            except (TypeError, ValueError):
                return 0

        views = _int(stats.get("playCount"))
        post_url = f"https://www.tiktok.com/@{handle}/{path}/{video_id}"

        # Determine if it's a photo/slideshow post
        is_photo = bool(item.get("imagePost"))
        post_type = "photo" if is_photo else "video"

        return {
            "id": video_id,
            "url": post_url,
            "views": views,
            "likes": _int(stats.get("diggCount")),
            "type": post_type,
            "views_raw": f"{views:,}",
        }

    return {"id": video_id, "url": None, "views": 0, "type": "unknown", "views_raw": "0"}


def scrape_top_posts(account_url: str, handle: str, top_n: int = 7, fetch_limit: int = 50) -> list[dict]:
    print(f"Fetching post IDs from {account_url}...", file=sys.stderr)
    ids = list_post_ids(account_url, limit=fetch_limit)

    if not ids:
        print("No post IDs found.", file=sys.stderr)
        return []

    print(f"Found {len(ids)} posts. Fetching view counts...", file=sys.stderr)

    posts = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch_post_views, handle, vid): vid for vid in ids}
        for future in as_completed(futures):
            result = future.result()
            if result.get("url"):
                posts.append(result)

    posts.sort(key=lambda p: p["views"], reverse=True)
    top = posts[:top_n]

    print(f"Top {len(top)} posts by views:", file=sys.stderr)
    for i, p in enumerate(top, 1):
        print(f"  #{i} ({p['views_raw']} views, {p['type']}): {p['url']}", file=sys.stderr)

    return top


def main():
    parser = argparse.ArgumentParser(description="Scrape top TikTok posts from an account")
    parser.add_argument("--url", required=True, help="TikTok account URL or @handle")
    parser.add_argument("--top", type=int, default=7, help="Number of top posts to return (default: 7)")
    parser.add_argument("--fetch", type=int, default=50, help="How many recent posts to scan (default: 50)")
    parser.add_argument("--json", action="store_true", dest="as_json", help="Output full JSON instead of plain URLs")
    args = parser.parse_args()

    account_url, handle = normalize_url(args.url)
    posts = scrape_top_posts(account_url, handle, top_n=args.top, fetch_limit=args.fetch)

    if not posts:
        sys.exit(1)

    if args.as_json:
        print(json.dumps(posts, indent=2))
    else:
        for p in posts:
            print(p["url"])


if __name__ == "__main__":
    main()
