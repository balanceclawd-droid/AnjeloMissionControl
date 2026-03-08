import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const metrics = db.prepare('SELECT * FROM weekly_metrics WHERE client_id = ? ORDER BY week_ending DESC').all(params.id)
  return NextResponse.json(metrics)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { week_ending, metric_type, data } = body
  if (!week_ending || !metric_type || !data) {
    return NextResponse.json({ error: 'week_ending, metric_type, and data required' }, { status: 400 })
  }
  const db = getDb()
  const result = db.prepare('INSERT INTO weekly_metrics (client_id, week_ending, metric_type, data) VALUES (?, ?, ?, ?)').run(params.id, week_ending, metric_type, JSON.stringify(data))
  const metric = db.prepare('SELECT * FROM weekly_metrics WHERE id = ?').get(result.lastInsertRowid)
  return NextResponse.json(metric, { status: 201 })
}
