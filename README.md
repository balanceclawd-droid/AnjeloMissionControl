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
```

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
