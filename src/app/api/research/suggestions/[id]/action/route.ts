import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const numId = parseInt(id, 10)
  if (isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body
  if (action !== 'add' && action !== 'dismiss') {
    return NextResponse.json({ error: 'action must be "add" or "dismiss"' }, { status: 400 })
  }

  // Fetch the suggestion
  const { data: suggestion, error: fetchErr } = await supabase
    .from('competitor_suggestions')
    .select('*')
    .eq('id', numId)
    .single()

  if (fetchErr || !suggestion) {
    return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
  }

  if (action === 'add') {
    const handle = suggestion.handle.replace('@', '').toLowerCase()
    const accountUrl = `https://x.com/${handle}`

    // Check if already exists by account_url or handle match
    const { data: existing } = await supabase
      .from('competitors')
      .select('id')
      .or(`account_url.ilike.%${handle}%`)
      .limit(1)

    if (!existing || existing.length === 0) {
      const { error: compErr } = await supabase
        .from('competitors')
        .insert({
          name: suggestion.display_name || suggestion.handle,
          niche: suggestion.niche,
          platform: 'twitter',
          account_url: accountUrl,
          tracked_type: 'specific',
        })

      if (compErr && compErr.code !== '23505') {
        return NextResponse.json({ error: compErr.message }, { status: 500 })
      }
    }
    // If already exists, still mark as added below
  }

  // Update suggestion status
  const { data: updated, error: updateErr } = await supabase
    .from('competitor_suggestions')
    .update({ status: action === 'add' ? 'added' : 'dismissed' })
    .eq('id', numId)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ success: true, suggestion: updated })
}
