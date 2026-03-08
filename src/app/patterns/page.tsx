'use client'
import { useEffect, useState } from 'react'
import PatternCard from '@/components/PatternCard'

const niches = ['All', 'CEX', 'DEX', 'Gaming', 'Memecoin', 'NFT', 'DeFi']
const statuses = ['All', 'emerging', 'active', 'declining', 'dormant']

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<any[]>([])
  const [filterNiche, setFilterNiche] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [detecting, setDetecting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filterNiche !== 'All') params.set('niche', filterNiche)
    if (filterStatus !== 'All') params.set('status', filterStatus)
    fetch(`/api/patterns?${params.toString()}`).then(r => r.json()).then(setPatterns)
  }, [filterNiche, filterStatus])

  const runDetection = async () => {
    setDetecting(true)
    await fetch('/api/patterns', { method: 'POST' })
    const params = new URLSearchParams()
    if (filterNiche !== 'All') params.set('niche', filterNiche)
    if (filterStatus !== 'All') params.set('status', filterStatus)
    const updated = await fetch(`/api/patterns?${params.toString()}`).then(r => r.json())
    setPatterns(updated)
    setDetecting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pattern Library</h1>
          <p className="text-sm text-neutral-500 mt-1">Detected content patterns from competitive analysis</p>
        </div>
        <button
          onClick={runDetection}
          disabled={detecting}
          className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red-hover disabled:opacity-50"
        >
          {detecting ? 'Detecting...' : 'Run Detection'}
        </button>
      </div>

      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-500">Niche:</label>
          <select value={filterNiche} onChange={e => setFilterNiche(e.target.value)} className="text-sm">
            {niches.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-500">Status:</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm">
            {statuses.map(s => <option key={s} value={s}>{s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {patterns.length === 0 ? (
          <p className="text-neutral-600 text-sm col-span-2 py-8 text-center">No patterns found</p>
        ) : (
          patterns.map(pattern => <PatternCard key={pattern.id} pattern={pattern} />)
        )}
      </div>
    </div>
  )
}
