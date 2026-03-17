-- Reddit Intelligence: subreddits, posts, and trending topics
-- Idempotent migration

CREATE TABLE IF NOT EXISTS reddit_subreddits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subreddit TEXT NOT NULL UNIQUE,
  niche TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reddit_posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subreddit_id BIGINT REFERENCES reddit_subreddits(id) ON DELETE CASCADE,
  reddit_post_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  permalink TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  upvote_ratio FLOAT NOT NULL DEFAULT 0,
  num_comments INTEGER NOT NULL DEFAULT 0,
  created_utc TIMESTAMPTZ NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  flair TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive','negative','neutral')),
  topics TEXT[]
);

CREATE INDEX IF NOT EXISTS reddit_posts_subreddit_created_idx ON reddit_posts (subreddit_id, created_utc DESC);
CREATE INDEX IF NOT EXISTS reddit_posts_score_idx ON reddit_posts (score DESC);

CREATE TABLE IF NOT EXISTS reddit_trending (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  niche TEXT NOT NULL,
  topic TEXT NOT NULL,
  mention_count INTEGER NOT NULL DEFAULT 1,
  avg_score FLOAT NOT NULL DEFAULT 0,
  sample_titles JSONB NOT NULL DEFAULT '[]',
  trend_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (niche, topic, trend_date)
);

CREATE INDEX IF NOT EXISTS reddit_trending_niche_date_idx ON reddit_trending (niche, trend_date DESC);

-- Seed subreddits
INSERT INTO reddit_subreddits (subreddit, niche) VALUES
  -- Gaming
  ('web3gaming', 'Gaming'),
  ('NFTGaming', 'Gaming'),
  ('PlayToEarn', 'Gaming'),
  ('gamefi', 'Gaming'),
  ('PokemonTCG', 'Gaming'),
  ('sportscards', 'Gaming'),
  ('MarbleLeague', 'Gaming'),
  ('SorareFC', 'Gaming'),
  ('NBATopShot', 'Gaming'),
  ('FantasyPL', 'Gaming'),
  ('pathofexile', 'Gaming'),
  ('hearthstone', 'Gaming'),
  -- DEX
  ('UniSwap', 'DEX'),
  ('SushiSwap', 'DEX'),
  -- DeFi
  ('defi', 'DeFi'),
  ('algotrading', 'DeFi'),
  ('ai_trading', 'DeFi'),
  ('ethereum', 'DeFi'),
  -- CEX
  ('CryptoCurrency', 'CEX'),
  ('CryptoMarkets', 'CEX'),
  ('Trading', 'CEX'),
  ('Daytrading', 'CEX'),
  ('options', 'CEX'),
  ('Forex', 'CEX'),
  ('stocks', 'CEX'),
  -- Memecoin
  ('memecoins', 'Memecoin'),
  ('solana', 'Memecoin'),
  -- General
  ('web3', 'General')
ON CONFLICT (subreddit) DO NOTHING;
