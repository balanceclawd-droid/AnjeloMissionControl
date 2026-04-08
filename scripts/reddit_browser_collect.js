#!/usr/bin/env node

const { chromium } = require('playwright')

const APP_URL = process.env.APP_URL || 'https://anjelo-mission-control.vercel.app'
const TARGETS = [
  { url: 'https://www.reddit.com/r/algotrading/', sourceQuery: 'subreddit:algotrading', allowedSubs: ['algotrading'] },
  { url: 'https://www.reddit.com/r/ai_trading/', sourceQuery: 'subreddit:ai_trading', allowedSubs: ['ai_trading'] },
  { url: 'https://www.reddit.com/r/Trading/', sourceQuery: 'subreddit:Trading', allowedSubs: ['trading'] },
  { url: 'https://www.reddit.com/r/Daytrading/', sourceQuery: 'subreddit:Daytrading', allowedSubs: ['daytrading'] },
  { url: 'https://www.reddit.com/r/stocks/search/?q=trading%20bot&restrict_sr=1', sourceQuery: 'subreddit:stocks search:trading bot', allowedSubs: ['stocks'] },
  { url: 'https://www.reddit.com/search/?q=%22ai%20trading%20bot%22', sourceQuery: 'search:ai trading bot', allowedSubs: ['algotrading', 'ai_trading', 'trading', 'daytrading', 'stocks'] },
  { url: 'https://www.reddit.com/search/?q=%22best%20trading%20bot%22', sourceQuery: 'search:best trading bot', allowedSubs: ['algotrading', 'ai_trading', 'trading', 'daytrading', 'stocks'] },
  { url: 'https://www.reddit.com/search/?q=%22backtesting%20strategy%22', sourceQuery: 'search:backtesting strategy', allowedSubs: ['algotrading', 'ai_trading', 'trading', 'daytrading', 'stocks'] },
]

const TARGET_SUBS = new Set(['algotrading', 'ai_trading', 'trading', 'daytrading', 'stocks'])
const TITLE_BLOCKLIST = [
  'the slop is strong with this one',
  'iran continues to fire missiles',
  'deutschland - funded anbieter',
]
const TEXT_BLOCKLIST = [
  'other/meta',
  'moderator',
  'if you post a question without showing any homework',
  'removed by reddit',
  'removed by moderators',
  'daily outlook',
  'weekly update',
  'pre market prep',
  'market recap',
  'market outlook',
  'trade recap',
]

function normalizePermalink(href) {
  if (!href) return ''
  if (href.startsWith('http')) return href
  if (href.startsWith('/')) return `https://www.reddit.com${href}`
  return ''
}

function parseCommentCount(text) {
  if (!text) return 0
  const m = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([km])?\s*comments?/i)
  if (!m) return 0
  const n = Number(m[1])
  const suffix = (m[2] || '').toLowerCase()
  if (suffix === 'k') return Math.round(n * 1000)
  if (suffix === 'm') return Math.round(n * 1000000)
  return Math.round(n)
}

