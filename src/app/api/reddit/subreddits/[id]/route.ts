import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { error } = await supabase
    .from('reddit_subreddits')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
