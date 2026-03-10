import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(client, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const updates: Record<string, any> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.vertical !== undefined) updates.vertical = body.vertical
  if (body.status !== undefined) updates.status = body.status

  const { error: updateError } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', params.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(client)
}
