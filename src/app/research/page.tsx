'use client'
import { useEffect, useState } from 'react'

const NICHES = ['CEX', 'DEX', 'DeFi', 'Gaming', 'Memecoin', 'Other']

type Keyword = { id: number; niche: string; keyword: string; active: boolean; created_at: string }
type Suggestion = {
  id: number; handle: string; display_name: string; niche: string
  avg_engagement: number; sample_post: string; tweet_url: string; status: string
}
type Report = {
  id: number; report_type: string; niche: string; summary: string
  top_posts: any[]; new_accounts: any[]; created_at: string
}

export default function ResearchPage() {
  const [tab, setTab] = useState<'keywords' | 'daily' | 'weekly' | 'suggestions'>('keywords')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Market Research</h1>
        <p className="text-sm text-neutral-500 mt-1">Keyword tracking, scraped intelligence, and competitor discovery</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['keywords', 'daily', 'weekly', 'suggestions'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-accent-red text-white'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            {t === 'keywords' ? 'Keywords' : t === 'daily' ? 'Daily Reports' : t === 'weekly' ? 'Weekly Overview' : 'Competitor Suggestions'}
          </button>
        ))}
      </div>

      {tab === 'keywords' && <KeywordsTab />}
      {tab === 'daily' && <DailyReportsTab />}
      {tab === 'weekly' && <WeeklyOverviewTab />}
      {tab === 'suggestions' && <SuggestionsTab />}
    </div>
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
