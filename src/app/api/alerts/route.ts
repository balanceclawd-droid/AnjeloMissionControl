import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const dismissed = searchParams.get('dismissed')

  let query = 'SELECT * FROM alerts'
  const params: any[] = []

  if (dismissed !== null) {
    query += ' WHERE dismissed = ?'
    params.push(dismissed === 'true' ? 1 : 0)
  }

  query += ' ORDER BY created_at DESC'

  const alerts = db.prepare(query).all(...params)
  return NextResponse.json(alerts)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, dismissed } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const db = getDb()
  db.prepare('UPDATE alerts SET dismissed = ? WHERE id = ?').run(dismissed ? 1 : 0, id)
  return NextResponse.json({ success: true })
}
