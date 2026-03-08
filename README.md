# Intelligence Dashboard

Client Performance & Competitive Intelligence Dashboard built with Next.js 14, TypeScript, Tailwind CSS, and SQLite.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The SQLite database is auto-created on first run at `data/intelligence.db` with seed data (2 clients, 3 competitors, 5 posts, 2 patterns, 3 alerts).

## Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (dark theme)
- **Database**: SQLite via better-sqlite3
- **Charts**: Recharts

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard - alerts, client grid, top patterns |
| `/clients` | Client list + add client |
| `/clients/[id]` | Client detail with charts |
| `/clients/[id]/submit` | Weekly metric submission form |
| `/competitors` | Competitor list + add competitor |
| `/competitors/[id]` | Competitor detail + posts |
| `/posts` | All competitive posts + add post |
| `/patterns` | Pattern library (filterable) |
| `/alerts` | All alerts |

## Architecture

- **Layer 1**: Client tracking (trading platforms + gaming/web3 social metrics)
- **Layer 2**: Competitive intelligence (manual post logging with content analysis)
- **Layer 3**: Pattern detection engine (auto-detects recurring hook+structure+CTA combos)
- **Layer 4**: Intelligence dashboard (real-time alerts, pattern library, client performance grid)
