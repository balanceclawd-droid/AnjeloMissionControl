import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { sanitizePatternPostIds } from '@/lib/patterns'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: competitor, error } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: posts } = await supabase
    .from('competitive_posts')
    .select('*')
    .eq('competitor_id', params.id)
    .order('posted_at', { ascending: false })

  return NextResponse.json({ ...competitor, posts: posts || [] })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const competitorId = Number(params.id)
  if (Number.isNaN(competitorId)) {
    return NextResponse.json({ error: 'Invalid competitor ID' }, { status: 400 })
  }

  const { data: competitor, error: competitorError } = await supabase
    .from('competitors')
    .select('id, name')
    .eq('id', competitorId)
    .single()

  if (competitorError || !competitor) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
  }

  const { error: postsError } = await supabase
    .from('competitive_posts')
    .delete()
    .eq('competitor_id', competitorId)

  if (postsError) {
    return NextResponse.json({ error: postsError.message }, { status: 500 })
  }

  await sanitizePatternPostIds()

  const { error: deleteError } = await supabase
    .from('competitors')
    .delete()
    .eq('id', competitorId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, deleted: competitor })
}
