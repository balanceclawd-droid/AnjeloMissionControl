import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

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
