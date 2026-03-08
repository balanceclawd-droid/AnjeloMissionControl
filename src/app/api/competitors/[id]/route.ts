import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const competitor = db.prepare('SELECT * FROM competitors WHERE id = ?').get(params.id)
  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const posts = db.prepare('SELECT * FROM competitive_posts WHERE competitor_id = ? ORDER BY posted_at DESC').all(params.id)
  return NextResponse.json({ ...competitor as object, posts })
}
