'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import MetricCard from '@/components/MetricCard'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function ClientDetail() {
  const params = useParams()
  const [client, setClient] = useState<any>(null)
  const [metrics, setMetrics] = useState<any[]>([])
  const [twitterStats, setTwitterStats] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/clients/${params.id}`).then(r => r.json()).then(c => {
      setClient(c)
      if (c.twitter_url) {
        fetch(`/api/clients/${params.id}/twitter-stats`).then(r => r.json()).then(setTwitterStats)
      }
    })
    fetch(`/api/clients/${params.id}/metrics`).then(r => r.json()).then(m => {
      setMetrics(m.map((item: any) => ({ ...item, data: JSON.parse(item.data) })).reverse())
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
            {client.vertical === 'trading_platform' ? 'Trading Platform' : client.vertical === 'ai_trading' ? 'AI Trading' : 'Gaming / Web3'}
          </span>
        </div>
        <Link
          href={`/clients/${params.id}/submit`}
          className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red-hover"
        >
          Submit Weekly Metrics
        </Link>
      </div>

      {(client.vertical === 'trading_platform' || client.vertical === 'ai_trading') && latest ? (
        <>
          <div className={`grid gap-4 ${client.vertical === 'ai_trading' ? 'grid-cols-3' : 'grid-cols-4'}`}>
            <MetricCard
              label="Onboarded Users"
              value={latest.onboarded_users?.toLocaleString()}
              change={prev ? getChange(latest.onboarded_users, prev.onboarded_users) : undefined}
            />
            {client.vertical === 'ai_trading' ? (
              <>
                <MetricCard
                  label="Deposits"
                  value={latest.deposits?.toLocaleString()}
                  change={prev ? getChange(latest.deposits, prev.deposits) : undefined}
                />
                <MetricCard
                  label="Conversion Rate"
                  value={latest.onboarded_users && latest.deposits ? `${((latest.deposits / latest.onboarded_users) * 100).toFixed(1)}%` : 'N/A'}
                  change={prev?.onboarded_users && prev?.deposits && latest.onboarded_users && latest.deposits
                    ? getChange((latest.deposits / latest.onboarded_users) * 100, (prev.deposits / prev.onboarded_users) * 100)
                    : undefined}
                />
              </>
            ) : (
              <>
                <MetricCard
                  label="Day 1 Retention"
                  value={`${latest.retention_day1}%`}
                  change={prev ? getChange(latest.retention_day1, prev.retention_day1) : undefined}
                />
                <MetricCard
                  label="Day 7 Retention"
                  value={`${latest.retention_day7}%`}
                  change={prev ? getChange(latest.retention_day7, prev.retention_day7) : undefined}
                />
                <MetricCard
                  label="Referral Source"
                  value={latest.referral_source || 'N/A'}
                />
              </>
            )}
          </div>

          {/* Volume Chart */}
          <div className="bg-bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-white mb-4">Daily Volume (Latest Week)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={latest.daily_volume ? Object.entries(latest.daily_volume).map(([day, vol]) => ({ day: day.charAt(0).toUpperCase() + day.slice(1), volume: vol })) : []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="day" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} tickFormatter={(v: number) => `$${(v / 1000000).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => [`$${(value / 1000000).toFixed(2)}M`, 'Volume']}
                />
                <Bar dataKey="volume" fill="#CC0000" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* User Trend */}
          {metrics.length > 1 && (
            <div className="bg-bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium text-white mb-4">Onboarded Users Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={metrics.map(m => ({ week: m.week_ending, users: m.data.onboarded_users }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="week" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="users" stroke="#CC0000" strokeWidth={2} dot={{ fill: '#CC0000' }} />
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

          {/* Engagement Chart */}
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

          {/* Follower Trend */}
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

      {/* Twitter Growth */}
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

      {/* Notes from latest */}
      {latest?.notes && (
        <div className="bg-bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-white mb-2">Latest Notes</h3>
          <p className="text-sm text-neutral-400">{latest.notes}</p>
        </div>
      )}
    </div>
  )
}
