import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET() {
  const { data, error } = await supabase
    .from('reddit_subreddits')
    .select('*')
    .order('niche', { ascending: true })
    .order('subreddit', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { subreddit, niche } = body

  if (!subreddit || !niche) {
    return NextResponse.json({ error: 'subreddit and niche are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('reddit_subreddits')
    .insert({ subreddit: subreddit.trim(), niche })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
