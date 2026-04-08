#!/usr/bin/env node

const { chromium } = require('playwright')

const APP_URL = process.env.APP_URL || 'https://anjelo-mission-control.vercel.app'
const TARGETS = [
  { url: 'https://www.reddit.com/r/algotrading/', sourceQuery: 'subreddit:algotrading' },
  { url: 'https://www.reddit.com/r/ai_trading/', sourceQuery: 'subreddit:ai_trading' },
  { url: 'https://www.reddit.com/r/Trading/', sourceQuery: 'subreddit:Trading' },
  { url: 'https://www.reddit.com/r/Daytrading/', sourceQuery: 'subreddit:Daytrading' },
  { url: 'https://www.reddit.com/search/?q=ai%20trading%20bot', sourceQuery: 'search:ai trading bot' },
  { url: 'https://www.reddit.com/search/?q=best%20trading%20bot', sourceQuery: 'search:best trading bot' },
  { url: 'https://www.reddit.com/search/?q=backtesting%20strategy', sourceQuery: 'search:backtesting strategy' },
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

async function extractCards(page, sourceQuery) {
  return await page.evaluate((sourceQuery) => {
    const cards = []
    const seen = new Set()
    const anchors = Array.from(document.querySelectorAll('a[href*="/comments/"]'))

    for (const a of anchors) {
      const href = a.getAttribute('href') || ''
      const title = (a.textContent || '').trim()
      if (!href || !title || seen.has(href)) continue
      seen.add(href)

      const card = a.closest('article, div[data-testid="post-container"], shreddit-post, faceplate-tracker') || a.parentElement
      const text = card ? (card.textContent || '') : title
      const subredditMatch = text.match(/r\/([A-Za-z0-9_]+)/)
      const authorMatch = text.match(/u\/([A-Za-z0-9_-]+)/)
      const commentMatch = text.match(/\d+(?:\.\d+)?\s*[kKmM]?\s*comments?/)
      const postedAtMatch = text.match(/(\d+\s*(?:hr|hrs|hour|hours|min|mins|minute|minutes|day|days|mo|mos|month|months|yr|yrs|year|years)\s*ago)/i)

      cards.push({
        subreddit: subredditMatch ? subredditMatch[1] : 'unknown',
        title,
        permalink: href,
        author: authorMatch ? authorMatch[1] : null,
        snippet: text.replace(/\s+/g, ' ').trim().slice(0, 280),
        scoreText: null,
        commentText: commentMatch ? commentMatch[0] : '',
        postedAtText: postedAtMatch ? postedAtMatch[1] : null,
        sourceQuery,
      })
    }

    return cards
  }, sourceQuery)
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
      const cards = await extractCards(page, target.sourceQuery)
      for (const card of cards) {
        const permalink = normalizePermalink(card.permalink)
        if (!permalink || card.subreddit === 'unknown') continue
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

  console.log(`\nTotal deduped leads: ${deduped.length}`)

  if (deduped.length === 0) {
    await browser.close()
    process.exit(0)
  }

  const res = await fetch(`${APP_URL}/api/reddit/browser-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leads: deduped }),
  })

  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
