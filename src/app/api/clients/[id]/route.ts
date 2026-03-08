import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(params.id)
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(client)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { name, vertical, status } = body
  const db = getDb()
  db.prepare('UPDATE clients SET name = COALESCE(?, name), vertical = COALESCE(?, vertical), status = COALESCE(?, status) WHERE id = ?')
    .run(name, vertical, status, params.id)
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(params.id)
  return NextResponse.json(client)
}
