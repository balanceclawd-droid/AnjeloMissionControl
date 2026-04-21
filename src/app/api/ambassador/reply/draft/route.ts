import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.1-8b-instant'
const GROQ_TOKEN = process.env.GROQ_API_KEY

export async function POST(req: NextRequest) {
  try {
    const { reply_id } = await req.json()
    if (!reply_id) return NextResponse.json({ error: 'reply_id required' }, { status: 400 })

    // Fetch reply and linked contact
    const { data: reply, error: replyError } = await supabase
      .from('ambassador_replies')
      .select('*, ambassador_contacts(name, email, company, role)')
      .eq('id', reply_id)
      .maybeSingle()

    if (replyError || !reply) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 })
    }

    const contact = reply.ambassador_contacts
    const threadText = reply.thread_text || 'No prior thread context.'

    // Fetch settings for brief
    const { data: settings } = await supabase
      .from('ambassador_settings')
      .select('opportunity_brief')
      .maybeSingle()

    const brief = settings?.opportunity_brief || ''

    // Fetch last 5 approved tone examples
    const { data: toneExamples } = await supabase
      .from('ambassador_tone_examples')
      .select('body')
      .eq('source', 'approved')
      .order('created_at', { ascending: false })
      .limit(5)

    const toneExamplesText = toneExamples?.length
      ? toneExamples.map(t => `- ${t.body}`).join('\n')
      : 'No approved examples yet.'

    // Build system prompt
    const systemPrompt = `You are a professional email reply specialist for a business development / investor relations team.

BRIEF / CONTEXT:
${brief || '(No brief provided — write based on thread context only)'}

APPROVED TONE EXAMPLES:
${toneExamplesText}

RULES:
- Write only the email body. No subject line, no sign-off name.
- Keep it concise: 2-4 sentences for most replies.
- Sound warm but professional. Not too formal, not too casual.
- If the prospect is interested, express genuine enthusiasm and suggest next step.
- If the prospect is neutral or skeptical, be respectful and offer value without pressure.
- Never send attachments, never cc anyone, never mention pricing unless already discussed.
- Option A: slightly more direct / action-focused
- Option B: slightly warmer / relationship-focused`

    const userPrompt = `A prospect replied to our outreach. Write two reply options.

CONTACT: ${contact?.name || 'Unknown'} | ${contact?.role || 'Unknown'} at ${contact?.company || 'Unknown company'}
THREAD CONTEXT:
${threadText}

Write Option A first (more direct), then Option B (warmer). Label each clearly.`

    // Call Groq twice for Option A and Option B
    async function generateDraft(instruction: string): Promise<string> {
      if (!GROQ_TOKEN) return `Template draft (no LLM configured): ${threadText.slice(0, 100)}...`

      try {
        const res = await fetch(GROQ_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_TOKEN}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: instruction },
            ],
            temperature: 0.7,
            max_tokens: 300,
          }),
        })

        if (!res.ok) {
          const err = await res.text()
          console.error('Groq error:', err)
          return `Draft unavailable (API error).`
        }

        const data = await res.json()
        return data.choices?.[0]?.message?.content?.trim() || 'Draft generation failed.'
      } catch (e) {
        return `Draft unavailable (network error).`
      }
    }

    const [optionA, optionB] = await Promise.all([
      generateDraft(userPrompt + '\n\nWrite Option A only (direct version):'),
      generateDraft(userPrompt + '\n\nWrite Option B only (warm version):'),
    ])

    // Save drafts to reply record
    await supabase
      .from('ambassador_replies')
      .update({ draft_a: optionA, draft_b: optionB })
      .eq('id', reply_id)

    return NextResponse.json({ draft_a: optionA, draft_b: optionB })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Draft generation failed' }, { status: 500 })
  }
}
