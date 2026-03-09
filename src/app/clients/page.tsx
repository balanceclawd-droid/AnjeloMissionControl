'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import DataTable from '@/components/DataTable'

const VERTICAL_LABELS: Record<string, string> = {
  trading_platform: 'Trading Platform',
  gaming_web3: 'Gaming / Web3',
  ai_trading: 'AI Trading',
  cex: 'CEX / Exchange',
  defi: 'DeFi',
  nft: 'NFT',
  social: 'Social',
  other: 'Other',
}

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('all')
  const [form, setForm] = useState({ name: '', vertical: 'trading_platform' })

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients)
  }, [])

  const filteredClients = activeTab === 'all' ? clients : clients.filter(c => c.vertical === activeTab)
  const verticals = ['all', ...Array.from(new Set(clients.map(c => c.vertical)))]

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    if (res.ok) {
      const client = await res.json()
      setClients(prev => [client, ...prev])
      setForm({ name: '', vertical: 'trading_platform' })
      setShowForm(false)
    }
  }

  const toggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'archived' : 'active'
    await fetch(`/api/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    setClients(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))
  }

  const columns = [
    {
      key: 'name',
      label: 'Client',
      render: (row: any) => (
        <Link href={`/clients/${row.id}`} className="text-white hover:text-accent-red font-medium">
          {row.name}
        </Link>
      )
    },
    {
      key: 'vertical',
      label: 'Vertical',
      render: (row: any) => (
        <span className="text-xs bg-neutral-800 px-2 py-1 rounded">
          {VERTICAL_LABELS[row.vertical] || row.vertical}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: any) => (
        <span className={`text-xs font-medium ${row.status === 'active' ? 'text-green-400' : 'text-neutral-500'}`}>
          {row.status}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: any) => new Date(row.created_at).toLocaleDateString()
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row: any) => (
        <div className="flex gap-2">
          <Link href={`/clients/${row.id}/submit`} className="text-xs text-accent-red hover:underline">
            Submit Metrics
          </Link>
          <button
            onClick={() => toggleStatus(row.id, row.status)}
            className="text-xs text-neutral-500 hover:text-white"
          >
            {row.status === 'active' ? 'Archive' : 'Restore'}
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage and track client performance</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red-hover"
        >
          {showForm ? 'Cancel' : 'Add Client'}
        </button>
      </div>

      <div className="flex gap-1 bg-neutral-900 border border-border rounded-lg p-1 w-fit flex-wrap">
        {verticals.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-accent-red text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {tab === 'all' ? `All (${clients.length})` : `${VERTICAL_LABELS[tab] || tab} (${clients.filter(c => c.vertical === tab).length})`}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={addClient} className="bg-bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Client Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                className="w-full"
                placeholder="e.g. AlphaSwap Exchange"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Vertical</label>
              <select
                value={form.vertical}
                onChange={e => setForm({ ...form, vertical: e.target.value })}
                className="w-full"
              >
                <option value="trading_platform">Trading Platform</option>
                <option value="gaming_web3">Gaming / Web3</option>
                <option value="ai_trading">AI Trading</option>
                <option value="cex">CEX / Exchange</option>
                <option value="defi">DeFi</option>
                <option value="nft">NFT</option>
                <option value="social">Social</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red-hover">
            Add Client
          </button>
        </form>
      )}

      <div className="bg-bg-card border border-border rounded-lg">
        <DataTable columns={columns} data={filteredClients} />
      </div>
    </div>
  )
}
