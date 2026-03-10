'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import AlertCard from '@/components/AlertCard'
import MetricCard from '@/components/MetricCard'
import PatternCard from '@/components/PatternCard'

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const dismissAlert = async (id: number) => {
    await fetch('/api/alerts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, dismissed: true })
    })
    setData((prev: any) => {
      if (!prev) return prev
      return {
        ...prev,
        alerts: prev.alerts.filter((a: any) => a.id !== id),
        stats: { ...prev.stats, active_alerts: prev.stats.active_alerts - 1 }
      }
    })
  }

  if (loading) return <div className="text-neutral-500">Loading...</div>
  if (!data) return <div className="text-neutral-500">Failed to load dashboard</div>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Intelligence Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">Real-time competitive intelligence & client performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="Active Clients" value={data.stats.total_clients} />
        <MetricCard label="Competitors" value={data.stats.total_competitors} />
        <MetricCard label="Posts Tracked" value={data.stats.total_posts} />
        <MetricCard label="Active Patterns" value={data.stats.active_patterns} />
        <MetricCard label="Open Alerts" value={data.stats.active_alerts} />
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Alert Feed */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Alert Feed</h2>
            <Link href="/alerts" className="text-xs text-accent-red hover:underline">View All</Link>
          </div>
          {data.alerts.length === 0 ? (
            <p className="text-sm text-neutral-600">No active alerts</p>
          ) : (
            <div className="space-y-3">
              {data.alerts.map((alert: any) => (
                <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
              ))}
            </div>
          )}
        </div>

        {/* Top Patterns */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Top Patterns</h2>
            <Link href="/patterns" className="text-xs text-accent-red hover:underline">View All</Link>
          </div>
          {data.patterns?.map((pattern: any) => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      </div>

      {/* Client Performance Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Client Performance</h2>
          <Link href="/clients" className="text-xs text-accent-red hover:underline">Manage Clients</Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {data.clientGrid.map((client: any) => (
            <ClientPerformanceCard key={client.id} client={client} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ClientPerformanceCard({ client }: { client: any }) {
  const latest = client.latest_metric?.data
  const prev = client.prev_metric?.data

  const getChange = (current: number, previous: number) => {
    if (!previous) return undefined
    return Math.round(((current - previous) / previous) * 100)
  }

  return (
    <Link href={`/clients/${client.id}`} className="block bg-bg-card border border-border rounded-lg p-5 hover:border-border-light transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">{client.name}</h3>
          <span className="text-xs text-neutral-500">
            {client.vertical === 'trading_platform' ? 'Trading Platform' : client.vertical === 'ai_trading' ? 'AI Trading' : client.vertical === 'cex' ? 'CEX / Exchange' : 'Gaming / Web3'}
          </span>
        </div>
        <span className="text-xs text-neutral-600">{client.latest_metric?.week_ending || 'No data'}</span>
      </div>
      {client.vertical === 'cex' && latest ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-neutral-500">Volume</p>
            <p className="text-lg font-semibold text-white">${(latest.volume / 1000000).toFixed(2)}M</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Users</p>
            <p className="text-lg font-semibold text-white">{latest.onboarded_users?.toLocaleString() || 'TBD'}</p>
          </div>
        </div>
      ) : client.vertical === 'ai_trading' && latest ? (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-neutral-500">Users</p>
            <p className="text-lg font-semibold text-white">{latest.onboarded_users?.toLocaleString()}</p>
            {prev && <TrendIndicator current={latest.onboarded_users} previous={prev.onboarded_users} />}
          </div>
          <div>
            <p className="text-xs text-neutral-500">Deposits</p>
            <p className="text-lg font-semibold text-white">{latest.deposits?.toLocaleString()}</p>
            {prev && <TrendIndicator current={latest.deposits} previous={prev.deposits} />}
          </div>
          <div>
            <p className="text-xs text-neutral-500">Conv. Rate</p>
            <p className="text-lg font-semibold text-white">
              {latest.onboarded_users && latest.deposits ? `${((latest.deposits / latest.onboarded_users) * 100).toFixed(1)}%` : 'N/A'}
            </p>
          </div>
        </div>
      ) : client.vertical === 'gaming_web3' && latest ? (
        <div className="grid grid-cols-4 gap-3">
          {['twitter', 'tiktok', 'instagram', 'youtube'].map(platform => {
            const d = latest[platform]
            const p = prev?.[platform]
            if (!d) return null
            return (
              <div key={platform}>
                <p className="text-xs text-neutral-500 capitalize">{platform}</p>
                <p className="text-lg font-semibold text-white">{(d.followers / 1000).toFixed(1)}k</p>
                {p && <TrendIndicator current={d.followers} previous={p.followers} />}
              </div>
            )
          })}
        </div>
      ) : client.vertical === 'gaming_web3' && client.twitter_snapshots?.length ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-neutral-500">Twitter Followers</p>
            <p className="text-lg font-semibold text-white">{client.twitter_snapshots[0].followers_count.toLocaleString()}</p>
            {client.twitter_snapshots[1] && (
              <TrendIndicator current={client.twitter_snapshots[0].followers_count} previous={client.twitter_snapshots[1].followers_count} />
            )}
          </div>
          <div>
            <p className="text-xs text-neutral-500">As of</p>
            <p className="text-sm text-neutral-300">{client.twitter_snapshots[0].snapshot_date}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-600">No metrics submitted yet</p>
      )}
    </Link>
  )
}

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null
  const change = Math.round(((current - previous) / previous) * 100)
  return (
    <span className={`text-xs font-medium ${change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-neutral-500'}`}>
      {change > 0 ? '↑' : change < 0 ? '↓' : '—'} {Math.abs(change)}%
    </span>
  )
}
