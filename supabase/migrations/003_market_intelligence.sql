-- Market Intelligence: Research keywords, scraped posts, competitor suggestions, reports
-- Idempotent migration

-- 1) Keywords used to drive scraper queries
CREATE TABLE IF NOT EXISTS research_keywords (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  niche TEXT NOT NULL,
  keyword TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (niche, keyword)
);

-- 2) Raw posts ingested from the scraper
CREATE TABLE IF NOT EXISTS market_intelligence_posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  keyword_id BIGINT REFERENCES research_keywords(id) ON DELETE SET NULL,
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  tweet_url TEXT NOT NULL DEFAULT '',
  likes INTEGER NOT NULL DEFAULT 0,
  retweets INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 0 CHECK (engagement_score BETWEEN 0 AND 100),
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT ''
);

-- Unique on tweet_url (if present) — prevent duplicate ingestion
CREATE UNIQUE INDEX IF NOT EXISTS market_intelligence_posts_tweet_url_uidx
  ON market_intelligence_posts (tweet_url)
  WHERE tweet_url IS NOT NULL AND tweet_url != '';

-- Index for efficient per-handle lookups (for suggestion detection)
CREATE INDEX IF NOT EXISTS market_intelligence_posts_handle_idx
  ON market_intelligence_posts (handle, scraped_at DESC);

-- 3) Accounts detected as potential competitors
CREATE TABLE IF NOT EXISTS competitor_suggestions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  niche TEXT NOT NULL DEFAULT 'Other',
  avg_engagement INTEGER NOT NULL DEFAULT 0,
  sample_post TEXT NOT NULL DEFAULT '',
  tweet_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'added', 'dismissed')),
  suggested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Generated daily/weekly reports
CREATE TABLE IF NOT EXISTS research_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly')),
  niche TEXT NOT NULL DEFAULT 'all',
  summary TEXT NOT NULL DEFAULT '',
  top_posts JSONB NOT NULL DEFAULT '[]',
  new_accounts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_reports_type_created_idx
  ON research_reports (report_type, created_at DESC);
