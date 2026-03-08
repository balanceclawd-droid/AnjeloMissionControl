-- Intelligence Dashboard: Initial Schema
-- Migrated from SQLite to PostgreSQL/Supabase

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  vertical TEXT NOT NULL CHECK (vertical IN ('trading_platform', 'gaming_web3')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_metrics (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id),
  week_ending TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  niche TEXT NOT NULL,
  platform TEXT NOT NULL,
  account_url TEXT,
  tracked_type TEXT NOT NULL DEFAULT 'specific' CHECK (tracked_type IN ('specific', 'niche_broad')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitive_posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  competitor_id BIGINT NOT NULL REFERENCES competitors(id),
  platform TEXT NOT NULL,
  post_url TEXT,
  content TEXT,
  posted_at TEXT NOT NULL,
  engagement_metrics JSONB NOT NULL DEFAULT '{}',
  hook_type TEXT,
  hook_text TEXT,
  structure TEXT,
  cta_type TEXT,
  visual_type TEXT,
  visual_description TEXT,
  engagement_score REAL DEFAULT 0,
  flagged_as_pattern BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patterns (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  niche TEXT NOT NULL,
  hook_type TEXT NOT NULL,
  structure TEXT NOT NULL,
  cta_type TEXT NOT NULL,
  pattern_description TEXT,
  post_ids JSONB NOT NULL DEFAULT '[]',
  first_detected TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  competitor_count INTEGER DEFAULT 0,
  avg_engagement_score REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'emerging' CHECK (status IN ('emerging', 'active', 'declining', 'dormant'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_type TEXT NOT NULL,
  pattern_id BIGINT REFERENCES patterns(id),
  niche TEXT,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed BOOLEAN DEFAULT false
);

-- Seed data

INSERT INTO clients (name, vertical) VALUES
  ('AlphaSwap Exchange', 'trading_platform'),
  ('PixelRealm Gaming', 'gaming_web3');

INSERT INTO weekly_metrics (client_id, week_ending, metric_type, data) VALUES
  (1, '2026-03-01', 'trading_platform', '{"onboarded_users":1250,"daily_volume":{"mon":4500000,"tue":5200000,"wed":4800000,"thu":5100000,"fri":6200000,"sat":3800000,"sun":3200000},"retention_day1":72.5,"retention_day7":41.2,"referral_source":"Twitter campaigns","notes":"Strong week - new token listing drove volume spike on Friday"}'),
  (1, '2026-02-22', 'trading_platform', '{"onboarded_users":980,"daily_volume":{"mon":3900000,"tue":4100000,"wed":4300000,"thu":4000000,"fri":5100000,"sat":3200000,"sun":2800000},"retention_day1":68.3,"retention_day7":38.7,"referral_source":"Organic + KOL partnerships","notes":"Slightly down from prior week but retention improving"}'),
  (2, '2026-03-01', 'gaming_web3', '{"twitter":{"followers":45200,"engagement_rate":4.8,"likes":3200,"comments":890,"impressions":125000},"tiktok":{"followers":128000,"engagement_rate":7.2,"likes":45000,"comments":2100,"views":890000},"instagram":{"followers":32100,"engagement_rate":3.1,"likes":1800,"comments":340,"impressions":67000},"youtube":{"followers":18500,"engagement_rate":5.5,"likes":2200,"comments":450,"views":156000}}'),
  (2, '2026-02-22', 'gaming_web3', '{"twitter":{"followers":43800,"engagement_rate":4.2,"likes":2900,"comments":780,"impressions":112000},"tiktok":{"followers":121000,"engagement_rate":6.8,"likes":41000,"comments":1800,"views":820000},"instagram":{"followers":31200,"engagement_rate":2.9,"likes":1600,"comments":290,"impressions":61000},"youtube":{"followers":17800,"engagement_rate":5.1,"likes":1900,"comments":380,"views":141000}}');

INSERT INTO competitors (name, niche, platform, account_url, tracked_type) VALUES
  ('BinanceUS', 'CEX', 'twitter', 'https://twitter.com/BinanceUS', 'specific'),
  ('Uniswap', 'DEX', 'twitter', 'https://twitter.com/Uniswap', 'specific'),
  ('AxieInfinity', 'Gaming', 'twitter', 'https://twitter.com/AxieInfinity', 'niche_broad');

INSERT INTO competitive_posts (competitor_id, platform, post_url, content, posted_at, engagement_metrics, hook_type, hook_text, structure, cta_type, visual_type, visual_description, engagement_score, flagged_as_pattern, notes) VALUES
  (1, 'twitter', 'https://twitter.com/BinanceUS/status/1', '🚨 BREAKING: Zero-fee trading is LIVE for 5 new pairs. Your move, traders.', '2026-03-05', '{"likes":4500,"comments":890,"views":245000}', 'urgency', 'BREAKING: Zero-fee trading is LIVE', 'setup_payoff', 'link_click', 'image', 'Bold red/black graphic with coin pairs listed', 82, true, 'High engagement - urgency + value prop combo'),
  (1, 'twitter', 'https://twitter.com/BinanceUS/status/2', 'Most traders lose money because they skip this one step... 🧵 Thread on risk management that saved our top users.', '2026-03-03', '{"likes":3200,"comments":1200,"views":189000}', 'curiosity_gap', 'Most traders lose money because they skip this one step', 'educational', 'reply', 'text_only', 'Thread format, no visual', 78, true, 'Thread format drives high comments'),
  (2, 'twitter', 'https://twitter.com/Uniswap/status/1', 'Over $2T in cumulative volume. Built different. What are you swapping today?', '2026-03-04', '{"likes":8900,"comments":2100,"views":520000}', 'authority', 'Over $2T in cumulative volume', 'setup_payoff', 'reply', 'image', 'Milestone infographic with volume chart', 91, true, 'Authority hook + milestone = massive engagement'),
  (2, 'twitter', 'https://twitter.com/Uniswap/status/2', '3 reasons DeFi will eat CeFi in 2026. Reason #2 will surprise you 👀', '2026-03-02', '{"likes":5600,"comments":1800,"views":310000}', 'curiosity_gap', 'Reason #2 will surprise you', 'educational', 'reply', 'carousel', '3-slide carousel with stats per reason', 85, true, 'Listicle + curiosity gap = consistent formula'),
  (3, 'twitter', 'https://twitter.com/AxieInfinity/status/1', 'POV: You just earned $500 playing games this week. Our top players are living the dream. Ready to join?', '2026-03-06', '{"likes":6200,"comments":3400,"views":410000}', 'social_proof', 'You just earned $500 playing games this week', 'storytelling', 'link_click', 'video', 'Short gameplay montage with earnings overlay', 88, false, 'Social proof + aspirational story drives DMs');

INSERT INTO patterns (niche, hook_type, structure, cta_type, pattern_description, post_ids, first_detected, last_seen, competitor_count, avg_engagement_score, status) VALUES
  ('CEX', 'curiosity_gap', 'educational', 'reply', 'Curiosity gap hooks paired with educational threads driving high reply engagement across CEX and DEX niches', '[2, 4]', '2026-03-02', '2026-03-03', 2, 81.5, 'emerging'),
  ('DEX', 'authority', 'setup_payoff', 'reply', 'Authority/milestone hooks with setup-payoff structure generating viral engagement in DeFi space', '[3]', '2026-03-04', '2026-03-04', 1, 91.0, 'active');

INSERT INTO alerts (alert_type, pattern_id, niche, severity, message) VALUES
  ('pattern_emerging', 1, 'CEX', 'medium', 'New pattern detected: Curiosity gap + educational thread combo gaining traction across 2 competitors in CEX/DEX niches. Avg engagement score: 81.5'),
  ('engagement_spike', 2, 'DEX', 'high', 'High engagement alert: Authority hook pattern by Uniswap scored 91/100. Monitor for replication by other DEX competitors.'),
  ('niche_trend', NULL, 'Gaming', 'low', 'Trending: Social proof + storytelling format gaining momentum in Gaming niche. AxieInfinity leading adoption.');
