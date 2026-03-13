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
    // Create competitor in the competitors table
    const { error: compErr } = await supabase
      .from('competitors')
      .upsert({
        name: suggestion.display_name || suggestion.handle,
        niche: suggestion.niche,
        platform: 'twitter',
        account_url: `https://x.com/${suggestion.handle.replace('@', '')}`,
        tracked_type: 'specific',
      }, { onConflict: 'name', ignoreDuplicates: true })

    if (compErr && compErr.code !== '23505') {
      return NextResponse.json({ error: compErr.message }, { status: 500 })
    }
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
