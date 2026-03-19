'use client'

import { useEffect, useState } from 'react'

interface SamplePost {
  title: string
  permalink: string
}

interface CompetitorPost {
  content: string
  hook_type: string
  engagement_score: number
  competitor_name: string
}

interface Opportunity {
  client_id: number
  client_name: string
  niche: string
  topic: string
  reddit_signal: {
    mention_count: number
    avg_score: number
    sample_posts: SamplePost[]
  }
  competitor_signal: {
    post_count: number
    top_posts: CompetitorPost[]
  }
  opportunity_score: number
  suggested_angle: string
}

interface ClientOpportunities {
  client_id: number
  client_name: string
  niche: string
  opportunities: Opportunity[]
}

const NICHE_LABELS: Record<string, string> = {
  gaming_web3: 'Gaming / Web3',
  cex: 'CEX',
  ai_trading: 'AI Trading',
}

export default function StrategyPage() {
  const [data, setData] = useState<ClientOpportunities[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/strategy/opportunities?t=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch opportunities')
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Strategy Intelligence</h1>
        <div className="flex items-center gap-3 text-neutral-500">
          <div className="w-4 h-4 border-2 border-accent-red border-t-transparent rounded-full animate-spin" />
          Loading campaign opportunities…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Strategy Intelligence</h1>
        <div className="bg-bg-card border border-red-900/50 rounded-lg p-4 text-red-400 text-sm">
          Error: {error}
        </div>
      </div>
    )
  }

  const hasAnyOpportunities = data.some((c) => c.opportunities.length > 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Strategy Intelligence</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Cross-referenced campaign opportunities from Reddit trends &amp; competitor signals
        </p>
      </div>

      {!hasAnyOpportunities && (
        <div className="bg-bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-neutral-400">
            No opportunities detected yet — run a Reddit scrape and competitor sync first.
          </p>
        </div>
      )}

      {data.map((client) => (
        <div key={client.client_id} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{client.client_name}</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-border">
              {NICHE_LABELS[client.niche] || client.niche}
            </span>
            {client.opportunities.length > 0 && (
              <span className="text-xs text-neutral-500">
                {client.opportunities.length} opportunit{client.opportunities.length === 1 ? 'y' : 'ies'}
              </span>
            )}
          </div>

          {client.opportunities.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-lg p-4 text-sm text-neutral-500">
              No cross-referenced opportunities for this client yet.
            </div>
          ) : (
            <div className="space-y-3">
              {client.opportunities.map((opp, idx) => (
                <OpportunityCard key={`${opp.topic}-${idx}`} opportunity={opp} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function OpportunityCard({ opportunity: opp }: { opportunity: Opportunity }) {
  return (
    <div className="bg-bg-card border border-border rounded-lg p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium px-2.5 py-1 rounded bg-accent-red/10 text-accent-red border border-accent-red/20">
            {opp.topic}
          </span>
          <span className="text-xs text-neutral-500">
            Score: <span className="text-white font-medium">{opp.opportunity_score.toLocaleString()}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Reddit Signal */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Reddit Signal</h4>
          <div className="text-sm text-neutral-300">
            <span className="text-white font-medium">{opp.reddit_signal.mention_count}</span> mentions
            {' · '}avg score <span className="text-white font-medium">{Math.round(opp.reddit_signal.avg_score)}</span>
          </div>
          {opp.reddit_signal.sample_posts.length > 0 && (
            <ul className="space-y-1">
              {opp.reddit_signal.sample_posts.map((post, i) => (
                <li key={i} className="text-xs text-neutral-400">
                  <a
                    href={`https://reddit.com${post.permalink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent-red transition-colors"
                  >
                    → {post.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Competitor Signal */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Competitor Signal</h4>
          <div className="text-sm text-neutral-300">
            <span className="text-white font-medium">{opp.competitor_signal.post_count}</span> competitor post{opp.competitor_signal.post_count !== 1 ? 's' : ''} using this angle
          </div>
          {opp.competitor_signal.top_posts.slice(0, 2).map((post, i) => (
            <div key={i} className="text-xs text-neutral-500 border-l-2 border-border pl-3">
              <span className="text-neutral-300">{post.competitor_name}</span>
              {' · '}
              <span className="text-neutral-400">{post.hook_type}</span>
              {' · '}
              engagement {post.engagement_score}
              <p className="text-neutral-500 mt-0.5 line-clamp-2">{post.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Angle */}
      <div className="bg-accent-red/5 border border-accent-red/15 rounded-md p-3">
        <h4 className="text-xs font-medium text-accent-red mb-1">Suggested Angle</h4>
        <p className="text-sm text-neutral-300">{opp.suggested_angle}</p>
      </div>
    </div>
  )
}
