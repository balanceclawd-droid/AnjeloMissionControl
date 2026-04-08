-- Browser-sourced Reddit leads for manual/semi-manual opportunity collection

CREATE TABLE IF NOT EXISTS reddit_browser_leads (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subreddit TEXT NOT NULL,
  niche TEXT NOT NULL DEFAULT 'General',
  title TEXT NOT NULL,
  permalink TEXT NOT NULL,
  author TEXT,
  snippet TEXT NOT NULL DEFAULT '',
  score_text TEXT,
  comment_count INTEGER NOT NULL DEFAULT 0,
  posted_at_text TEXT,
  opportunity_type TEXT NOT NULL DEFAULT 'general' CHECK (opportunity_type IN ('question','pain_point','recommendation_request','education','general')),
  matched_keywords TEXT[] NOT NULL DEFAULT '{}',
  relevance_score FLOAT NOT NULL DEFAULT 0,
  source_query TEXT,
  source_kind TEXT NOT NULL DEFAULT 'browser' CHECK (source_kind IN ('browser','manual')),
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (permalink)
);

CREATE INDEX IF NOT EXISTS reddit_browser_leads_relevance_idx ON reddit_browser_leads (relevance_score DESC, collected_at DESC);
CREATE INDEX IF NOT EXISTS reddit_browser_leads_niche_idx ON reddit_browser_leads (niche, collected_at DESC);
CREATE INDEX IF NOT EXISTS reddit_browser_leads_subreddit_idx ON reddit_browser_leads (subreddit, collected_at DESC);
