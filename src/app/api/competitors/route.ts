import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const competitors = db.prepare('SELECT * FROM competitors ORDER BY created_at DESC').all()
  return NextResponse.json(competitors)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, niche, platform, account_url, tracked_type } = body
  if (!name || !niche || !platform) {
    return NextResponse.json({ error: 'Name, niche, and platform required' }, { status: 400 })
  }
  const db = getDb()
  const result = db.prepare('INSERT INTO competitors (name, niche, platform, account_url, tracked_type) VALUES (?, ?, ?, ?, ?)').run(name, niche, platform, account_url || null, tracked_type || 'specific')
  const competitor = db.prepare('SELECT * FROM competitors WHERE id = ?').get(result.lastInsertRowid)
  return NextResponse.json(competitor, { status: 201 })
}
