-- Mission Control: schema alignment + safety constraints
-- Idempotent migration intended to catch repo schema up to live app usage.

-- 1) Clients: support newer verticals + twitter_url
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS twitter_url TEXT;

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_vertical_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_vertical_check
  CHECK (vertical IN ('trading_platform', 'gaming_web3', 'ai_trading', 'cex', 'defi', 'nft', 'social', 'other'));

-- 2) Alerts: allow critical severity used by app logic
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_severity_check;
ALTER TABLE alerts
  ADD CONSTRAINT alerts_severity_check
  CHECK (severity IN ('low', 'medium', 'high', 'critical'));

-- 3) competitive_posts: add sync-related columns used by Twitter ingestion
ALTER TABLE competitive_posts
  ADD COLUMN IF NOT EXISTS twitter_post_id TEXT,
  ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversation_depth INTEGER DEFAULT 0;

-- Unique tweet identity per competitor (supports safe dedupe)
CREATE UNIQUE INDEX IF NOT EXISTS competitive_posts_competitor_twitter_post_uidx
  ON competitive_posts (competitor_id, twitter_post_id)
  WHERE twitter_post_id IS NOT NULL;

-- Helpful query indexes
CREATE INDEX IF NOT EXISTS weekly_metrics_client_week_submitted_idx
  ON weekly_metrics (client_id, week_ending DESC, submitted_at DESC);

CREATE INDEX IF NOT EXISTS competitive_posts_competitor_posted_idx
  ON competitive_posts (competitor_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS alerts_created_dismissed_idx
  ON alerts (dismissed, created_at DESC);

-- 4) Client Twitter snapshots table used by dashboard + cron sync
CREATE TABLE IF NOT EXISTS client_twitter_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  followers_count INTEGER NOT NULL DEFAULT 0,
  tweet_count INTEGER NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_twitter_snapshots_client_date_uidx
  ON client_twitter_snapshots (client_id, snapshot_date);

CREATE INDEX IF NOT EXISTS client_twitter_snapshots_client_snapshot_idx
  ON client_twitter_snapshots (client_id, snapshot_date DESC);

-- 5) RLS hardening scaffold
-- NOTE: enabling RLS without policies/auth changes will break the current app.
-- Keep commented until auth model is upgraded properly.
-- ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE weekly_metrics ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE competitive_posts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE client_twitter_snapshots ENABLE ROW LEVEL SECURITY;
