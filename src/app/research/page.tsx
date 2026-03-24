'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const NICHES = ['CEX', 'DEX', 'DeFi', 'Gaming', 'Memecoin', 'General', 'Other']

type Keyword = { id: number; niche: string; keyword: string; active: boolean; created_at: string }
type Suggestion = {
  id: number; handle: string; display_name: string; niche: string
  avg_engagement: number; sample_post: string; tweet_url: string; status: string
}
type Report = {
  id: number; report_type: string; niche: string; summary: string
  top_posts: any[]; new_accounts: any[]; created_at: string
}

type TabType = 'keywords' | 'daily' | 'weekly' | 'suggestions' | 'reddit'

function ResearchPageInner() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabType) || 'keywords'
  const [tab, setTab] = useState<TabType>(initialTab)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Market Research</h1>
        <p className="text-sm text-neutral-500 mt-1">Keyword tracking, scraped intelligence, and competitor discovery</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border flex-wrap">
        {(['keywords', 'daily', 'weekly', 'suggestions', 'reddit'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-accent-red text-white'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            {t === 'keywords' ? 'Keywords'
              : t === 'daily' ? 'Daily Reports'
              : t === 'weekly' ? 'Weekly Overview'
              : t === 'suggestions' ? 'Competitor Suggestions'
              : '🔴 Reddit'}
          </button>
        ))}
      </div>

      {tab === 'keywords' && <KeywordsTab />}
      {tab === 'daily' && <DailyReportsTab />}
      {tab === 'weekly' && <WeeklyOverviewTab />}
      {tab === 'suggestions' && <SuggestionsTab />}
      {tab === 'reddit' && <RedditTab />}
    </div>
  )
}

export default function ResearchPage() {
  return (
    <Suspense fallback={<div className="text-neutral-500 text-sm">Loading...</div>}>
      <ResearchPageInner />
    </Suspense>
  )
}

// ─── Keywords Tab ─────────────────────────────────────────────────────────────

