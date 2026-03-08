import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const clients = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all()
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, vertical } = body
  if (!name || !vertical) {
    return NextResponse.json({ error: 'Name and vertical required' }, { status: 400 })
  }
  const db = getDb()
  const result = db.prepare('INSERT INTO clients (name, vertical) VALUES (?, ?)').run(name, vertical)
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid)
  return NextResponse.json(client, { status: 201 })
}
