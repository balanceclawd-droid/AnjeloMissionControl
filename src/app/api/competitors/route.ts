import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET() {
  const { data: competitors, error } = await supabase
    .from('competitors')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(competitors)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, niche, platform, account_url, tracked_type } = body
  if (!name || !niche || !platform) {
    return NextResponse.json({ error: 'Name, niche, and platform required' }, { status: 400 })
  }

  const { data: competitor, error } = await supabase
    .from('competitors')
    .insert({
      name,
      niche,
      platform,
      account_url: account_url || null,
      tracked_type: tracked_type || 'specific',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(competitor, { status: 201 })
}
