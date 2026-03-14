import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const baseUrl = process.env.LLM_CLASSIFIER_BASE_URL?.trim()
  const apiKey = process.env.LLM_CLASSIFIER_API_KEY?.trim()
  const model = process.env.LLM_CLASSIFIER_MODEL?.trim()

  return NextResponse.json({
    hasBaseUrl: Boolean(baseUrl),
    baseUrl: baseUrl || null,
    hasApiKey: Boolean(apiKey),
    apiKeyPrefix: apiKey ? apiKey.slice(0, 15) + '...' : null,
    hasModel: Boolean(model),
    model: model || null,
    allPresent: Boolean(baseUrl && apiKey && model),
  })
}
