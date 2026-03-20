'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import MetricCard from '@/components/MetricCard'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const OPPORTUNITY_TYPE_LABELS: Record<string, { label: string; color: string; tip: string }> = {
  question: { label: '❓ Question', color: 'bg-blue-500/20 text-blue-400', tip: 'Someone is asking for advice — answer genuinely, mention Milo if relevant.' },
  pain_point: { label: '😤 Pain Point', color: 'bg-red-500/20 text-red-400', tip: 'Someone is frustrated — empathise first, then offer a solution.' },
  recommendation_request: { label: '🔍 Seeking Recommendation', color: 'bg-yellow-500/20 text-yellow-400', tip: 'They want a tool recommendation — this is a direct opening.' },
  education: { label: '📚 Learning', color: 'bg-purple-500/20 text-purple-400', tip: 'Someone wants to learn — provide value first, naturally mention Milo.' },
  general: { label: '💬 Discussion', color: 'bg-neutral-700 text-neutral-400', tip: 'Join the conversation naturally — add insight, build credibility.' },
}

function RedditInceptionSection({ clientId }: { clientId: string }) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/clients/${clientId}/reddit-opportunities`)
      .then(r => r.json())
      .then(d => { setPosts(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [clientId])

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const copyForTeam = () => {
    const selectedPosts = posts.filter(p => selected.has(p.id))
    const text = selectedPosts.map((post, i) => {
      const typeInfo = OPPORTUNITY_TYPE_LABELS[post.opportunity_type] || OPPORTUNITY_TYPE_LABELS.general
      return [
        `${i + 1}. ${post.title}`,
        `   Link: ${post.permalink}`,
        `   Angle: ${typeInfo.tip}`,
      ].join('\n')
    }).join('\n\n')

    const full = `Reddit Engagement Tasks\n${'='.repeat(30)}\n\n${text}\n\nGo in, add genuine value, and naturally weave in the product where it fits. Do NOT spam or hard sell.`
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  if (loading) return (
    <div className="bg-bg-card border border-border rounded-lg p-6">
      <p className="text-sm text-neutral-500">Loading Reddit opportunities...</p>
    </div>
  )

  return (
    <div className="bg-bg-card border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">🎯 Reddit Inception Opportunities</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Select posts to copy as a brief for your team</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-600">{posts.length} opportunities</span>
          {selected.size > 0 && (
            <button
              onClick={copyForTeam}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors"
            >
              {copied ? '✓ Copied!' : `📋 Copy ${selected.size} for team`}
            </button>
          )}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-neutral-500">No opportunities right now.</p>
          <p className="text-xs text-neutral-600 mt-1">Run a Reddit scrape to pull fresh conversations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post: any) => {
            const typeInfo = OPPORTUNITY_TYPE_LABELS[post.opportunity_type] || OPPORTUNITY_TYPE_LABELS.general
            const isSelected = selected.has(post.id)
            return (
              <div
                key={post.id}
                onClick={() => toggleSelect(post.id)}
                className={`border rounded-lg p-4 space-y-2 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-white/40 bg-white/5'
                    : 'border-border/60 hover:border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Checkbox */}
                    <div className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-white border-white' : 'border-neutral-600'
                    }`}>
                      {isSelected && <span className="text-black text-xs leading-none">✓</span>}
                    </div>
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-sm font-medium text-white hover:text-accent-red hover:underline leading-snug flex-1"
                    >
                      {post.title}
                    </a>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded shrink-0 font-medium ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 pl-7">
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span>r/{post.reddit_subreddits?.subreddit}</span>
                    <span>·</span>
                    <span>{post.num_comments} comments</span>
                    <span>·</span>
                    <span>{post.score} upvotes</span>
                    <span>·</span>
                    <span className={`font-medium ${post.signal_strength === 'high' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {post.signal_strength} signal
                    </span>
                  </div>
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-accent-red/10 text-accent-red hover:bg-accent-red/20 transition-colors shrink-0"
                  >
                    💬 Go comment
                  </a>
                </div>

                {post.body && post.body.length > 20 && (
                  <p className="text-xs text-neutral-500 line-clamp-2 border-l-2 border-border pl-2 ml-7">
                    {post.body.substring(0, 200)}{post.body.length > 200 ? '...' : ''}
                  </p>
                )}

                <div className="bg-neutral-900 rounded px-3 py-2 ml-7">
                  <p className="text-xs text-neutral-400">
                    <span className="text-accent-red font-medium">Angle: </span>
                    {typeInfo.tip}
                  </p>
                </div>

                {post.matchedKeywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pl-7">
                    {post.matchedKeywords.slice(0, 4).map((kw: string) => (
                      <span key={kw} className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const VERTICAL_LABELS: Record<string, string> = {
  trading_platform: 'Trading Platform',
  ai_trading: 'AI Trading',
  cex: 'CEX / Exchange',
  gaming_web3: 'Gaming / Web3',
}

function parseMetricData(data: unknown) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return data
    }
  }
  return data
}

export default function ClientDetail() {
  const params = useParams()
  const [client, setClient] = useState<any>(null)
  const [metrics, setMetrics] = useState<any[]>([])
  const [twitterStats, setTwitterStats] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/clients/${params.id}?t=${Date.now()}`).then(r => r.json()).then(c => {
      setClient(c)
      if (c.twitter_url) {
        fetch(`/api/clients/${params.id}/twitter-stats?t=${Date.now()}`).then(r => r.json()).then(setTwitterStats)
      }
    })
    fetch(`/api/clients/${params.id}/metrics?t=${Date.now()}`)
      .then(r => r.json())
      .then(m => {
        setMetrics(
          m
            .map((item: any) => ({ ...item, data: parseMetricData(item.data) }))
            .reverse()
        )
      })
  }, [params.id])

  if (!client) return <div className="text-neutral-500">Loading...</div>

  const latest = metrics[metrics.length - 1]?.data
  const prev = metrics[metrics.length - 2]?.data

  const getChange = (a: number, b: number) => b ? Math.round(((a - b) / b) * 100) : undefined

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/clients" className="text-xs text-neutral-500 hover:text-white">Clients</Link>
            <span className="text-xs text-neutral-600">/</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{client.name}</h1>
          <span className="text-xs text-neutral-500">
            {VERTICAL_LABELS[client.vertical] || client.vertical}
          </span>
        </div>
        <Link
          href={`/clients/${params.id}/submit`}
          className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red-hover"
        >
          Submit Weekly Metrics
        </Link>
      </div>

      {client.vertical === 'trading_platform' && latest ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              label="Onboarded Users"
              value={latest.onboarded_users?.toLocaleString()}
              change={prev ? getChange(latest.onboarded_users, prev.onboarded_users) : undefined}
            />
            <MetricCard
              label="Day 1 Retention"
              value={latest.retention_day1 != null ? `${latest.retention_day1}%` : 'N/A'}
              change={prev?.retention_day1 != null ? getChange(latest.retention_day1, prev.retention_day1) : undefined}
            />
            <MetricCard
              label="Day 7 Retention"
              value={latest.retention_day7 != null ? `${latest.retention_day7}%` : 'N/A'}
              change={prev?.retention_day7 != null ? getChange(latest.retention_day7, prev.retention_day7) : undefined}
            />
            <MetricCard
              label="Referral Source"
              value={latest.referral_source || 'N/A'}
            />
          </div>
          {latest.daily_volume && (
            <div className="bg-bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium text-white mb-4">Daily Volume</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => ({ day: day.charAt(0).toUpperCase() + day.slice(1), volume: latest.daily_volume[day] || 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="day" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="volume" fill="#CC0000" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {metrics.length > 1 && (
            <div className="bg-bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium text-white mb-4">User Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={metrics.map(m => ({ week: m.week_ending, users: m.data.onboarded_users }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="week" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="users" stroke="#CC0000" strokeWidth={2} dot={{ fill: '#CC0000' }} name="Users" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : client.vertical === 'ai_trading' && latest ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              label="Onboarded Users"
              value={latest.onboarded_users?.toLocaleString()}
              change={prev ? getChange(latest.onboarded_users, prev.onboarded_users) : undefined}
            />
            <MetricCard
              label="Deposits"
              value={latest.deposits?.toLocaleString()}
              change={prev ? getChange(latest.deposits, prev.deposits) : undefined}
            />
            <MetricCard
              label="Active Users"
              value={latest.active_users != null ? latest.active_users.toLocaleString() : 'N/A'}
              change={prev?.active_users != null && latest.active_users != null ? getChange(latest.active_users, prev.active_users) : undefined}
            />
            <MetricCard
              label="Conversion Rate"
              value={latest.onboarded_users && latest.deposits ? `${((latest.deposits / latest.onboarded_users) * 100).toFixed(1)}%` : 'N/A'}
              change={prev?.onboarded_users && prev?.deposits && latest.onboarded_users && latest.deposits
                ? getChange((latest.deposits / latest.onboarded_users) * 100, (prev.deposits / prev.onboarded_users) * 100)
                : undefined}
            />
          </div>
          {metrics.length > 1 && (
            <div className="bg-bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium text-white mb-4">Users & Deposits Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={metrics.map(m => ({ week: m.week_ending, users: m.data.onboarded_users, deposits: m.data.deposits }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="week" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="users" stroke="#CC0000" strokeWidth={2} dot={{ fill: '#CC0000' }} name="Users" />
                  <Line type="monotone" dataKey="deposits" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} name="Deposits" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : client.vertical === 'cex' && latest ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Weekly Volume"
              value={latest.volume ? `$${latest.volume.toLocaleString()}` : 'N/A'}
              change={prev?.volume ? getChange(latest.volume, prev.volume) : undefined}
            />
            <MetricCard
              label="Onboarded Users"
              value={latest.onboarded_users ? latest.onboarded_users.toLocaleString() : 'TBD'}
              change={prev?.onboarded_users ? getChange(latest.onboarded_users, prev.onboarded_users) : undefined}
            />
          </div>
          {metrics.length > 1 && (
            <div className="bg-bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium text-white mb-4">Weekly Volume Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={metrics.map(m => ({ week: m.week_ending, volume: m.data.volume }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="week" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} tickFormatter={(v: number) => `$${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} formatter={(value: number) => [`$${(value / 1000000).toFixed(2)}M`, 'Volume']} />
                  <Bar dataKey="volume" fill="#CC0000" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : client.vertical === 'gaming_web3' && latest?.total_signups != null ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Total Signups"
              value={latest.total_signups?.toLocaleString()}
              change={prev?.total_signups ? getChange(latest.total_signups, prev.total_signups) : undefined}
            />
            <MetricCard
              label="Avg Daily Signups"
              value={latest.avg_daily_signups?.toString()}
            />
          </div>
          {metrics.length > 1 && (
            <div className="bg-bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium text-white mb-4">Signup Growth Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={metrics.map(m => ({ week: m.week_ending, signups: m.data.total_signups }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="week" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="signups" stroke="#CC0000" strokeWidth={2} dot={{ fill: '#CC0000' }} name="Signups" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : client.vertical === 'gaming_web3' && latest ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            {['twitter', 'tiktok', 'instagram', 'youtube'].map(platform => {
              const d = latest[platform]
              const p = prev?.[platform]
              if (!d) return null
              return (
                <MetricCard
                  key={platform}
                  label={`${platform.charAt(0).toUpperCase() + platform.slice(1)} Followers`}
                  value={d.followers?.toLocaleString()}
                  change={p ? getChange(d.followers, p.followers) : undefined}
                  subtitle={`${d.engagement_rate}% engagement`}
                />
              )
            })}
          </div>

          <div className="bg-bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-white mb-4">Engagement Rates by Platform</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={['twitter', 'tiktok', 'instagram', 'youtube'].filter(p => latest[p]).map(p => ({
                platform: p.charAt(0).toUpperCase() + p.slice(1),
                engagement: latest[p].engagement_rate,
                followers: latest[p].followers
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="platform" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="engagement" fill="#CC0000" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {metrics.length > 1 && (
            <div className="bg-bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium text-white mb-4">Follower Growth Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={metrics.map(m => ({
                  week: m.week_ending,
                  twitter: m.data.twitter?.followers,
                  tiktok: m.data.tiktok?.followers,
                  instagram: m.data.instagram?.followers,
                  youtube: m.data.youtube?.followers,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="week" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="twitter" stroke="#1DA1F2" strokeWidth={2} dot={{ fill: '#1DA1F2' }} />
                  <Line type="monotone" dataKey="tiktok" stroke="#ff0050" strokeWidth={2} dot={{ fill: '#ff0050' }} />
                  <Line type="monotone" dataKey="instagram" stroke="#E1306C" strokeWidth={2} dot={{ fill: '#E1306C' }} />
                  <Line type="monotone" dataKey="youtube" stroke="#FF0000" strokeWidth={2} dot={{ fill: '#FF0000' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <p className="text-neutral-500">No metrics submitted yet. Submit your first weekly report.</p>
      )}

      {client.twitter_url && twitterStats && twitterStats.currentFollowers !== null && (
        <div className="bg-bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-medium text-white">Twitter Growth</h3>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-neutral-500">Current Followers</p>
              <p className="text-lg font-semibold text-white">{twitterStats.currentFollowers.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Growth (30d)</p>
              <p className={`text-lg font-semibold ${twitterStats.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {twitterStats.growth >= 0 ? '+' : ''}{twitterStats.growth.toLocaleString()}
              </p>
            </div>
          </div>
          {twitterStats.snapshots.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-neutral-500 text-xs">
                  <th className="text-left py-1">Date</th>
                  <th className="text-right py-1">Followers</th>
                </tr>
              </thead>
              <tbody>
                {twitterStats.snapshots.slice(-7).map((s: any) => (
                  <tr key={s.snapshot_date} className="border-t border-border">
                    <td className="py-1.5 text-neutral-300">{s.snapshot_date}</td>
                    <td className="py-1.5 text-right text-white">{s.followers_count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Reddit Inception Opportunities */}
      {['ai_trading', 'cex', 'gaming_web3'].includes(client.vertical) && (
        <RedditInceptionSection clientId={String(client.id)} />
      )}
    </div>
  )
}
