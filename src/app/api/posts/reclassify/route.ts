import { NextRequest, NextResponse } from 'next/server'
import { backfillPostClassifications, detectPatterns } from '@/lib/patterns'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const limit = typeof body.limit === 'number' ? Math.max(1, Math.min(body.limit, 1000)) : 500
    const force = Boolean(body.force)
    const refreshPatterns = body.refreshPatterns !== false
    const competitorId = typeof body.competitorId === 'number' ? body.competitorId : undefined

    const reclassified = await backfillPostClassifications({
      limit,
      force,
      competitorId,
    })

    const detection = refreshPatterns ? await detectPatterns() : null

    return NextResponse.json({
      ok: true,
      reclassified,
      detection,
      llmErrors: reclassified.errors || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Reclassification failed' }, { status: 500 })
  }
}