function KeywordsTab() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [niche, setNiche] = useState('')
  const [keyword, setKeyword] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/research/keywords')
      .then(r => r.json())
      .then(d => { setKeywords(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const addKeyword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!niche || !keyword.trim()) return
    setAdding(true)
    setError('')
    const res = await fetch('/api/research/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, keyword: keyword.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to add keyword')
    } else {
      setKeywords(prev => [data, ...prev])
      setKeyword('')
    }
    setAdding(false)
  }

  const deleteKeyword = async (id: number) => {
    const res = await fetch(`/api/research/keywords/${id}`, { method: 'DELETE' })
    if (res.ok) setKeywords(prev => prev.filter(k => k.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Add Research Keyword</h3>
        <form onSubmit={addKeyword} className="flex gap-3 items-end flex-wrap">
          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Niche</label>
            <select
              value={niche}
              onChange={e => setNiche(e.target.value)}
              className="bg-bg-hover border border-border rounded-lg px-3 py-2 text-sm text-white min-w-[140px]"
              required
            >
              <option value="">Select niche...</option>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs text-neutral-500">Keyword / Search Query</label>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="e.g. DeFi yield farming"
              className="w-full bg-bg-hover border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600"
              required
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 bg-accent-red text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add Keyword'}
          </button>
        </form>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-neutral-500">Loading...</p>
        ) : keywords.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No keywords yet. Add one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs text-neutral-500 font-medium">Niche</th>
                <th className="text-left px-4 py-3 text-xs text-neutral-500 font-medium">Keyword</th>
                <th className="text-left px-4 py-3 text-xs text-neutral-500 font-medium">Added</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {keywords.map(k => (
                <tr key={k.id} className="border-b border-border/50 hover:bg-bg-hover/30">
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-300">{k.niche}</span>
                  </td>
                  <td className="px-4 py-3 text-white">{k.keyword}</td>
                  <td className="px-4 py-3 text-neutral-500">{new Date(k.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteKeyword(k.id)}
                      className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Daily Reports Tab ────────────────────────────────────────────────────────

function DailyReportsTab() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/research/reports?type=daily&limit=20')
      .then(r => r.json())
      .then(d => { setReports(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-neutral-500">Loading...</p>
  if (reports.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-lg p-6 text-center">
        <p className="text-sm text-neutral-500">No daily reports yet.</p>
        <p className="text-xs text-neutral-600 mt-1">Run the bridge script to scrape and generate reports.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reports.map(r => (
        <div key={r.id} className="bg-bg-card border border-border rounded-lg overflow-hidden">
          <button
            className="w-full text-left p-4 flex items-start justify-between gap-4 hover:bg-bg-hover/20 transition-colors"
            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">{r.niche}</span>
                <span className="text-xs text-neutral-500">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-neutral-300">{r.summary}</p>
            </div>
            <span className="text-neutral-500 text-xs mt-1">{expanded === r.id ? '▲' : '▼'}</span>
          </button>

          {expanded === r.id && (
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
              {r.top_posts?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">Top Posts</h4>
                  <div className="space-y-2">
                    {r.top_posts.map((p: any, i: number) => (
                      <div key={i} className="bg-neutral-900 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-white">{p.handle}</span>
                          <span className="text-xs text-neutral-500">{p.niche}</span>
                          <span className="ml-auto text-xs text-accent-red font-medium">{p.engagement_score}/100</span>
                        </div>
                        <p className="text-xs text-neutral-300">{p.content}</p>
                        <div className="flex gap-3 mt-2 text-xs text-neutral-600">
                          <span>♥ {p.likes}</span>
                          <span>↻ {p.retweets}</span>
                          <span>💬 {p.replies}</span>
                          {p.tweet_url && (
                            <a href={p.tweet_url} target="_blank" rel="noreferrer" className="ml-auto text-accent-red hover:underline">
                              View →
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.new_accounts?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">New Accounts Detected</h4>
                  <div className="space-y-2">
                    {r.new_accounts.map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 bg-neutral-900 rounded-lg p-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white">{a.handle}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">{a.niche}</span>
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5">{a.sample_post}</p>
                        </div>
                        <span className="text-xs text-neutral-500">avg {a.avg_engagement}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Weekly Overview Tab ──────────────────────────────────────────────────────

function WeeklyOverviewTab() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/research/reports?type=weekly&limit=1')
      .then(r => r.json())
      .then(d => { setReport(Array.isArray(d) && d[0] ? d[0] : null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-neutral-500">Loading...</p>
  if (!report) {
    return (
      <div className="bg-bg-card border border-border rounded-lg p-6 text-center">
        <p className="text-sm text-neutral-500">No weekly report yet.</p>
        <p className="text-xs text-neutral-600 mt-1">Weekly reports are generated every 7 days from the bridge script.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">{report.niche}</span>
          <span className="text-xs text-neutral-500">Week of {new Date(report.created_at).toLocaleDateString()}</span>
        </div>
        <p className="text-sm text-neutral-300 leading-relaxed">{report.summary}</p>
      </div>

      {report.top_posts?.length > 0 && (
        <div className="bg-bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Top Posts This Week</h3>
          <div className="space-y-3">
            {report.top_posts.map((p: any, i: number) => (
              <div key={i} className="bg-neutral-900 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-white">{p.handle}</span>
                  <span className="text-xs text-neutral-500">{p.niche}</span>
                  <span className="ml-auto text-xs text-accent-red font-medium">{p.engagement_score}/100</span>
                </div>
                <p className="text-xs text-neutral-300">{p.content}</p>
                <div className="flex gap-3 mt-2 text-xs text-neutral-600">
                  <span>♥ {p.likes}</span>
                  <span>↻ {p.retweets}</span>
                  <span>💬 {p.replies}</span>
                  {p.tweet_url && (
                    <a href={p.tweet_url} target="_blank" rel="noreferrer" className="ml-auto text-accent-red hover:underline">
                      View →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.new_accounts?.length > 0 && (
        <div className="bg-bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">New Competitor Accounts ({report.new_accounts.length})</h3>
          <div className="space-y-2">
            {report.new_accounts.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-3 bg-neutral-900 rounded-lg p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{a.handle}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">{a.niche}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{a.sample_post}</p>
                </div>
                <span className="text-xs text-neutral-500">avg {a.avg_engagement}/100</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Competitor Suggestions Tab ───────────────────────────────────────────────

function SuggestionsTab() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/research/suggestions')
      .then(r => r.json())
      .then(d => { setSuggestions(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleAction = async (id: number, action: 'add' | 'dismiss') => {
    setActing(id)
    const res = await fetch(`/api/research/suggestions/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      setSuggestions(prev => prev.filter(s => s.id !== id))
    }
    setActing(null)
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading...</p>

  const pending = suggestions.filter(s => s.status === 'pending')

  if (pending.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-lg p-6 text-center">
        <p className="text-sm text-neutral-500">No pending suggestions.</p>
        <p className="text-xs text-neutral-600 mt-1">New high-engagement accounts will appear here after ingestion.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">{pending.length} pending suggestion{pending.length !== 1 ? 's' : ''} — accounts with avg engagement ≥ 60 not yet in your competitors list.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {pending.map(s => (
          <div key={s.id} className="bg-bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">{s.handle}</p>
                {s.display_name && s.display_name !== s.handle && (
                  <p className="text-xs text-neutral-500">{s.display_name}</p>
                )}
              </div>
              <span className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-300 shrink-0">{s.niche}</span>
            </div>

            <div className="flex items-center gap-4 text-xs text-neutral-500">
              <span>Avg engagement: <span className="text-white font-medium">{s.avg_engagement}/100</span></span>
            </div>

            {s.sample_post && (
              <p className="text-xs text-neutral-400 line-clamp-3 border-l-2 border-border pl-3">{s.sample_post}</p>
            )}

            {s.tweet_url && (
              <a href={s.tweet_url} target="_blank" rel="noreferrer" className="text-xs text-accent-red hover:underline">
                View sample tweet →
              </a>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleAction(s.id, 'add')}
                disabled={acting === s.id}
                className="flex-1 px-3 py-2 bg-accent-red/10 text-accent-red border border-accent-red/20 rounded-lg text-xs font-medium hover:bg-accent-red/20 disabled:opacity-50 transition-colors"
              >
                {acting === s.id ? '...' : 'Add to Competitors'}
              </button>
              <button
                onClick={() => handleAction(s.id, 'dismiss')}
                disabled={acting === s.id}
                className="flex-1 px-3 py-2 bg-neutral-800 text-neutral-400 rounded-lg text-xs font-medium hover:text-white disabled:opacity-50 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Reddit Tab ───────────────────────────────────────────────────────────────

type RedditSubTab = 'trending' | 'posts' | 'subreddits'

function RedditTab() {
  const searchParams = useSearchParams()
  const topicParam = searchParams.get('topic') || ''
  const [subTab, setSubTab] = useState<RedditSubTab>(topicParam ? 'posts' : 'trending')

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border/50">
        {(['trending', 'posts', 'subreddits'] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              subTab === t
                ? 'border-accent-red text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t === 'trending' ? 'Trending' : t === 'posts' ? 'Posts' : 'Subreddits'}
          </button>
        ))}
      </div>

      {subTab === 'trending' && <RedditTrendingSubTab />}
      {subTab === 'posts' && <RedditPostsSubTab initialTopic={topicParam} />}
      {subTab === 'subreddits' && <RedditSubredditsSubTab />}
    </div>
  )
}

function RedditTrendingSubTab() {
  const [timeframe, setTimeframe] = useState<'1' | '7' | '30'>('7')
  const [niche, setNiche] = useState('')
  const [niches, setNiches] = useState<string[]>([])
  const [trends, setTrends] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<string>('')

  const fetchTrends = async () => {
    setLoading(true)
    const params = new URLSearchParams({ days: timeframe, limit: '50' })
    if (niche) params.set('niche', niche)
    const res = await fetch(`/api/reddit/trending?${params}`)
    const data = await res.json()
    setTrends(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/reddit/subreddits')
      .then(r => r.json())
      .then((d: any[]) => {
        const unique = [...new Set(d.map((s: any) => s.niche))].sort()
        setNiches(unique)
      })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchTrends() }, [timeframe, niche])

  const handleScrape = async () => {
    setScraping(true)
    setScrapeResult('')
    try {
      const res = await fetch('/api/reddit/scrape', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setScrapeResult(`Error: ${data.error}`)
      } else {
        setScrapeResult(`✓ Scraped ${data.scraped_subreddits} subreddits, ${data.posts_inserted} new posts, ${data.trends_detected} trends`)
        fetchTrends()
      }
    } catch {
      setScrapeResult('Scrape failed')
    }
    setScraping(false)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(['1', '7', '30'] as const).map(d => (
            <button
              key={d}
              onClick={() => setTimeframe(d)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                timeframe === d
                  ? 'bg-accent-red text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {d === '1' ? 'Today' : d === '7' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>

        <select
          value={niche}
          onChange={e => setNiche(e.target.value)}
          className="bg-bg-hover border border-border rounded-lg px-3 py-1.5 text-xs text-white min-w-[130px]"
        >
          <option value="">All niches</option>
          {niches.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <button
          onClick={handleScrape}
          disabled={scraping}
          className="ml-auto px-4 py-1.5 bg-accent-red text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {scraping ? 'Scraping...' : 'Scrape Now'}
        </button>
      </div>

      {scrapeResult && (
        <p className={`text-xs px-3 py-2 rounded-lg ${scrapeResult.startsWith('Error') ? 'bg-red-950/30 text-red-400' : 'bg-green-950/30 text-green-400'}`}>
          {scrapeResult}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : trends.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-sm text-neutral-500">No trending data yet.</p>
          <p className="text-xs text-neutral-600 mt-1">Hit "Scrape Now" to pull Reddit posts and detect trends.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trends.map((t: any) => (
            <div key={t.id} className="bg-bg-card border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-semibold text-white leading-tight">{t.topic}</p>
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 shrink-0">{t.niche}</span>
              </div>
              <div className="flex gap-4 text-xs text-neutral-500">
                <span><span className="text-white font-medium">{t.mention_count}</span> mentions</span>
                <span>avg score <span className="text-white font-medium">{Math.round(t.avg_score)}</span></span>
              </div>
              {t.sample_titles?.length > 0 && (
                <ul className="space-y-1">
                  {(t.sample_titles as any[]).slice(0, 3).map((item, i) => {
                    const title = typeof item === 'string' ? item : item?.title || ''
                    const permalink = typeof item === 'string' ? null : item?.permalink || null
                    return (
                      <li key={i} className="text-xs text-neutral-500 line-clamp-1 border-l border-border/60 pl-2">
                        {permalink ? (
                          <a href={permalink} target="_blank" rel="noopener noreferrer" className="hover:text-accent-red hover:underline transition-colors">
                            {title}
                          </a>
                        ) : title}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const signalColors: Record<string, string> = {
  high: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-neutral-700 text-neutral-400',
}

function RedditPostsSubTab({ initialTopic = '' }: { initialTopic?: string }) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [niche, setNiche] = useState('')
  const [subredditFilter, setSubredditFilter] = useState('')
  const [topicFilter, setTopicFilter] = useState(initialTopic)
  const [signalFilter, setSignalFilter] = useState('')
  const [sort, setSort] = useState<'score' | 'date'>('score')
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('all')
  const [niches, setNiches] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/reddit/subreddits')
      .then(r => r.json())
      .then((d: any[]) => {
        const unique = [...new Set(d.map((s: any) => s.niche))].sort()
        setNiches(unique)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100', sort })
    if (niche) params.set('niche', niche)
    if (subredditFilter.trim()) params.set('subreddit', subredditFilter.trim())
    if (topicFilter.trim()) params.set('topic', topicFilter.trim())
    if (signalFilter) params.set('signal', signalFilter)
    if (dateFilter === 'today') {
      const today = new Date(); today.setHours(0,0,0,0)
      params.set('since', today.toISOString())
    } else if (dateFilter === 'week') {
      const week = new Date(); week.setDate(week.getDate() - 7)
      params.set('since', week.toISOString())
    }
    fetch(`/api/reddit/posts?${params}`)
      .then(r => r.json())
      .then(d => { setPosts(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [niche, subredditFilter, topicFilter, signalFilter, sort, dateFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={niche}
          onChange={e => setNiche(e.target.value)}
          className="bg-bg-hover border border-border rounded-lg px-3 py-1.5 text-xs text-white min-w-[130px]"
        >
          <option value="">All niches</option>
          {niches.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input
          type="text"
          value={subredditFilter}
          onChange={e => setSubredditFilter(e.target.value)}
          placeholder="Filter subreddit..."
          className="bg-bg-hover border border-border rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 w-40"
        />
        <input
          type="text"
          value={topicFilter}
          onChange={e => setTopicFilter(e.target.value)}
          placeholder="Filter topic..."
          className="bg-bg-hover border border-border rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 w-36"
        />
        {topicFilter && (
          <button onClick={() => setTopicFilter('')} className="text-xs text-neutral-500 hover:text-white">
            ✕ clear
          </button>
        )}
        <select
          value={signalFilter}
          onChange={e => setSignalFilter(e.target.value)}
          className="bg-bg-hover border border-border rounded-lg px-3 py-1.5 text-xs text-white"
        >
          <option value="">All signals</option>
          <option value="high">🟢 High signal</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">⚪ Low (headlines)</option>
        </select>
        {/* Date filter */}
        <div className="flex gap-1">
          {([['today', 'Today'], ['week', 'This Week'], ['all', 'All']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setDateFilter(val)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                dateFilter === val ? 'bg-accent-red text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 ml-auto">
          {(['score', 'date'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                sort === s ? 'bg-accent-red text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {s === 'score' ? 'Top Score' : 'Latest'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-neutral-500">Loading...</p>
        ) : posts.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No posts found. Run a scrape first.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right px-3 py-3 text-xs text-neutral-500 font-medium w-16">Score</th>
                <th className="text-left px-3 py-3 text-xs text-neutral-500 font-medium">Title</th>
                <th className="text-left px-3 py-3 text-xs text-neutral-500 font-medium w-20">Signal</th>
                <th className="text-left px-3 py-3 text-xs text-neutral-500 font-medium w-28">Subreddit</th>
                <th className="text-right px-3 py-3 text-xs text-neutral-500 font-medium w-20">Comments</th>
                <th className="text-right px-3 py-3 text-xs text-neutral-500 font-medium w-24">Post Date</th>
                <th className="text-right px-3 py-3 text-xs text-neutral-500 font-medium w-24">Scraped</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p: any) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-bg-hover/30">
                  <td className="px-3 py-2.5 text-right text-xs font-medium text-white">{p.score?.toLocaleString()}</td>
                  <td className="px-3 py-2.5">
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-neutral-300 hover:text-white hover:underline line-clamp-2"
                    >
                      {p.title}
                    </a>
                    {p.flair && (
                      <span className="text-xs text-neutral-600 ml-1">[{p.flair}]</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {p.signal_strength && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${signalColors[p.signal_strength] || signalColors.low}`}>
                        {p.signal_strength}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs text-neutral-400">r/{p.reddit_subreddits?.subreddit}</span>
                    <span className="text-xs text-neutral-600 ml-1 block">{p.reddit_subreddits?.niche}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-neutral-500">{p.num_comments?.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-neutral-500">
                    {new Date(p.created_utc).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-neutral-400">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function RedditSubredditsSubTab() {
  const [subreddits, setSubreddits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newSub, setNewSub] = useState('')
  const [newNiche, setNewNiche] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const fetchSubs = () => {
    fetch('/api/reddit/subreddits')
      .then(r => r.json())
      .then(d => { setSubreddits(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchSubs() }, [])

  const addSubreddit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSub.trim() || !newNiche) return
    setAdding(true)
    setError('')
    const res = await fetch('/api/reddit/subreddits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subreddit: newSub.trim(), niche: newNiche }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to add')
    } else {
      setSubreddits(prev => [...prev, data].sort((a, b) => a.niche.localeCompare(b.niche) || a.subreddit.localeCompare(b.subreddit)))
      setNewSub('')
    }
    setAdding(false)
  }

  const deleteSub = async (id: number) => {
    const res = await fetch(`/api/reddit/subreddits/${id}`, { method: 'DELETE' })
    if (res.ok) setSubreddits(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-5">
      {/* Add form */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Add Subreddit</h3>
        <form onSubmit={addSubreddit} className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1 flex-1 min-w-[150px]">
            <label className="text-xs text-neutral-500">Subreddit name</label>
            <input
              type="text"
              value={newSub}
              onChange={e => setNewSub(e.target.value)}
              placeholder="e.g. bitcoin"
              className="w-full bg-bg-hover border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Niche</label>
            <select
              value={newNiche}
              onChange={e => setNewNiche(e.target.value)}
              className="bg-bg-hover border border-border rounded-lg px-3 py-2 text-sm text-white min-w-[130px]"
              required
            >
              <option value="">Select niche...</option>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 bg-accent-red text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </form>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-neutral-500">Loading...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs text-neutral-500 font-medium">Subreddit</th>
                <th className="text-left px-4 py-3 text-xs text-neutral-500 font-medium">Niche</th>
                <th className="text-left px-4 py-3 text-xs text-neutral-500 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {subreddits.map(s => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-bg-hover/30">
                  <td className="px-4 py-3 text-white font-medium">r/{s.subreddit}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">{s.niche}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${s.active ? 'text-green-500' : 'text-neutral-500'}`}>
                      {s.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteSub(s.id)}
                      className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
