import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { calculateEngagementScore } from '@/lib/patterns'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const competitor_id = searchParams.get('competitor_id')

  let query = `SELECT cp.*, c.name as competitor_name FROM competitive_posts cp JOIN competitors c ON cp.competitor_id = c.id`
  const queryParams: any[] = []

  if (competitor_id) {
    query += ' WHERE cp.competitor_id = ?'
    queryParams.push(competitor_id)
  }
  query += ' ORDER BY cp.posted_at DESC'

  const posts = db.prepare(query).all(...queryParams)
  return NextResponse.json(posts)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    competitor_id, platform, post_url, content, posted_at,
    engagement_metrics, hook_type, hook_text, structure, cta_type,
    visual_type, visual_description, flagged_as_pattern, notes
  } = body

  if (!competitor_id || !platform || !posted_at) {
    return NextResponse.json({ error: 'competitor_id, platform, and posted_at required' }, { status: 400 })
  }

  const metrics = engagement_metrics || {}
  const score = calculateEngagementScore(metrics)

  const db = getDb()
  const result = db.prepare(`
    INSERT INTO competitive_posts (competitor_id, platform, post_url, content, posted_at, engagement_metrics, hook_type, hook_text, structure, cta_type, visual_type, visual_description, engagement_score, flagged_as_pattern, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    competitor_id, platform, post_url || null, content || null, posted_at,
    JSON.stringify(metrics), hook_type || null, hook_text || null,
    structure || null, cta_type || null, visual_type || null,
    visual_description || null, score, flagged_as_pattern ? 1 : 0, notes || null
  )
  const post = db.prepare('SELECT * FROM competitive_posts WHERE id = ?').get(result.lastInsertRowid)
  return NextResponse.json(post, { status: 201 })
}