async function extractCards(page, sourceQuery, allowedSubs) {
  return await page.evaluate(({ sourceQuery, allowedSubs }) => {
    const cards = []
    const seen = new Set()
    const anchors = Array.from(document.querySelectorAll('a[href*="/comments/"]'))

    for (const a of anchors) {
      const href = a.getAttribute('href') || ''
      const title = (a.textContent || '').replace(/\s+/g, ' ').trim()
      if (!href || !title || title.startsWith('https://') || seen.has(href)) continue

      const permalinkMatch = href.match(/\/r\/([A-Za-z0-9_]+)\/comments\//)
      const permalinkSub = permalinkMatch ? permalinkMatch[1].toLowerCase() : null
      if (!permalinkSub || (Array.isArray(allowedSubs) && allowedSubs.length > 0 && !allowedSubs.includes(permalinkSub))) continue
      if (href.includes('/comment/')) continue

      const card = a.closest('article, div[data-testid="post-container"], shreddit-post, faceplate-tracker') || a.parentElement
      const text = (card ? (card.textContent || '') : title).replace(/\s+/g, ' ').trim()
      const authorMatch = text.match(/u\/([A-Za-z0-9_-]+)/)
      const commentMatch = text.match(/(\d+(?:\.\d+)?)\s*[kKmM]?\s*comments?/) || text.match(/comment[s]?\s*(\d+(?:\.\d+)?)/i)
      const postedAtMatch = text.match(/(\d+\s*(?:hr|hrs|hour|hours|min|mins|minute|minutes|day|days|mo|mos|month|months|yr|yrs|year|years)\s*ago)/i)
      seen.add(href)

      cards.push({
        subreddit: permalinkSub,
        title,
        permalink: href,
        author: authorMatch ? authorMatch[1] : null,
        snippet: text.slice(0, 280),
        scoreText: null,
        commentText: commentMatch ? commentMatch[0] : '',
        postedAtText: postedAtMatch ? postedAtMatch[1] : null,
        sourceQuery,
      })
    }

    return cards
  }, { sourceQuery, allowedSubs })
}

function isUsefulLead(item) {
  const title = (item.title || '').toLowerCase()
  const snippet = (item.snippet || '').toLowerCase()
  const text = `${title} ${snippet}`

  if (!TARGET_SUBS.has((item.subreddit || '').toLowerCase())) return false
  if (!title || title.length < 18) return false
  if (TITLE_BLOCKLIST.some(t => title.includes(t))) return false
  if (TEXT_BLOCKLIST.some(t => text.includes(t))) return false
  if (item.permalink.includes('/comment/')) return false

  const highIntent = [
    'looking for', 'recommend', 'what do you use', 'which platform', 'best platform', 'best tool',
    'how do you', 'anyone use', 'anyone tried', 'worth it', 'legal', 'automated trading',
    'trading bot', 'ai trading bot', 'backtest', 'backtesting', 'copy trading', 'signal',
    'drawdown', 'losing', 'overfitting', 'api issues'
  ]
  const lowIntent = [
    'daily outlook', 'weekly update', 'pre market prep', 'trade recap', 'orb strategy', 'gold daily',
    'gbpjpy daily', 'es/spx', 'market making avg', 'i made $500,000', 'open-source automated stock trading platform'
  ]

  if (lowIntent.some(k => text.includes(k))) return false
  return highIntent.some(k => text.includes(k))
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2200 },
  })

  const collected = []

  for (const target of TARGETS) {
    console.log(`→ ${target.url}`)
    try {
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2500)
      const cards = await extractCards(page, target.sourceQuery, target.allowedSubs)
      for (const card of cards) {
        const permalink = normalizePermalink(card.permalink)
        if (!permalink) continue
        const candidate = {
          subreddit: card.subreddit,
          title: card.title,
          permalink,
          author: card.author,
          snippet: card.snippet,
          scoreText: card.scoreText,
          commentCount: parseCommentCount(card.commentText),
          postedAtText: card.postedAtText,
          sourceQuery: card.sourceQuery,
          sourceKind: 'browser',
        }
        if (!isUsefulLead(candidate)) continue
        collected.push({
          subreddit: card.subreddit,
          title: card.title,
          permalink,
          author: card.author,
          snippet: card.snippet,
          scoreText: card.scoreText,
          commentCount: parseCommentCount(card.commentText),
          postedAtText: card.postedAtText,
          sourceQuery: card.sourceQuery,
          sourceKind: 'browser',
        })
      }
      console.log(`  collected: ${cards.length}`)
      await page.waitForTimeout(1200)
    } catch (err) {
      console.log(`  failed: ${err.message}`)
    }
  }

  const deduped = []
  const seen = new Set()
  for (const item of collected) {
    if (seen.has(item.permalink)) continue
    seen.add(item.permalink)
    deduped.push(item)
  }

  // Prefer cleaner, higher-intent prompts by cutting the long tail before ingest.
  const trimmed = deduped.slice(0, 25)

  console.log(`\nTotal deduped leads: ${deduped.length}`)
  console.log(`High-intent leads kept: ${trimmed.length}`)

  if (trimmed.length === 0) {
    await browser.close()
    process.exit(0)
  }

  const res = await fetch(`${APP_URL}/api/reddit/browser-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leads: trimmed }),
  })

  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
