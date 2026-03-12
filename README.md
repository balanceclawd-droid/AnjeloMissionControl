# Intelligence Dashboard

Client Performance & Competitive Intelligence Dashboard built with Next.js 14, TypeScript, Tailwind CSS, and Supabase (PostgreSQL).

## Setup

### 1. Supabase Database

1. Create a [Supabase](https://supabase.com) project (or use an existing one).
2. Run the migration in the Supabase SQL Editor:
   - Open `supabase/migrations/001_initial_schema.sql`
   - Paste and execute it in **SQL Editor → New Query** in your Supabase dashboard.
   - This creates all tables and inserts seed data.

### 2. Environment Variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Set the values in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-admin-password

# Optional: LLM-assisted competitive post classification
LLM_CLASSIFIER_BASE_URL=https://api.openai.com/v1
LLM_CLASSIFIER_API_KEY=your-openai-compatible-key
LLM_CLASSIFIER_MODEL=gpt-4o-mini
LLM_CLASSIFIER_TIMEOUT_MS=12000
```

`ADMIN_USERNAME` and `ADMIN_PASSWORD` enable HTTP Basic Auth via `middleware.ts`.
If they are not set, the app stays open. Once set in Vercel/local envs, the whole app and API require login.

### LLM Classification

The dashboard now supports server-side LLM classification for competitive posts using an OpenAI-compatible `/chat/completions` endpoint.

- If `LLM_CLASSIFIER_BASE_URL`, `LLM_CLASSIFIER_API_KEY`, and `LLM_CLASSIFIER_MODEL` are set, synced and reclassified posts will try the LLM first.
- If any of those env vars are missing, or the LLM request fails/times out, the app automatically falls back to the built-in heuristic classifier.
- `LLM_CLASSIFIER_TIMEOUT_MS` is optional and defaults to `12000`.

### Reclassify Existing Posts

You can re-run classification for existing posts with:

```bash
curl -X POST http://localhost:3000/api/posts/reclassify \
  -H "Content-Type: application/json" \
  -d '{"force":true,"limit":250,"refreshPatterns":true}'
```

Request body options:

- `force` — reclassify posts even if they already have classifications
- `limit` — max posts to scan (default `500`, capped at `1000`)
- `refreshPatterns` — rerun pattern detection after reclassification (default `true`)
- `competitorId` — optional competitor filter

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploying to Vercel

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables in your Vercel project settings.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (dark theme)
- **Database**: Supabase (PostgreSQL)
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
