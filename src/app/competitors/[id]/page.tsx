'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import DataTable from '@/components/DataTable'

export default function CompetitorDetail() {
  const params = useParams()
  const [data, setData] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const fetchData = () => {
    fetch(`/api/competitors/${params.id}`).then(r => r.json()).then(setData)
  }

  useEffect(() => {
    fetchData()
  }, [params.id])

  const syncTwitter = async () => {
    setSyncing(true)
    setToast(null)
    try {
      const res = await fetch(`/api/twitter/sync/${params.id}`, { method: 'POST' })
      const result = await res.json()
      if (res.ok) {
        setToast(`Synced ${result.synced} new tweets`)
        fetchData()
      } else {
        setToast(`Error: ${result.error}`)
      }
    } catch {
      setToast('Sync failed — check console for details')
    } finally {
      setSyncing(false)
      setTimeout(() => setToast(null), 5000)
    }
  }

  if (!data) return <div className="text-neutral-500">Loading...</div>

  const columns = [
    {
      key: 'posted_at',
      label: 'Date',
      render: (row: any) => new Date(row.posted_at).toLocaleDateString()
    },
    {
      key: 'content',
      label: 'Content',
      sortable: false,
      render: (row: any) => (
        <p className="text-sm max-w-md truncate">{row.content || '—'}</p>
      )
    },
    {
      key: 'hook_type',
      label: 'Hook',
      render: (row: any) => row.hook_type ? (
        <span className="text-xs bg-neutral-800 px-2 py-1 rounded">{row.hook_type}</span>
      ) : '—'
    },
    {
      key: 'structure',
      label: 'Structure',
      render: (row: any) => row.structure ? (
        <span className="text-xs bg-neutral-800 px-2 py-1 rounded">{row.structure}</span>
      ) : '—'
    },
    {
      key: 'engagement_score',
      label: 'Score',
      render: (row: any) => (
        <div className="flex flex-col gap-0.5">
          <span className={`font-semibold ${row.engagement_score >= 80 ? 'text-green-400' : row.engagement_score >= 50 ? 'text-yellow-400' : 'text-neutral-400'}`}>
            {row.engagement_score}
          </span>
          {row.conversation_depth > 0 && (
            <span className="text-xs text-blue-400">💬 {row.conversation_depth}</span>
          )}
        </div>
      )
    },
    {
      key: 'flagged_as_pattern',
      label: 'Pattern',
      render: (row: any) => row.flagged_as_pattern ? (
        <span className="text-xs bg-accent-red/20 text-accent-red px-2 py-1 rounded">Flagged</span>
      ) : '—'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/competitors" className="text-xs text-neutral-500 hover:text-white">Competitors</Link>
          <span className="text-xs text-neutral-600">/</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{data.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs bg-neutral-800 px-2 py-1 rounded">{data.niche}</span>
              <span className="text-xs text-neutral-500 capitalize">{data.platform}</span>
              {data.account_url && (
                <a href={data.account_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-red hover:underline">
                  View Profile
                </a>
              )}
            </div>
          </div>
          {data.platform === 'twitter' && (
            <button
              onClick={syncTwitter}
              disabled={syncing}
              className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? 'Syncing...' : 'Sync from Twitter'}
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className={`px-4 py-3 rounded-lg text-sm ${toast.startsWith('Error') || toast.startsWith('Sync failed') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
          {toast}
        </div>
      )}

      <div className="bg-bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-medium text-white">Tracked Posts ({data.posts.length})</h2>
        </div>
        <DataTable columns={columns} data={data.posts} />
      </div>
    </div>
  )
}
