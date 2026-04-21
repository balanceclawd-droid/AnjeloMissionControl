import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json()
    if (!rawText?.trim()) {
      return NextResponse.json({ error: 'rawText required' }, { status: 400 })
    }

    const contacts = parseContacts(rawText)
    return NextResponse.json({ contacts, source: 'regex' })
  } catch (e) {
    console.error('Parse error:', e)
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
  }
}

function parseContacts(text: string): Partial<Record<string, string>>[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const contacts: Partial<Record<string, string>>[] = []

  for (const line of lines) {
    const contact: Partial<Record<string, string>> = {}

    // Split by | or tab — those are the main delimiters
    const segments = line.split(/[|\t]/).map(s => s.trim()).filter(Boolean)

    // Count how many segments look like emails (has @)
    const emailSegments = segments.filter(s => s.includes('@') && s.match(/@.+\..+/))
    // Count how many segments look like URLs (starts with http or bare domain with .com/.io/etc)
    const urlSegments = segments.filter(s =>
      s.startsWith('http://') || s.startsWith('https://') ||
      s.match(/^[a-z]+\.(com|io|co|org|gg|tv|me|ai)\//i)
    )

    for (const seg of segments) {
      const lower = seg.toLowerCase()

      // EMAIL
      if (seg.includes('@') && seg.match(/^[\w.+-]+@[\w-]+\.[\w.-]+$/)) {
        contact.email = seg.toLowerCase()
        continue
      }

      // FULL URL with protocol
      if (seg.startsWith('http://') || seg.startsWith('https://')) {
        assignSocialUrl(contact, seg)
        continue
      }

      // BARE SOCIAL DOMAIN (no protocol) — check these BEFORE generic domain logic
      if (lower.startsWith('linkedin.com/')) {
        contact.linkedin_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('x.com/') || lower.startsWith('twitter.com/')) {
        contact.twitter_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('instagram.com/')) {
        contact.instagram_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('tiktok.com/')) {
        contact.tiktok_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('twitch.tv/')) {
        contact.twitch_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('youtube.com/') || lower.startsWith('youtu.be/')) {
        contact.youtube_url = 'https://' + seg
        continue
      }
      if (lower.startsWith('discord.gg/')) {
        contact.discord_url = 'https://' + seg
        continue
      }

      // @handle → Twitter
      if (seg.startsWith('@') && seg.slice(1).match(/^[\w]{1,20}$/)) {
        contact.twitter_url = 'https://x.com/' + seg.slice(1)
        continue
      }

      // BARE DOMAIN (no protocol, not a social platform) → website
      if (lower.match(/^[a-z0-9][\w-]*\.[a-z]{2,}(\/.*)?$/) && !lower.includes('@')) {
        if (!contact.website_url) {
          contact.website_url = 'https://' + seg
        }
        continue
      }

      // If it's short and not recognized as anything above, treat as name or role
      if (seg.length >= 2 && seg.length <= 50) {
        // If no name yet and this doesn't look like company/role keywords, set as name
        if (!contact.name && !isCommonRole(seg) && !isCommonCompany(seg)) {
          contact.name = seg
        }
        // If no role and looks like a job title
        if (!contact.role && isCommonRole(seg)) {
          contact.role = seg
        }
      }
    }

    // Derive name from email if no name found
    if (!contact.name && contact.email) {
      const localPart = contact.email.split('@')[0]
      const nameFromEmail = localPart
        .split(/[._-]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ')
      contact.name = nameFromEmail
    }

    // Clean up: if company got set to something that looks like an email or URL, clear it
    if (contact.company && (contact.company.includes('@') || contact.company.includes('://'))) {
      delete contact.company
    }

    if (contact.email || contact.name) {
      contacts.push(contact)
    }
  }

  return contacts
}

function assignSocialUrl(contact: Partial<Record<string, string>>, url: string) {
  const lower = url.toLowerCase()
  if (lower.includes('linkedin.com')) {
    contact.linkedin_url = url
  } else if (lower.includes('twitter.com') || lower.includes('x.com')) {
    contact.twitter_url = url
  } else if (lower.includes('instagram.com')) {
    contact.instagram_url = url
  } else if (lower.includes('tiktok.com')) {
    contact.tiktok_url = url
  } else if (lower.includes('twitch.tv')) {
    contact.twitch_url = url
  } else if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    contact.youtube_url = url
  } else if (lower.includes('discord.gg')) {
    contact.discord_url = url
  } else if (!contact.website_url) {
    contact.website_url = url
  }
}

function isCommonRole(seg: string): boolean {
  const roles = ['ceo', 'cto', 'cfo', 'coo', 'founder', 'co-founder', 'cofounder', 'director', 'manager', 'head', 'lead', 'developer', 'engineer', 'designer', 'consultant', 'analyst', 'specialist', 'coordinator', 'executive', 'president', 'vp', 'vice president', 'assistant', 'associate', 'intern', 'contractor']
  return roles.includes(seg.toLowerCase().replace(/\s+/g, ' ').trim())
}

function isCommonCompany(seg: string): boolean {
  return false // Let it be — we'll rely on explicit company field if needed
}