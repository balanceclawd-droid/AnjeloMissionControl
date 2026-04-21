import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET() {
  const { data, error } = await supabase
    .from('ambassador_contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const contacts = body.contacts as Array<{
      name: string
      email: string
      company?: string
      role?: string
      notes?: string
    }>

    if (!Array.isArray(contacts)) {
      return NextResponse.json({ error: 'contacts array required' }, { status: 400 })
    }

    const results = []
    for (const contact of contacts) {
      if (!contact.email) continue

      // Check for duplicates
      const { data: existing } = await supabase
        .from('ambassador_contacts')
        .select('id, email')
        .eq('email', contact.email)
        .maybeSingle()

      if (existing) {
        results.push({ email: contact.email, duplicate: true })
        continue
      }

      const { data, error } = await supabase
        .from('ambassador_contacts')
        .insert({ ...contact, status: 'new' })
        .select()
        .maybeSingle()

      if (error) {
        results.push({ email: contact.email, error: error.message })
      } else {
        results.push({ id: data.id, email: contact.email, duplicate: false })
      }
    }

    return NextResponse.json({ imported: results })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
