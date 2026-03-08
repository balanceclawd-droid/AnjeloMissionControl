import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'intelligence.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initializeSchema(db);
  return db;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      vertical TEXT NOT NULL CHECK(vertical IN ('trading_platform', 'gaming_web3')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weekly_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      week_ending TEXT NOT NULL,
      metric_type TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS competitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      niche TEXT NOT NULL,
      platform TEXT NOT NULL,
      account_url TEXT,
      tracked_type TEXT NOT NULL DEFAULT 'specific' CHECK(tracked_type IN ('specific', 'niche_broad')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS competitive_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      post_url TEXT,
      content TEXT,
      posted_at TEXT NOT NULL,
      engagement_metrics TEXT NOT NULL DEFAULT '{}',
      hook_type TEXT,
      hook_text TEXT,
      structure TEXT,
      cta_type TEXT,
      visual_type TEXT,
      visual_description TEXT,
      engagement_score REAL DEFAULT 0,
      flagged_as_pattern INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (competitor_id) REFERENCES competitors(id)
    );

    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      niche TEXT NOT NULL,
      hook_type TEXT NOT NULL,
      structure TEXT NOT NULL,
      cta_type TEXT NOT NULL,
      pattern_description TEXT,
      post_ids TEXT NOT NULL DEFAULT '[]',
      first_detected TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      competitor_count INTEGER DEFAULT 0,
      avg_engagement_score REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'emerging' CHECK(status IN ('emerging', 'active', 'declining', 'dormant'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL,
      pattern_id INTEGER,
      niche TEXT,
      severity TEXT NOT NULL DEFAULT 'low' CHECK(severity IN ('low', 'medium', 'high')),
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      dismissed INTEGER DEFAULT 0,
      FOREIGN KEY (pattern_id) REFERENCES patterns(id)
    );
  `);

  // Seed data if empty
  const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get() as { count: number };
  if (clientCount.count === 0) {
    seedData(db);
  }
}

function seedData(db: Database.Database) {
  // Clients
  db.prepare(`INSERT INTO clients (name, vertical) VALUES (?, ?)`).run('AlphaSwap Exchange', 'trading_platform');
  db.prepare(`INSERT INTO clients (name, vertical) VALUES (?, ?)`).run('PixelRealm Gaming', 'gaming_web3');

  // Weekly metrics for trading platform client
  const tradingMetrics = {
    onboarded_users: 1250,
    daily_volume: { mon: 4500000, tue: 5200000, wed: 4800000, thu: 5100000, fri: 6200000, sat: 3800000, sun: 3200000 },
    retention_day1: 72.5,
    retention_day7: 41.2,
    referral_source: 'Twitter campaigns',
    notes: 'Strong week - new token listing drove volume spike on Friday'
  };
  db.prepare(`INSERT INTO weekly_metrics (client_id, week_ending, metric_type, data) VALUES (?, ?, ?, ?)`).run(1, '2026-03-01', 'trading_platform', JSON.stringify(tradingMetrics));

  const tradingMetrics2 = {
    onboarded_users: 980,
    daily_volume: { mon: 3900000, tue: 4100000, wed: 4300000, thu: 4000000, fri: 5100000, sat: 3200000, sun: 2800000 },
    retention_day1: 68.3,
    retention_day7: 38.7,
    referral_source: 'Organic + KOL partnerships',
    notes: 'Slightly down from prior week but retention improving'
  };
  db.prepare(`INSERT INTO weekly_metrics (client_id, week_ending, metric_type, data) VALUES (?, ?, ?, ?)`).run(1, '2026-02-22', 'trading_platform', JSON.stringify(tradingMetrics2));

  // Weekly metrics for gaming client
  const gamingMetrics = {
    twitter: { followers: 45200, engagement_rate: 4.8, likes: 3200, comments: 890, impressions: 125000 },
    tiktok: { followers: 128000, engagement_rate: 7.2, likes: 45000, comments: 2100, views: 890000 },
    instagram: { followers: 32100, engagement_rate: 3.1, likes: 1800, comments: 340, impressions: 67000 },
    youtube: { followers: 18500, engagement_rate: 5.5, likes: 2200, comments: 450, views: 156000 }
  };
  db.prepare(`INSERT INTO weekly_metrics (client_id, week_ending, metric_type, data) VALUES (?, ?, ?, ?)`).run(2, '2026-03-01', 'gaming_web3', JSON.stringify(gamingMetrics));

  const gamingMetrics2 = {
    twitter: { followers: 43800, engagement_rate: 4.2, likes: 2900, comments: 780, impressions: 112000 },
    tiktok: { followers: 121000, engagement_rate: 6.8, likes: 41000, comments: 1800, views: 820000 },
    instagram: { followers: 31200, engagement_rate: 2.9, likes: 1600, comments: 290, impressions: 61000 },
    youtube: { followers: 17800, engagement_rate: 5.1, likes: 1900, comments: 380, views: 141000 }
  };
  db.prepare(`INSERT INTO weekly_metrics (client_id, week_ending, metric_type, data) VALUES (?, ?, ?, ?)`).run(2, '2026-02-22', 'gaming_web3', JSON.stringify(gamingMetrics2));

  // Competitors
  db.prepare(`INSERT INTO competitors (name, niche, platform, account_url, tracked_type) VALUES (?, ?, ?, ?, ?)`).run('BinanceUS', 'CEX', 'twitter', 'https://twitter.com/BinanceUS', 'specific');
  db.prepare(`INSERT INTO competitors (name, niche, platform, account_url, tracked_type) VALUES (?, ?, ?, ?, ?)`).run('Uniswap', 'DEX', 'twitter', 'https://twitter.com/Uniswap', 'specific');
  db.prepare(`INSERT INTO competitors (name, niche, platform, account_url, tracked_type) VALUES (?, ?, ?, ?, ?)`).run('AxieInfinity', 'Gaming', 'twitter', 'https://twitter.com/AxieInfinity', 'niche_broad');

  // Competitive posts
  const posts = [
    {
      competitor_id: 1, platform: 'twitter', post_url: 'https://twitter.com/BinanceUS/status/1',
      content: '🚨 BREAKING: Zero-fee trading is LIVE for 5 new pairs. Your move, traders.',
      posted_at: '2026-03-05', engagement_metrics: JSON.stringify({ likes: 4500, comments: 890, views: 245000 }),
      hook_type: 'urgency', hook_text: 'BREAKING: Zero-fee trading is LIVE', structure: 'setup_payoff',
      cta_type: 'link_click', visual_type: 'image', visual_description: 'Bold red/black graphic with coin pairs listed',
      engagement_score: 82, flagged_as_pattern: 1, notes: 'High engagement - urgency + value prop combo'
    },
    {
      competitor_id: 1, platform: 'twitter', post_url: 'https://twitter.com/BinanceUS/status/2',
      content: 'Most traders lose money because they skip this one step... 🧵 Thread on risk management that saved our top users.',
      posted_at: '2026-03-03', engagement_metrics: JSON.stringify({ likes: 3200, comments: 1200, views: 189000 }),
      hook_type: 'curiosity_gap', hook_text: 'Most traders lose money because they skip this one step', structure: 'educational',
      cta_type: 'reply', visual_type: 'text_only', visual_description: 'Thread format, no visual',
      engagement_score: 78, flagged_as_pattern: 1, notes: 'Thread format drives high comments'
    },
    {
      competitor_id: 2, platform: 'twitter', post_url: 'https://twitter.com/Uniswap/status/1',
      content: 'Over $2T in cumulative volume. Built different. What are you swapping today?',
      posted_at: '2026-03-04', engagement_metrics: JSON.stringify({ likes: 8900, comments: 2100, views: 520000 }),
      hook_type: 'authority', hook_text: 'Over $2T in cumulative volume', structure: 'setup_payoff',
      cta_type: 'reply', visual_type: 'image', visual_description: 'Milestone infographic with volume chart',
      engagement_score: 91, flagged_as_pattern: 1, notes: 'Authority hook + milestone = massive engagement'
    },
    {
      competitor_id: 2, platform: 'twitter', post_url: 'https://twitter.com/Uniswap/status/2',
      content: '3 reasons DeFi will eat CeFi in 2026. Reason #2 will surprise you 👀',
      posted_at: '2026-03-02', engagement_metrics: JSON.stringify({ likes: 5600, comments: 1800, views: 310000 }),
      hook_type: 'curiosity_gap', hook_text: 'Reason #2 will surprise you', structure: 'educational',
      cta_type: 'reply', visual_type: 'carousel', visual_description: '3-slide carousel with stats per reason',
      engagement_score: 85, flagged_as_pattern: 1, notes: 'Listicle + curiosity gap = consistent formula'
    },
    {
      competitor_id: 3, platform: 'twitter', post_url: 'https://twitter.com/AxieInfinity/status/1',
      content: 'POV: You just earned $500 playing games this week. Our top players are living the dream. Ready to join?',
      posted_at: '2026-03-06', engagement_metrics: JSON.stringify({ likes: 6200, comments: 3400, views: 410000 }),
      hook_type: 'social_proof', hook_text: 'You just earned $500 playing games this week', structure: 'storytelling',
      cta_type: 'link_click', visual_type: 'video', visual_description: 'Short gameplay montage with earnings overlay',
      engagement_score: 88, flagged_as_pattern: 0, notes: 'Social proof + aspirational story drives DMs'
    }
  ];

  const insertPost = db.prepare(`
    INSERT INTO competitive_posts (competitor_id, platform, post_url, content, posted_at, engagement_metrics, hook_type, hook_text, structure, cta_type, visual_type, visual_description, engagement_score, flagged_as_pattern, notes)
    VALUES (@competitor_id, @platform, @post_url, @content, @posted_at, @engagement_metrics, @hook_type, @hook_text, @structure, @cta_type, @visual_type, @visual_description, @engagement_score, @flagged_as_pattern, @notes)
  `);
  for (const post of posts) {
    insertPost.run(post);
  }

  // Patterns
  db.prepare(`INSERT INTO patterns (niche, hook_type, structure, cta_type, pattern_description, post_ids, first_detected, last_seen, competitor_count, avg_engagement_score, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'CEX', 'curiosity_gap', 'educational', 'reply',
    'Curiosity gap hooks paired with educational threads driving high reply engagement across CEX and DEX niches',
    JSON.stringify([2, 4]), '2026-03-02', '2026-03-03', 2, 81.5, 'emerging'
  );
  db.prepare(`INSERT INTO patterns (niche, hook_type, structure, cta_type, pattern_description, post_ids, first_detected, last_seen, competitor_count, avg_engagement_score, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'DEX', 'authority', 'setup_payoff', 'reply',
    'Authority/milestone hooks with setup-payoff structure generating viral engagement in DeFi space',
    JSON.stringify([3]), '2026-03-04', '2026-03-04', 1, 91.0, 'active'
  );

  // Alerts
  db.prepare(`INSERT INTO alerts (alert_type, pattern_id, niche, severity, message) VALUES (?, ?, ?, ?, ?)`).run(
    'pattern_emerging', 1, 'CEX', 'medium',
    'New pattern detected: Curiosity gap + educational thread combo gaining traction across 2 competitors in CEX/DEX niches. Avg engagement score: 81.5'
  );
  db.prepare(`INSERT INTO alerts (alert_type, pattern_id, niche, severity, message) VALUES (?, ?, ?, ?, ?)`).run(
    'engagement_spike', 2, 'DEX', 'high',
    'High engagement alert: Authority hook pattern by Uniswap scored 91/100. Monitor for replication by other DEX competitors.'
  );
  db.prepare(`INSERT INTO alerts (alert_type, niche, severity, message) VALUES (?, ?, ?, ?)`).run(
    'niche_trend', 'Gaming', 'low',
    'Trending: Social proof + storytelling format gaining momentum in Gaming niche. AxieInfinity leading adoption.'
  );
}
