import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  // Get the pattern to find post_ids
  const { data: pattern, error: patternErr } = await supabase
    .from('patterns')
    .select('post_ids')
    .eq('id', params.id)
    .single()

  if (patternErr || !pattern) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
  }

  const postIds = pattern.post_ids || []
  if (postIds.length === 0) {
    return NextResponse.json([])
  }

  // Fetch the actual posts with competitor info
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
