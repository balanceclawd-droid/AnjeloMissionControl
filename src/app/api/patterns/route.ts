import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { detectPatterns } from '@/lib/patterns'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const niche = searchParams.get('niche')
  const status = searchParams.get('status')

  let query = 'SELECT * FROM patterns WHERE 1=1'
  const params: any[] = []

  if (niche) { query += ' AND niche = ?'; params.push(niche) }
  if (status) { query += ' AND status = ?'; params.push(status) }

  query += ' ORDER BY avg_engagement_score DESC'

  const patterns = db.prepare(query).all(...params)
  return NextResponse.json(patterns)
}

export async function POST() {
  const result = detectPatterns()
  return NextResponse.json(result)
}
