'use client'
import { useEffect, useState } from 'react'
import DataTable from '@/components/DataTable'

const hookTypes = ['curiosity_gap', 'urgency', 'authority', 'social_proof', 'value_prop', 'humor']
const structures = ['setup_payoff', 'storytelling', 'educational', 'entertainment']
const ctaTypes = ['link_click', 'follow', 'reply', 'dm']
const visualTypes = ['video', 'image', 'carousel', 'text_only']

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([])
  const [competitors, setCompetitors] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    competitor_id: '', platform: 'twitter', post_url: '', content: '', posted_at: '',
    engagement_metrics: { likes: '', comments: '', views: '' },
    hook_type: '', hook_text: '', structure: '', cta_type: '',
    visual_type: '', visual_description: '', flagged_as_pattern: false, notes: ''
  })

  useEffect(() => {
    fetch('/api/posts').then(r => r.json()).then(setPosts)
    fetch('/api/competitors').then(r => r.json()).then(setCompetitors)
  }, [])

  const addPost = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ...form,
      competitor_id: Number(form.competitor_id),
      engagement_metrics: {
        likes: Number(form.engagement_metrics.likes) || 0,
        comments: Number(form.engagement_metrics.comments) || 0,
        views: Number(form.engagement_metrics.views) || 0,
      }
    }
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      const newPost = await res.json()
      // Refetch to get competitor_name
      fetch('/api/posts').then(r => r.json()).then(setPosts)
      setShowForm(false)
    }
  }

  const columns = [
    {
      key: 'posted_at',
      label: 'Date',
      render: (row: any) => new Date(row.posted_at).toLocaleDateString()
    },
    {
      key: 'competitor_name',
      label: 'Competitor',
      render: (row: any) => <span className="text-white font-medium">{row.competitor_name}</span>
    },
    {
      key: 'platform',
      label: 'Platform',
      render: (row: any) => <span className="capitalize">{row.platform}</span>
    },
    {
      key: 'content',
      label: 'Content',
      sortable: false,
      render: (row: any) => (
        <p className="text-sm max-w-xs truncate" title={row.content}>{row.content || '—'}</p>
      )
    },
    {
      key: 'hook_type',
      label: 'Hook',
      render: (row: any) => row.hook_type ? <span className="text-xs bg-neutral-800 px-2 py-1 rounded">{row.hook_type}</span> : '—'
    },
    {
      key: 'structure',
      label: 'Structure',
      render: (row: any) => row.structure ? <span className="text-xs bg-neutral-800 px-2 py-1 rounded">{row.structure}</span> : '—'
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
      label: 'Flag',
      render: (row: any) => row.flagged_as_pattern ? (
        <span className="text-xs bg-accent-red/20 text-accent-red px-2 py-1 rounded">Pattern</span>
      ) : '—'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Competitive Posts</h1>
          <p className="text-sm text-neutral-500 mt-1">Log and analyze competitor content</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red-hover"
        >
          {showForm ? 'Cancel' : 'Add Post'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addPost} className="bg-bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Competitor</label>
              <select value={form.competitor_id} onChange={e => setForm({...form, competitor_id: e.target.value})} required className="w-full">
                <option value="">Select...</option>
                {competitors.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Platform</label>
              <select value={form.platform} onChange={e => setForm({...form, platform: e.target.value})} className="w-full">
                {['twitter', 'tiktok', 'instagram', 'youtube', 'telegram'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Posted Date</label>
              <input type="date" value={form.posted_at} onChange={e => setForm({...form, posted_at: e.target.value})} required className="w-full" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Post URL</label>
            <input type="url" value={form.post_url} onChange={e => setForm({...form, post_url: e.target.value})} className="w-full" placeholder="https://..." />
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Content</label>
            <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} className="w-full h-20 resize-none" placeholder="Full post text..." />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Likes</label>
              <input type="number" value={form.engagement_metrics.likes} onChange={e => setForm({...form, engagement_metrics: {...form.engagement_metrics, likes: e.target.value}})} className="w-full" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Comments</label>
              <input type="number" value={form.engagement_metrics.comments} onChange={e => setForm({...form, engagement_metrics: {...form.engagement_metrics, comments: e.target.value}})} className="w-full" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Views / Impressions</label>
              <input type="number" value={form.engagement_metrics.views} onChange={e => setForm({...form, engagement_metrics: {...form.engagement_metrics, views: e.target.value}})} className="w-full" placeholder="0" />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-xs text-neutral-400 font-medium uppercase tracking-wider mb-3">Content Analysis</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Hook Type</label>
                <select value={form.hook_type} onChange={e => setForm({...form, hook_type: e.target.value})} className="w-full">
                  <option value="">Select...</option>
                  {hookTypes.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Structure</label>
                <select value={form.structure} onChange={e => setForm({...form, structure: e.target.value})} className="w-full">
                  <option value="">Select...</option>
                  {structures.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">CTA Type</label>
                <select value={form.cta_type} onChange={e => setForm({...form, cta_type: e.target.value})} className="w-full">
                  <option value="">Select...</option>
                  {ctaTypes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Visual Type</label>
                <select value={form.visual_type} onChange={e => setForm({...form, visual_type: e.target.value})} className="w-full">
                  <option value="">Select...</option>
                  {visualTypes.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Hook Text</label>
            <input type="text" value={form.hook_text} onChange={e => setForm({...form, hook_text: e.target.value})} className="w-full" placeholder="The hook line..." />
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Visual Description</label>
            <input type="text" value={form.visual_description} onChange={e => setForm({...form, visual_description: e.target.value})} className="w-full" placeholder="Describe the visual..." />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-400">
              <input type="checkbox" checked={form.flagged_as_pattern} onChange={e => setForm({...form, flagged_as_pattern: e.target.checked})} className="accent-accent-red" />
              Flag as Pattern
            </label>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full h-16 resize-none" placeholder="Analysis notes..." />
          </div>

          <button type="submit" className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red-hover">
            Add Post
          </button>
        </form>
      )}

      <div className="bg-bg-card border border-border rounded-lg">
        <DataTable columns={columns} data={posts} />
      </div>
    </div>
  )
}
