import { NextRequest, NextResponse } from 'next/server'

const MINIMAX_API = 'https://api.minimax.io/v1/chat/completions'
const MINIMAX_MODEL = 'MiniMax-Text-01'
const MINIMAX_TOKEN = process.env.MINIMAX_API_KEY

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json()
    if (!rawText?.trim()) {
      return NextResponse.json({ error: 'rawText required' }, { status: 400 })
    }

    if (!MINIMAX_TOKEN) {
      // Fallback: simple regex-based parsing
      const contacts = parseContactsSimple(rawText)
      return NextResponse.json({ contacts, source: 'regex' })
    }

    const systemPrompt = `You are a data extraction specialist. Given raw text containing contact information in any format (bullet points, CSV, tab-separated, pipe-separated, free text), extract all contacts and return a JSON array.

For each contact, extract these fields if present:
- name: full name (string)
- email: email address (string)
- company: company/organization name (string)
- role: job title/role (string)
- linkedin_url: LinkedIn profile URL (string, starts with http)
- twitter_url: Twitter/X URL or handle (string, starts with http or @)
- website_url: website URL (string, starts with http)
- twitch_url: Twitch URL (string, starts with http)
- youtube_url: YouTube URL or handle (string, starts with http or @)
- tiktok_url: TikTok URL or handle (string, starts with http or @)
- instagram_url: Instagram URL or handle (string, starts with http or @)
- discord_url: Discord invite URL (string, starts with http)
- notes: any other context from the line (string)

Rules:
- Return ONLY a valid JSON array, no markdown, no explanation
- Each contact must have at least an email or name
- Social handles (@username) without a URL: convert to full profile URL where possible
- If you can't determine a field, omit it (don't guess)
- Merge info from the same line even if it's not clearly delimited`

    const res = await fetch(MINIMAX_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_TOKEN}`,
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract all contacts from this text:\n\n${rawText}` },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    })

    if (!res.ok) {
      const contacts = parseContactsSimple(rawText)
      return NextResponse.json({ contacts, source: 'regex' })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim() || '[]'

    // Try to parse JSON from response (strip any markdown code blocks)
    let parsed: unknown[]
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        parsed = JSON.parse(content)
      }
    } catch {
      // Fallback to regex parsing
      parsed = parseContactsSimple(rawText)
    }

    // Ensure it's an array
    if (!Array.isArray(parsed)) {
      parsed = []
    }

    return NextResponse.json({ contacts: parsed, source: 'ai' })
  } catch (e) {
    console.error('Parse error:', e)
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
  }
}

function parseContactsSimple(text: string): Partial<Record<string, string>>[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const contacts: Partial<Record<string, string>>[] = []

  const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/g
  const urlRegex = /https?:\/\/[^\s]+/g
  const linkedinRegex = /(?:linkedin\.com\/in\/[\w-]+)/gi
  const twitterRegex = /(?:twitter\.com|x\.com)[\/]?[\w]*/gi
  const instagramRegex = /(?:instagram\.com\/[\w.]+)/gi
  const tiktokRegex = /(?:tiktok\.com\/@[\w.]+)/gi
  const twitchRegex = /(?:twitch\.tv\/[\w.]+)/gi
  const youtubeRegex = /(?:youtube\.com\/[@\w]+|youtu\.be\/[\w]+)/gi
  const discordRegex = /(?:discord\.gg\/[\w]+)/gi

  for (const line of lines) {
    const emails = line.match(emailRegex) || []
    const urls = line.match(urlRegex) || []

    if (!emails.length && !urls.length) continue

    const contact: Partial<Record<string, string>> = {}

    if (emails.length) contact.email = emails[0]

    const linkedin = urls.find(u => u.includes('linkedin.com'))
    if (linkedin) contact.linkedin_url = 'https://' + linkedin.replace(/^\/\//, '')

    const twitter = urls.find(u => u.includes('twitter.com') || u.includes('x.com'))
    if (twitter) contact.twitter_url = twitter.startsWith('http') ? twitter : 'https://' + twitter

    const instagram = urls.find(u => u.includes('instagram.com'))
    if (instagram) contact.instagram_url = instagram.startsWith('http') ? instagram : 'https://' + instagram

    const tiktok = urls.find(u => u.includes('tiktok.com'))
    if (tiktok) contact.tiktok_url = tiktok.startsWith('http') ? tiktok : 'https://' + tiktok

    const twitch = urls.find(u => u.includes('twitch.tv'))
    if (twitch) contact.twitch_url = twitch.startsWith('http') ? twitch : 'https://' + twitch

    const youtube = urls.find(u => u.includes('youtube.com') || u.includes('youtu.be'))
    if (youtube) contact.youtube_url = youtube.startsWith('http') ? youtube : 'https://' + youtube

    const discord = urls.find(u => u.includes('discord.gg'))
    if (discord) contact.discord_url = discord.startsWith('http') ? discord : 'https://' + discord

    const remainingUrl = urls.find(u =>
      !u.includes('linkedin') && !u.includes('twitter') && !u.includes('x.com') &&
      !u.includes('instagram') && !u.includes('tiktok') && !u.includes('twitch') &&
      !u.includes('youtube') && !u.includes('youtu') && !u.includes('discord')
    )
    if (remainingUrl) contact.website_url = remainingUrl.startsWith('http') ? remainingUrl : 'https://' + remainingUrl

    // Try to extract name from the beginning of the line
    const nameCandidate = line.split(/[\t,|@\/]/)[0].trim()
    if (nameCandidate && !nameCandidate.includes('@') && !nameCandidate.startsWith('http')) {
      contact.name = nameCandidate
    }

    if (contact.email || contact.name) {
      contacts.push(contact)
    }
  }

  return contacts
}
