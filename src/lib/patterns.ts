import { getDb } from './db';

interface Post {
  id: number;
  competitor_id: number;
  hook_type: string;
  structure: string;
  cta_type: string;
  engagement_score: number;
  posted_at: string;
  niche?: string;
}

export function detectPatterns() {
  const db = getDb();

  // Get all posts with competitor niche info
  const posts = db.prepare(`
    SELECT cp.*, c.niche
    FROM competitive_posts cp
    JOIN competitors c ON cp.competitor_id = c.id
    WHERE cp.hook_type IS NOT NULL AND cp.structure IS NOT NULL AND cp.cta_type IS NOT NULL
    ORDER BY cp.posted_at DESC
  `).all() as Post[];

  // Group by hook_type + structure + cta_type
  const groups: Record<string, Post[]> = {};
  for (const post of posts) {
    const key = `${post.hook_type}|${post.structure}|${post.cta_type}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(post);
  }

  const newAlerts: Array<{ alert_type: string; pattern_id: number | null; niche: string; severity: string; message: string }> = [];

  for (const [key, groupPosts] of Object.entries(groups)) {
    if (groupPosts.length < 2) continue; // Need at least 2 for pattern consideration (lowered for seed data)

    const [hook_type, structure, cta_type] = key.split('|');
    const niches = [...new Set(groupPosts.map(p => p.niche))];
    const niche = niches[0] || 'Unknown';
    const postIds = groupPosts.map(p => p.id);
    const competitorIds = [...new Set(groupPosts.map(p => p.competitor_id))];
    const avgScore = groupPosts.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / groupPosts.length;

    // Check if pattern exists
    const existing = db.prepare(`
      SELECT * FROM patterns WHERE hook_type = ? AND structure = ? AND cta_type = ?
    `).get(hook_type, structure, cta_type) as any;

    const now = new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Determine status
    const recentPosts = groupPosts.filter(p => p.posted_at >= sevenDaysAgo);
    let status = 'emerging';
    if (recentPosts.length >= 3) status = 'active';
    else if (recentPosts.length === 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const monthPosts = groupPosts.filter(p => p.posted_at >= thirtyDaysAgo);
      status = monthPosts.length > 0 ? 'declining' : 'dormant';
    }

    if (existing) {
      db.prepare(`
        UPDATE patterns SET post_ids = ?, last_seen = ?, competitor_count = ?, avg_engagement_score = ?, status = ?
        WHERE id = ?
      `).run(JSON.stringify(postIds), now, competitorIds.length, Math.round(avgScore * 10) / 10, status, existing.id);
    } else {
      const desc = `${hook_type} hook + ${structure} structure + ${cta_type} CTA pattern detected across ${competitorIds.length} competitor(s)`;
      const result = db.prepare(`
        INSERT INTO patterns (niche, hook_type, structure, cta_type, pattern_description, post_ids, first_detected, last_seen, competitor_count, avg_engagement_score, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(niche, hook_type, structure, cta_type, desc, JSON.stringify(postIds), now, now, competitorIds.length, Math.round(avgScore * 10) / 10, status);

      const patternId = result.lastInsertRowid as number;

      // Generate alert for new pattern
      let severity = 'low';
      if (avgScore > 75) severity = 'medium';
      if (competitorIds.length >= 3 || avgScore > 85) severity = 'high';

      newAlerts.push({
        alert_type: 'pattern_emerging',
        pattern_id: patternId,
        niche,
        severity,
        message: `New pattern detected: ${hook_type} + ${structure} + ${cta_type}. ${competitorIds.length} competitor(s), avg score: ${Math.round(avgScore)}`
      });
    }

    // Check for accelerating patterns (3+ new posts in 7 days)
    if (recentPosts.length >= 3 && existing) {
      newAlerts.push({
        alert_type: 'pattern_accelerating',
        pattern_id: existing.id,
        niche,
        severity: 'high',
        message: `Pattern accelerating: ${hook_type} + ${structure} has ${recentPosts.length} new posts in the last 7 days`
      });
    }

    // High engagement alert
    if (avgScore > 75) {
      const topPost = groupPosts.sort((a, b) => b.engagement_score - a.engagement_score)[0];
      if (topPost && topPost.engagement_score > 85) {
        newAlerts.push({
          alert_type: 'engagement_spike',
          pattern_id: existing?.id || null,
          niche,
          severity: 'high',
          message: `High engagement spike: Post scored ${topPost.engagement_score}/100 using ${hook_type} + ${structure} pattern`
        });
      }
    }
  }

  // Insert new alerts (avoid duplicates by checking recent ones)
  const insertAlert = db.prepare(`
    INSERT INTO alerts (alert_type, pattern_id, niche, severity, message) VALUES (?, ?, ?, ?, ?)
  `);
  for (const alert of newAlerts) {
    const recent = db.prepare(`
      SELECT id FROM alerts WHERE alert_type = ? AND pattern_id = ? AND created_at > datetime('now', '-1 day')
    `).get(alert.alert_type, alert.pattern_id);
    if (!recent) {
      insertAlert.run(alert.alert_type, alert.pattern_id, alert.niche, alert.severity, alert.message);
    }
  }

  return { patternsProcessed: Object.keys(groups).length, alertsGenerated: newAlerts.length };
}

export function calculateEngagementScore(metrics: { likes?: number; comments?: number; views?: number }): number {
  const { likes = 0, comments = 0, views = 0 } = metrics;
  if (views === 0) return 0;

  const engagementRate = ((likes + comments * 2) / views) * 100;

  // Normalize to 0-100 scale
  // Assume 5% engagement rate = 50 score, 10%+ = 90+
  let score = Math.min(100, Math.round(engagementRate * 10));

  // Boost for high absolute numbers
  if (views > 100000) score = Math.min(100, score + 10);
  if (comments > 1000) score = Math.min(100, score + 5);

  return Math.max(0, Math.min(100, score));
}
