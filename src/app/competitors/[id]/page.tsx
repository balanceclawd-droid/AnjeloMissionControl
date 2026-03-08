'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import DataTable from '@/components/DataTable'

export default function CompetitorDetail() {
  const params = useParams()
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/competitors/${params.id}`).then(r => r.json()).then(setData)
  }, [params.id])

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
        <span className={`font-semibold ${row.engagement_score >= 80 ? 'text-green-400' : row.engagement_score >= 50 ? 'text-yellow-400' : 'text-neutral-400'}`}>
          {row.engagement_score}
        </span>
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

      <div className="bg-bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-medium text-white">Tracked Posts ({data.posts.length})</h2>
        </div>
        <DataTable columns={columns} data={data.posts} />
      </div>
    </div>
  )
}
