'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function SubmitMetrics() {
  const params = useParams()
  const router = useRouter()
  const [client, setClient] = useState<any>(null)
  const [weekEnding, setWeekEnding] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Trading platform fields
  const [tradingData, setTradingData] = useState({
    onboarded_users: '',
    daily_volume: { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' },
    retention_day1: '',
    retention_day7: '',
    referral_source: '',
    notes: ''
  })

  // Gaming/Web3 fields
  const [gamingData, setGamingData] = useState({
    twitter: { followers: '', engagement_rate: '', likes: '', comments: '', impressions: '' },
    tiktok: { followers: '', engagement_rate: '', likes: '', comments: '', views: '' },
    instagram: { followers: '', engagement_rate: '', likes: '', comments: '', impressions: '' },
    youtube: { followers: '', engagement_rate: '', likes: '', comments: '', views: '' },
  })

  useEffect(() => {
    fetch(`/api/clients/${params.id}`).then(r => r.json()).then(setClient)
    // Default to upcoming Sunday
    const now = new Date()
    const dayOfWeek = now.getDay()
    const nextSunday = new Date(now)
    nextSunday.setDate(now.getDate() + (7 - dayOfWeek) % 7)
    setWeekEnding(nextSunday.toISOString().split('T')[0])
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const data = client.vertical === 'trading_platform'
      ? {
          onboarded_users: Number(tradingData.onboarded_users),
          daily_volume: Object.fromEntries(
            Object.entries(tradingData.daily_volume).map(([k, v]) => [k, Number(v)])
          ),
          retention_day1: Number(tradingData.retention_day1),
          retention_day7: Number(tradingData.retention_day7),
          referral_source: tradingData.referral_source,
          notes: tradingData.notes
        }
      : gamingData

    try {
      const res = await fetch(`/api/clients/${params.id}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_ending: weekEnding,
          metric_type: client.vertical,
          data
        })
      })
      if (res.ok) {
        router.push(`/clients/${params.id}`)
      } else {
        setError('Failed to submit metrics')
      }
    } catch {
      setError('Network error')
    }
    setSubmitting(false)
  }

  if (!client) return <div className="text-neutral-500">Loading...</div>

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Submit Weekly Metrics</h1>
        <p className="text-sm text-neutral-500 mt-1">{client.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-bg-card border border-border rounded-lg p-6">
          <label className="block text-xs text-neutral-500 mb-1">Week Ending (Sunday)</label>
          <input type="date" value={weekEnding} onChange={e => setWeekEnding(e.target.value)} required className="w-64" />
        </div>

        {client.vertical === 'trading_platform' ? (
          <>
            <div className="bg-bg-card border border-border rounded-lg p-6 space-y-4">
              <h3 className="text-sm font-medium text-white">User Metrics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Onboarded Users</label>
                  <input type="number" value={tradingData.onboarded_users} onChange={e => setTradingData({...tradingData, onboarded_users: e.target.value})} required className="w-full" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Day 1 Retention %</label>
                  <input type="number" step="0.1" value={tradingData.retention_day1} onChange={e => setTradingData({...tradingData, retention_day1: e.target.value})} required className="w-full" placeholder="0.0" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Day 7 Retention %</label>
                  <input type="number" step="0.1" value={tradingData.retention_day7} onChange={e => setTradingData({...tradingData, retention_day7: e.target.value})} required className="w-full" placeholder="0.0" />
                </div>
              </div>
            </div>

            <div className="bg-bg-card border border-border rounded-lg p-6 space-y-4">
              <h3 className="text-sm font-medium text-white">Daily Volume</h3>
              <div className="grid grid-cols-7 gap-3">
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                  <div key={day}>
                    <label className="block text-xs text-neutral-500 mb-1 capitalize">{day}</label>
                    <input
                      type="number"
                      value={(tradingData.daily_volume as any)[day]}
                      onChange={e => setTradingData({...tradingData, daily_volume: {...tradingData.daily_volume, [day]: e.target.value}})}
                      required className="w-full" placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-bg-card border border-border rounded-lg p-6 space-y-4">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Referral Source</label>
                <input type="text" value={tradingData.referral_source} onChange={e => setTradingData({...tradingData, referral_source: e.target.value})} className="w-full" placeholder="e.g. Twitter campaigns" />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Notes</label>
                <textarea value={tradingData.notes} onChange={e => setTradingData({...tradingData, notes: e.target.value})} className="w-full h-24 resize-none" placeholder="Weekly observations..." />
              </div>
            </div>
          </>
        ) : (
          <>
            {(['twitter', 'tiktok', 'instagram', 'youtube'] as const).map(platform => {
              const isVideo = platform === 'tiktok' || platform === 'youtube'
              return (
                <div key={platform} className="bg-bg-card border border-border rounded-lg p-6 space-y-4">
                  <h3 className="text-sm font-medium text-white capitalize">{platform}</h3>
                  <div className="grid grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Followers</label>
                      <input type="number" value={(gamingData[platform] as any).followers} onChange={e => setGamingData({...gamingData, [platform]: {...gamingData[platform], followers: e.target.value}})} className="w-full" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Engagement %</label>
                      <input type="number" step="0.1" value={(gamingData[platform] as any).engagement_rate} onChange={e => setGamingData({...gamingData, [platform]: {...gamingData[platform], engagement_rate: e.target.value}})} className="w-full" placeholder="0.0" />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Likes</label>
                      <input type="number" value={(gamingData[platform] as any).likes} onChange={e => setGamingData({...gamingData, [platform]: {...gamingData[platform], likes: e.target.value}})} className="w-full" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Comments</label>
                      <input type="number" value={(gamingData[platform] as any).comments} onChange={e => setGamingData({...gamingData, [platform]: {...gamingData[platform], comments: e.target.value}})} className="w-full" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">{isVideo ? 'Views' : 'Impressions'}</label>
                      <input type="number" value={(gamingData[platform] as any)[isVideo ? 'views' : 'impressions']} onChange={e => setGamingData({...gamingData, [platform]: {...gamingData[platform], [isVideo ? 'views' : 'impressions']: e.target.value}})} className="w-full" placeholder="0" />
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red-hover disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Metrics'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-6 py-2.5 bg-bg-card border border-border text-neutral-400 text-sm rounded-lg hover:text-white">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
