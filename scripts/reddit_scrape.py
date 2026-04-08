#!/usr/bin/env python3
"""
Reddit scraper — runs locally on Mac mini, posts results to Mission Control.
Temporary implementation uses Reddit's public JSON endpoints, which may be blocked.
This script now reports source blocking clearly so the failure is diagnosable.
"""

import json
import time
import random
import urllib.request
import urllib.error
from datetime import datetime, timezone

MISSION_CONTROL_URL = "https://anjelo-mission-control.vercel.app"

# Rotate user agents to avoid detection
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]

SUBREDDITS = [
    # CEX
    {"subreddit": "CryptoCurrency", "niche": "CEX"},
    {"subreddit": "CryptoMarkets", "niche": "CEX"},
    {"subreddit": "Daytrading", "niche": "CEX"},
    {"subreddit": "Trading", "niche": "CEX"},
    # DeFi / AI Trading (Milo)
    {"subreddit": "ai_trading", "niche": "DeFi"},
    {"subreddit": "algotrading", "niche": "DeFi"},
    {"subreddit": "defi", "niche": "DeFi"},
    {"subreddit": "ethereum", "niche": "DeFi"},
    # Gaming (Marbula)
    {"subreddit": "gamefi", "niche": "Gaming"},
    {"subreddit": "MarbleLeague", "niche": "Gaming"},
    {"subreddit": "NFTGaming", "niche": "Gaming"},
    {"subreddit": "PlayToEarn", "niche": "Gaming"},
    {"subreddit": "web3gaming", "niche": "Gaming"},
    # General
    {"subreddit": "web3", "niche": "General"},
    {"subreddit": "memecoins", "niche": "Memecoin"},
    {"subreddit": "solana", "niche": "Memecoin"},
]

def fetch_subreddit(subreddit: str, limit: int = 25, retries: int = 3) -> tuple[list, str | None]:
    # Try old.reddit.com first (lighter anti-bot), fall back to www.reddit.com
    urls = [
        f"https://old.reddit.com/r/{subreddit}/top.json?t=day&limit={limit}",
        f"https://www.reddit.com/r/{subreddit}/top.json?t=day&limit={limit}",
    ]
    for attempt in range(retries):
        url = urls[0] if attempt < 2 else urls[1]  # try old.reddit first
        try:
            ua = random.choice(USER_AGENTS)
            req = urllib.request.Request(url, headers={
                "User-Agent": ua,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "no-cache",
            })
            resp = urllib.request.urlopen(req, timeout=15)
            data = json.loads(resp.read())
            return data.get("data", {}).get("children", []), None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 10 * (attempt + 1)
                print(f"  ⚠ Rate limited r/{subreddit} — waiting {wait}s")
                time.sleep(wait)
            elif e.code == 403:
                wait = 5 * (attempt + 1)
                print(f"  ⚠ 403 r/{subreddit} — Reddit public JSON blocked, waiting {wait}s (attempt {attempt+1}/{retries})")
                time.sleep(wait)
            else:
                print(f"  ⚠ HTTP {e.code} r/{subreddit}")
                return [], f"HTTP {e.code}"
        except Exception as e:
            print(f"  ⚠ Failed r/{subreddit}: {e}")
            return [], str(e)
    print(f"  ✗ Gave up on r/{subreddit} after {retries} attempts")
    return [], "Reddit public JSON blocked or unavailable"

def post_to_mission_control(endpoint: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{MISSION_CONTROL_URL}{endpoint}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()[:200]}"}
    except Exception as e:
        return {"error": str(e)}

def main():
    print(f"Reddit scrape — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 50)

    total_posts = 0
    total_inserted = 0
    total_trends = 0
    cutoff = time.time() - 48 * 3600  # last 48h

    for sub_config in SUBREDDITS:
        sub = sub_config["subreddit"]
        niche = sub_config["niche"]

        print(f"\n→ r/{sub} ({niche})")
        children, fetch_error = fetch_subreddit(sub, limit=25)

        if fetch_error:
            print(f"  ⚠ Source error: {fetch_error}")

        posts = []
        for child in children:
            item = child.get("data", {})
            if not item or item.get("stickied"):
                continue
            created_utc = item.get("created_utc", 0)
            if created_utc < cutoff:
                continue
            if item.get("over_18"):
                continue

            comments = item.get("num_comments", 0)
            body = item.get("selftext", "") or ""
            is_self = item.get("is_self", False)

            if not is_self and comments < 3:
                continue
            if is_self and len(body) < 30 and comments < 3:
                continue

            posts.append({
                "id": item.get("id", ""),
                "title": item.get("title", ""),
                "body": body,
                "author": item.get("author", ""),
                "url": item.get("url", ""),
                "permalink": f"https://reddit.com{item.get('permalink', '')}",
                "score": item.get("score", 0),
                "upvote_ratio": item.get("upvote_ratio", 0),
                "num_comments": comments,
                "created_utc": datetime.fromtimestamp(created_utc, tz=timezone.utc).isoformat(),
                "flair": item.get("link_flair_text"),
                "subreddit": sub,
                "niche": niche,
            })

        total_posts += len(posts)
        print(f"  Found {len(posts)} posts")

        if not posts:
            continue

        # Post to Mission Control ingest endpoint
        result = post_to_mission_control("/api/reddit/ingest", {
            "subreddit": sub,
            "niche": niche,
            "posts": posts,
        })

        inserted = result.get("posts_inserted", result.get("inserted", 0))
        trends = result.get("trends_detected", 0)
        total_inserted += inserted
        total_trends += trends
        print(f"  ✓ Inserted: {inserted} posts, {trends} trends")

        if result.get("error"):
            print(f"  ⚠ Error: {result['error']}")

        time.sleep(random.uniform(2, 4))  # random delay to avoid detection

    print(f"\n{'=' * 50}")
    print(f"Done — {total_posts} fetched, {total_inserted} inserted, {total_trends} trends")

if __name__ == "__main__":
    main()
