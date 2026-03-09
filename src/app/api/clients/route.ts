import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/db'

export async function GET() {
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, vertical } = body
  if (!name || !vertical) {
    return NextResponse.json({ error: 'Name and vertical required' }, { status: 400 })
  }

  const { data: client, error } = await supabase
    .from('clients')
    .insert({ name, vertical })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(client, { status: 201 })
}
