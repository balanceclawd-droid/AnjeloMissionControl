import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { calculateEngagementScore } from '@/lib/patterns'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const competitor_id = searchParams.get('competitor_id')

  let query = supabase
    .from('competitive_posts')
    .select('*, competitors!inner(name)')

  if (competitor_id) {
    query = query.eq('competitor_id', competitor_id)
  }

  const { data: posts, error } = await query.order('posted_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten competitor name to match previous API shape
  const formatted = (posts || []).map((p: any) => ({
    ...p,
    competitor_name: p.competitors?.name,
    competitors: undefined,
  }))

  return NextResponse.json(formatted)
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

  const { data: post, error } = await supabase
    .from('competitive_posts')
    .insert({
      competitor_id,
      platform,
      post_url: post_url || null,
      content: content || null,
      posted_at,
      engagement_metrics: metrics,
      hook_type: hook_type || null,
      hook_text: hook_text || null,
      structure: structure || null,
      cta_type: cta_type || null,
      visual_type: visual_type || null,
      visual_description: visual_description || null,
      engagement_score: score,
      flagged_as_pattern: !!flagged_as_pattern,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(post, { status: 201 })
}
