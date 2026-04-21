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

    const contacts = parseContactsSimple(rawText)
    return NextResponse.json({ contacts, source: 'regex' })
  } catch (e) {
    console.error('Parse error:', e)
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
  }
}

function parseContactsSimple(text: string): Partial<Record<string, string>>[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const contacts: Partial<Record<string, string>>[] = []

  for (const line of lines) {
    const contact: Partial<Record<string, string>> = {}

    // Split by common delimiters and clean up each segment
    const segments = line.split(/[\t,|]/).map(s => s.trim()).filter(Boolean)

    for (const seg of segments) {
      // Email
      if (seg.includes('@') && seg.match(/^[\w.+-]+@[\w-]+\.[\w.-]+$/)) {
        contact.email = seg.toLowerCase()
        continue
      }

      // Full URL with protocol
      if (seg.startsWith('http://') || seg.startsWith('https://')) {
        const url = seg.toLowerCase()
        if (!contact.linkedin_url && url.includes('linkedin.com/in/')) {
          contact.linkedin_url = seg
        } else if (!contact.twitter_url && (url.includes('twitter.com/') || url.includes('x.com/'))) {
          contact.twitter_url = seg
        } else if (!contact.instagram_url && url.includes('instagram.com/')) {
          contact.instagram_url = seg
        } else if (!contact.tiktok_url && url.includes('tiktok.com/')) {
          contact.tiktok_url = seg
        } else if (!contact.twitch_url && url.includes('twitch.tv/')) {
          contact.twitch_url = seg
        } else if (!contact.youtube_url && (url.includes('youtube.com/') || url.includes('youtu.be/'))) {
          contact.youtube_url = seg
        } else if (!contact.discord_url && url.includes('discord.gg/')) {
          contact.discord_url = seg
        } else if (!contact.website_url) {
          contact.website_url = seg
        }
        continue
      }

      // Bare social domain + path (no protocol)
      const lower = seg.toLowerCase()
      if (lower.startsWith('linkedin.com/in/') || lower.startsWith('linkedin.com/')) {
        if (!contact.linkedin_url) contact.linkedin_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('x.com/')) {
        if (!contact.twitter_url) contact.twitter_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('twitter.com/')) {
        if (!contact.twitter_url) contact.twitter_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('instagram.com/')) {
        if (!contact.instagram_url) contact.instagram_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('tiktok.com/')) {
        if (!contact.tiktok_url) contact.tiktok_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('twitch.tv/')) {
        if (!contact.twitch_url) contact.twitch_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('youtube.com/') || lower.startsWith('youtu.be/')) {
        if (!contact.youtube_url) contact.youtube_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('discord.gg/')) {
        if (!contact.discord_url) contact.discord_url = 'https://' + seg
        continue
      }

      // Bare website domain
      if (lower.match(/^[\w-]+\.[\w]{2,}(?:\/.*)?$/) && !lower.startsWith('@') && !contact.website_url) {
        contact.website_url = 'https://' + seg
        continue
      }

      // @handle → Twitter
      if (seg.startsWith('@') && !contact.twitter_url) {
        const handle = seg.slice(1)
        if (handle.match(/^[\w]{1,15}$/)) {
          contact.twitter_url = 'https://x.com/' + handle
        }
        continue
      }

      // Name — first segment that isn't an email, URL, or handle
      if (!contact.name && !seg.includes('@') && !seg.includes('://') && !seg.startsWith('@')) {
        if (seg.length > 1 && seg.length < 60 && !seg.match(/^\d+$/)) {
          contact.name = seg
        }
      }
    }

    // Company and role detection
    // Look for patterns like "at COMPANY" or "COMPANY | Role"
    const companyRoleMatch = line.match(/(?:at|@|\|)\s*([^\t,|]+)\s*(?:[|\-])\s*([^\t,|]+)/i)
    if (companyRoleMatch) {
      if (!contact.company) contact.company = companyRoleMatch[1].trim()
      if (!contact.role) contact.role = companyRoleMatch[2].trim()
    }

    if (contact.email || contact.name) {
      contacts.push(contact)
    }
  }

  return contacts
}
