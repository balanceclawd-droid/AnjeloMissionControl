import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { sanitizePatternPostIds } from '@/lib/patterns'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const patternId = Number(params.id)
  if (Number.isNaN(patternId)) {
    return NextResponse.json({ error: 'Invalid pattern ID' }, { status: 400 })
  }

  const [sanitizedPattern] = await sanitizePatternPostIds(patternId)

  const { data: pattern, error: patternErr } = await supabase
    .from('patterns')
    .select('post_ids')
    .eq('id', patternId)
    .single()

  if (patternErr || !pattern) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
  }

  const postIds = (sanitizedPattern?.post_ids || pattern.post_ids || []) as number[]
  if (postIds.length === 0) {
    return NextResponse.json([])
  }

  const { data: posts, error: postsErr } = await supabase
    .from('competitive_posts')
    .select('id, content, engagement_score, posted_at, bookmark_count, quote_count, conversation_depth, twitter_post_id, competitors(name, niche)')
    .in('id', postIds)
    .order('engagement_score', { ascending: false })

  if (postsErr) {
    return NextResponse.json({ error: postsErr.message }, { status: 500 })
  }

  return NextResponse.json(posts || [])
}
