'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import DataTable from '@/components/DataTable'

const nicheOptions = ['CEX', 'DEX', 'Gaming', 'Memecoin', 'NFT', 'DeFi', 'Social', 'Other']
const platformOptions = ['twitter', 'tiktok', 'instagram', 'youtube', 'telegram', 'discord']

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', niche: 'CEX', platform: 'twitter', account_url: '', tracked_type: 'specific' })

  useEffect(() => {
    fetch('/api/competitors').then(r => r.json()).then(setCompetitors)
  }, [])

  const addCompetitor = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    if (res.ok) {
      const comp = await res.json()
      setCompetitors(prev => [comp, ...prev])
      setForm({ name: '', niche: 'CEX', platform: 'twitter', account_url: '', tracked_type: 'specific' })
      setShowForm(false)
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Competitor',
      render: (row: any) => (
        <Link href={`/competitors/${row.id}`} className="text-white hover:text-accent-red font-medium">
          {row.name}
        </Link>
      )
    },
    {
      key: 'niche',
      label: 'Niche',
      render: (row: any) => <span className="text-xs bg-neutral-800 px-2 py-1 rounded">{row.niche}</span>
    },
    {
      key: 'platform',
      label: 'Platform',
      render: (row: any) => <span className="capitalize">{row.platform}</span>
    },
    {
      key: 'tracked_type',
      label: 'Type',
      render: (row: any) => (
        <span className={`text-xs px-2 py-1 rounded ${row.tracked_type === 'specific' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
          {row.tracked_type === 'specific' ? 'Specific' : 'Niche Broad'}
        </span>
      )
    },
    {
      key: 'account_url',
      label: 'URL',
      sortable: false,
      render: (row: any) => row.account_url ? (
        <a href={row.account_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-red hover:underline truncate block max-w-[200px]">
          {row.account_url}
        </a>
      ) : <span className="text-neutral-600">—</span>
    },
    {
      key: 'created_at',
      label: 'Added',
      render: (row: any) => new Date(row.created_at).toLocaleDateString()
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Competitors</h1>
          <p className="text-sm text-neutral-500 mt-1">Track and analyze competitor accounts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red-hover"
        >
          {showForm ? 'Cancel' : 'Add Competitor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addCompetitor} className="bg-bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Name</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full" placeholder="e.g. BinanceUS" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Niche</label>
              <select value={form.niche} onChange={e => setForm({...form, niche: e.target.value})} className="w-full">
                {nicheOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Platform</label>
              <select value={form.platform} onChange={e => setForm({...form, platform: e.target.value})} className="w-full">
                {platformOptions.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            {form.platform === 'twitter' ? (
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Twitter Handle</label>
                <input
                  type="text"
                  value={form.account_url.replace('https://twitter.com/', '')}
                  onChange={e => {
                    const handle = e.target.value.replace(/^@/, '')
                    setForm({...form, account_url: handle ? `https://twitter.com/${handle}` : ''})
                  }}
                  className="w-full"
                  placeholder="@binance"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Account URL</label>
                <input type="url" value={form.account_url} onChange={e => setForm({...form, account_url: e.target.value})} className="w-full" placeholder="https://..." />
              </div>
            )}
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Tracked Type</label>
              <select value={form.tracked_type} onChange={e => setForm({...form, tracked_type: e.target.value})} className="w-full">
                <option value="specific">Specific</option>
                <option value="niche_broad">Niche Broad</option>
              </select>
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red-hover">
            Add Competitor
          </button>
        </form>
      )}

      <div className="bg-bg-card border border-border rounded-lg">
        <DataTable columns={columns} data={competitors} />
      </div>
    </div>
  )
}
