'use client'

import { useEffect, useState, useCallback } from 'react'

type Contact = {
  id: string
  name: string
  email: string
  company: string
  role: string
  notes: string
  status: string
  campaign_id: string | null
  smartlead_lead_id: string | null
  last_activity: string | null
  next_step: string | null
  linkedin_url: string | null
  twitter_url: string | null
  website_url: string | null
  twitch_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  instagram_url: string | null
  discord_url: string | null
  last_activity_at: string
}

const SOCIAL_FIELDS = [
  { key: 'linkedin_url', label: 'LinkedIn', icon: '💼', color: 'text-blue-400' },
  { key: 'twitter_url', label: 'Twitter/X', icon: '✖', color: 'text-sky-400' },
  { key: 'website_url', label: 'Website', icon: '🌐', color: 'text-neutral-400' },
  { key: 'twitch_url', label: 'Twitch', icon: '🟣', color: 'text-purple-400' },
  { key: 'youtube_url', label: 'YouTube', icon: '▶', color: 'text-red-400' },
  { key: 'tiktok_url', label: 'TikTok', icon: '🎵', color: 'text-pink-400' },
  { key: 'instagram_url', label: 'Instagram', icon: '📸', color: 'text-rose-400' },
  { key: 'discord_url', label: 'Discord', icon: '💬', color: 'text-indigo-400' },
] as const

type Campaign = {
  id: string
  name: string
  status: string
  step1_template: string
  step2_template: string
  step3_template: string
  schedule_days: string[]
  schedule_time: string
  timezone: string
}

type Reply = {
  id: string
  contact_id: string
  campaign_id: string | null
  thread_text: string
  draft_a: string | null
  draft_b: string | null
  status: string
  received_at: string
  processed_at: string | null
  contact?: Contact
}

type Settings = {
  id: string | null
  opportunity_brief: string
  default_timezone: string
  send_window_start: string
  send_window_end: string
}

type ToneExample = {
  id: string
  body: string
  source: string
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  interested: 'Interested',
  not_interested: 'Not Interested',
  converted: 'Converted',
}

const STATUS_ORDER = ['new', 'contacted', 'replied', 'interested', 'not_interested', 'converted']

export default function AmbassadorPage() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'import' | 'campaigns' | 'inbox'>('pipeline')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [replies, setReplies] = useState<Reply[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<Settings>({ id: null, opportunity_brief: '', default_timezone: 'Europe/London', send_window_start: '09:00', send_window_end: '17:00' })
  const [toneExamples, setToneExamples] = useState<ToneExample[]>([])
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Import state
  const [importMode, setImportMode] = useState<'paste' | 'csv' | 'manual'>('paste')
  const [pasteText, setPasteText] = useState('')
  const [manualForm, setManualForm] = useState({ name: '', email: '', company: '', role: '', notes: '', linkedin_url: '', twitter_url: '', website_url: '', twitch_url: '', youtube_url: '', tiktok_url: '', instagram_url: '', discord_url: '' })
  const [importLoading, setImportLoading] = useState(false)

  // Campaign state
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [campaignForm, setCampaignForm] = useState<Partial<Campaign>>({})
  const [launchLoading, setLaunchLoading] = useState(false)

  // Reply action state
  const [draftLoading, setDraftLoading] = useState<Record<string, boolean>>({})
  const [sendingReply, setSendingReply] = useState<string | null>(null)

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/ambassador/contacts')
      if (res.ok) setContacts(await res.json())
    } catch {}
  }, [])

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/ambassador/campaigns')
      if (res.ok) setCampaigns(await res.json())
    } catch {}
  }, [])

  const fetchReplies = useCallback(async () => {
    try {
      const res = await fetch('/api/ambassador/replies')
      if (res.ok) setReplies(await res.json())
    } catch {}
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/ambassador/settings')
      if (res.ok) setSettings(await res.json())
    } catch {}
  }, [])

  const fetchToneExamples = useCallback(async () => {
    try {
      const res = await fetch('/api/ambassador/tone-examples')
      if (res.ok) setToneExamples(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    fetchContacts()
    fetchCampaigns()
    fetchReplies()
  }, [fetchContacts, fetchCampaigns, fetchReplies])

  async function handleImport() {
    setImportLoading(true)
    try {
      let parsed: Partial<Contact>[] = []
      if (importMode === 'paste' && pasteText.trim()) {
        parsed = pasteText.trim().split('\n').map(line => {
          const parts = line.split(/[\t,]/).map(s => s.trim()).filter(Boolean)
          return { name: parts[0] || '', email: parts[1] || '', company: parts[2] || '', role: parts[3] || '', notes: parts[4] || '' }
        }).filter(r => r.email)
      } else if (importMode === 'manual' && manualForm.email) {
        parsed = [manualForm]
      }
      if (!parsed.length) return
      const res = await fetch('/api/ambassador/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: parsed }),
      })
      if (res.ok) {
        fetchContacts()
        setPasteText('')
        setManualForm({ name: '', email: '', company: '', role: '', notes: '', linkedin_url: '', twitter_url: '', website_url: '', twitch_url: '', youtube_url: '', tiktok_url: '', instagram_url: '', discord_url: '' })
        setActiveTab('pipeline')
      }
    } finally {
      setImportLoading(false)
    }
  }

  async function handleCsvUpload(file: File) {
    setImportLoading(true)
    try {
      const text = await file.text()
      const lines = text.trim().split('\n')
      const parsed = lines.slice(1).map(line => {
        const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
        return { name: parts[0] || '', email: parts[1] || '', company: parts[2] || '', role: parts[3] || '', notes: parts[4] || '' }
      }).filter(r => r.email)
      const res = await fetch('/api/ambassador/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: parsed }),
      })
      if (res.ok) {
        fetchContacts()
        setActiveTab('pipeline')
      }
    } finally {
      setImportLoading(false)
    }
  }

  async function handleUpdateStatus(contactId: string, newStatus: string) {
    await fetch(`/api/ambassador/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchContacts()
    setDrawerOpen(false)
    setSelectedContact(null)
  }

  async function handleLaunchCampaign(campaignId: string) {
    setLaunchLoading(true)
    try {
      const res = await fetch(`/api/ambassador/campaigns/${campaignId}/launch`, { method: 'POST' })
      if (res.ok) {
        fetchCampaigns()
        fetchContacts()
      }
    } finally {
      setLaunchLoading(false)
    }
  }

  async function handleDeleteCampaign(campaignId: string) {
    if (!confirm('Delete this campaign? This cannot be undone.')) return
    await fetch(`/api/ambassador/campaigns/${campaignId}`, { method: 'DELETE' })
    fetchCampaigns()
  }

  async function handleGenerateDrafts(replyId: string) {
    setDraftLoading(prev => ({ ...prev, [replyId]: true }))
    try {
      const res = await fetch('/api/ambassador/reply/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_id: replyId }),
      })
      if (res.ok) {
        fetchReplies()
      }
    } finally {
      setDraftLoading(prev => ({ ...prev, [replyId]: false }))
    }
  }

  async function handleSendReply(replyId: string, chosenOption: string, editedBody?: string) {
    setSendingReply(replyId)
    try {
      const res = await fetch('/api/ambassador/reply/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_id: replyId, chosen_option: chosenOption, edited_body: editedBody }),
      })
      if (res.ok) {
        fetchReplies()
        fetchContacts()
        fetchToneExamples()
      }
    } finally {
      setSendingReply(null)
    }
  }

  async function handleDiscardReply(replyId: string) {
    await fetch(`/api/ambassador/replies/${replyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'discarded' }),
    })
    fetchReplies()
  }

  async function handleSaveSettings() {
    setSettingsSaving(true)
    try {
      const res = await fetch('/api/ambassador/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setSettingsOpen(false)
        fetchSettings()
      }
    } finally {
      setSettingsSaving(false)
    }
  }

  async function handleDeleteToneExample(id: string) {
    await fetch(`/api/ambassador/tone-examples?id=${id}`, { method: 'DELETE' })
    fetchToneExamples()
  }

  async function handleAddToneExample(body: string) {
    await fetch('/api/ambassador/tone-examples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, source: 'manual' }),
    })
    fetchToneExamples()
  }

  const groupedContacts = STATUS_ORDER.reduce<Record<string, Contact[]>>((acc, status) => {
    acc[status] = contacts.filter(c => c.status === status)
    return acc
  }, {})

  const pendingReplies = replies.filter(r => r.status === 'pending')

  return (
    <div className="max-w-[1600px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">✉ Ambassador Outreach</h1>
          <p className="text-sm text-neutral-500 mt-1">Recruiting pipeline, campaigns, and reply approval</p>
        </div>
        <button
          onClick={() => { setSettingsOpen(true); fetchSettings(); fetchToneExamples() }}
          className="text-neutral-500 hover:text-white transition-colors text-xl"
          title="Settings"
        >
          ⚙
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-800 mb-6">
        {(['pipeline', 'import', 'campaigns', 'inbox'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab ? 'border-accent-red text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {tab === 'pipeline' ? 'Pipeline' : tab === 'import' ? 'Import Contacts' : tab === 'campaigns' ? 'Campaigns' : 'Reply Inbox'}
            {tab === 'inbox' && pendingReplies.length > 0 && (
              <span className="ml-2 bg-accent-red text-white text-xs px-2 py-0.5 rounded-full">{pendingReplies.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* PIPELINE */}
      {activeTab === 'pipeline' && (
        <div>
          <div className="grid grid-cols-6 gap-3 mb-4">
            {STATUS_ORDER.map(status => (
              <div key={status} className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">{STATUS_LABELS[status]}</p>
                <p className="text-xl font-bold text-white mt-1">{groupedContacts[status]?.length || 0}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {STATUS_ORDER.map(status => (
              groupedContacts[status]?.length > 0 && (
                <div key={status}>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">{STATUS_LABELS[status]}</p>
                  <div className="space-y-2">
                    {groupedContacts[status].map(contact => (
                      <div
                        key={contact.id}
                        onClick={() => { setSelectedContact(contact); setDrawerOpen(true) }}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 hover:border-neutral-700 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">{contact.name}</p>
                            <p className="text-sm text-neutral-400 mt-0.5">{contact.role} · {contact.company}</p>
                            <p className="text-xs text-neutral-600 mt-1">{contact.email}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 mb-1.5 flex-wrap">
                              {SOCIAL_FIELDS.map(f => { const val = (contact as unknown as Record<string, string | null>)[f.key]; return val && <span key={f.key} className={"text-xs " + f.color} title={f.label}>{f.icon}</span> })}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              contact.status === 'interested' ? 'bg-emerald-900 text-emerald-300' :
                              contact.status === 'converted' ? 'bg-blue-900 text-blue-300' :
                              contact.status === 'not_interested' ? 'bg-neutral-800 text-neutral-400' :
                              'bg-neutral-800 text-neutral-300'
                            }`}>{STATUS_LABELS[contact.status]}</span>
                            <p className="text-xs text-neutral-600 mt-2">{contact.last_activity || 'No activity'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* IMPORT */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-3 flex gap-2 mb-4">
            {(['paste', 'csv', 'manual'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setImportMode(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${importMode === mode ? 'bg-accent-red text-white' : 'bg-neutral-900 text-neutral-400 border border-neutral-800'}`}
              >
                {mode === 'paste' ? 'Paste from Clipboard' : mode === 'csv' ? 'CSV Upload' : 'Manual Entry'}
              </button>
            ))}
          </div>

          {importMode === 'paste' && (
            <div className="col-span-2 bg-neutral-900 border border-neutral-800 rounded-lg p-5">
              <p className="text-sm font-medium text-white mb-3">Paste comma or tab-separated values</p>
              <p className="text-xs text-neutral-500 mb-4">One contact per row: Name, Email, Company, Role, Notes</p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={10}
                className="w-full"
                placeholder={"Alice Smith, alice@acme.com, Acme Corp, VP Engineering, Warm intro from YC\nBob Jones, bob@startup.io, Startup.io, CEO, Referred by Charlie"}
              />
              <button onClick={handleImport} disabled={importLoading || !pasteText.trim()} className="mt-4 bg-accent-red text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {importLoading ? 'Importing...' : 'Import Contacts'}
              </button>
            </div>
          )}

          {importMode === 'csv' && (
            <div className="col-span-2 bg-neutral-900 border border-neutral-800 rounded-lg p-5">
              <p className="text-sm font-medium text-white mb-3">Upload CSV file</p>
              <p className="text-xs text-neutral-500 mb-4">Columns: Name, Email, Company, Role, Notes</p>
              <label className="block border-2 border-dashed border-neutral-700 rounded-lg p-10 text-center cursor-pointer hover:border-neutral-600 transition-colors">
                <input type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f) }} />
                <p className="text-neutral-400">Drop CSV or click to upload</p>
                <p className="text-xs text-neutral-600 mt-2">.csv only</p>
              </label>
            </div>
          )}

          {importMode === 'manual' && (
            <div className="col-span-2 bg-neutral-900 border border-neutral-800 rounded-lg p-5">
              <p className="text-sm font-medium text-white mb-4">Add single contact</p>
              <div className="grid grid-cols-2 gap-4">
                {(['name', 'email', 'company', 'role'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-xs text-neutral-500 mb-1.5 capitalize">{field}</label>
                    <input type={field === 'email' ? 'email' : 'text'} value={manualForm[field]} onChange={e => setManualForm(f => ({ ...f, [field]: e.target.value }))} className="w-full" placeholder={field.charAt(0).toUpperCase() + field.slice(1)} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5">💼 LinkedIn</label>
                  <input type="url" value={manualForm.linkedin_url} onChange={e => setManualForm(f => ({ ...f, linkedin_url: e.target.value }))} className="w-full" placeholder="linkedin.com/in/..." />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5">✖ Twitter/X</label>
                  <input type="url" value={manualForm.twitter_url} onChange={e => setManualForm(f => ({ ...f, twitter_url: e.target.value }))} className="w-full" placeholder="x.com/..." />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5">🌐 Website</label>
                  <input type="url" value={manualForm.website_url} onChange={e => setManualForm(f => ({ ...f, website_url: e.target.value }))} className="w-full" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5">🟣 Twitch</label>
                  <input type="url" value={manualForm.twitch_url} onChange={e => setManualForm(f => ({ ...f, twitch_url: e.target.value }))} className="w-full" placeholder="twitch.tv/..." />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5">▶ YouTube</label>
                  <input type="url" value={manualForm.youtube_url} onChange={e => setManualForm(f => ({ ...f, youtube_url: e.target.value }))} className="w-full" placeholder="youtube.com/@..." />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5">🎵 TikTok</label>
                  <input type="url" value={manualForm.tiktok_url} onChange={e => setManualForm(f => ({ ...f, tiktok_url: e.target.value }))} className="w-full" placeholder="tiktok.com/@..." />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5">📸 Instagram</label>
                  <input type="url" value={manualForm.instagram_url} onChange={e => setManualForm(f => ({ ...f, instagram_url: e.target.value }))} className="w-full" placeholder="instagram.com/..." />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5">💬 Discord</label>
                  <input type="url" value={manualForm.discord_url} onChange={e => setManualForm(f => ({ ...f, discord_url: e.target.value }))} className="w-full" placeholder="discord.gg/..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-neutral-500 mb-1.5">Notes</label>
                  <textarea value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full" placeholder="Notes..." />
                </div>
              </div>
              <button onClick={handleImport} disabled={importLoading || !manualForm.email} className="mt-4 bg-accent-red text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {importLoading ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          )}

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
            <p className="text-sm font-medium text-white mb-3">Contact Stats</p>
            <div className="space-y-3">
              {[['Total', contacts.length], ['New', groupedContacts.new?.length || 0], ['Contacted', groupedContacts.contacted?.length || 0], ['Replied', groupedContacts.replied?.length || 0], ['Interested', groupedContacts.interested?.length || 0]].map(([label, val]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-sm text-neutral-400">{label as string}</span>
                  <span className="text-sm font-semibold text-white">{val as number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGNS */}
      {activeTab === 'campaigns' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-neutral-400">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
            <button onClick={async () => {
              const res = await fetch('/api/ambassador/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New Campaign' }) })
              if (res.ok) fetchCampaigns()
            }} className="bg-accent-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
              + New Campaign
            </button>
          </div>
          {campaigns.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-12 text-center">
              <p className="text-neutral-400">No campaigns yet. Click + New Campaign to start.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map(c => (
                <div key={c.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="font-medium text-white">{c.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${c.status === 'active' ? 'bg-emerald-900 text-emerald-300' : 'bg-neutral-800 text-neutral-300'}`}>{c.status}</span>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {[
                      c.step1_template || 'Step 1 — Initial outreach',
                      c.step2_template || 'Step 2 — Follow-up (~3 days)',
                      c.step3_template || 'Step 3 — Final follow-up (~7 days)',
                    ].map((step, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs text-neutral-300 font-medium">{i + 1}</div>
                        <p className="text-sm text-neutral-400">{step}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingCampaign(c); setCampaignForm(c) }} className="flex-1 bg-neutral-800 text-neutral-300 px-3 py-2 rounded-lg text-sm hover:bg-neutral-700 transition-colors">Edit</button>
                    <button onClick={() => handleDeleteCampaign(c.id)} className="bg-neutral-800 text-neutral-500 px-3 py-2 rounded-lg text-sm hover:bg-red-900 hover:text-red-300 transition-colors">🗑</button>
                    <button onClick={() => handleLaunchCampaign(c.id)} disabled={launchLoading || c.status === 'active'} className="flex-1 bg-accent-red text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {launchLoading ? '...' : 'Launch'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CAMPAIGN EDITOR DRAWER */}
          {editingCampaign && (
            <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setEditingCampaign(null)}>
              <div className="absolute inset-0 bg-black/50" />
              <div className="relative w-[560px] bg-neutral-900 border-l border-neutral-800 h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-6">
                  <p className="text-xl font-semibold text-white">{editingCampaign.id ? 'Edit Campaign' : 'New Campaign'}</p>
                  <button onClick={() => setEditingCampaign(null)} className="text-neutral-500 hover:text-white text-xl">✕</button>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Campaign Name</label>
                    <input
                      value={campaignForm.name || ''}
                      onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full"
                      placeholder="e.g. Q2 Investor Outreach"
                    />
                  </div>

                  {[
                    { key: 'step1_template', label: 'Step 1 — Initial Email', delay: 'Day 0 (immediate)' },
                    { key: 'step2_template', label: 'Step 2 — Follow-up', delay: 'Day 3' },
                    { key: 'step3_template', label: 'Step 3 — Final Follow-up', delay: 'Day 7' },
                  ].map(({ key, label, delay }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-white">{label}</label>
                        <span className="text-xs text-neutral-500">{delay}</span>
                      </div>
                      <textarea
                        value={(campaignForm as Record<string, string>)[key] || ''}
                        onChange={e => setCampaignForm(f => ({ ...f, [key]: e.target.value }))}
                        rows={5}
                        className="w-full text-sm"
                        placeholder={`Hi {{first_name}},

I came across ${'{company}'} and thought there might be a natural fit for our investor network...

Looking forward to connecting.`}
                      />
                    </div>
                  ))}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1.5">Timezone</label>
                      <input
                        value={campaignForm.timezone || 'Europe/London'}
                        onChange={e => setCampaignForm(f => ({ ...f, timezone: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1.5">Schedule Time</label>
                      <input
                        value={campaignForm.schedule_time || '09:00'}
                        onChange={e => setCampaignForm(f => ({ ...f, schedule_time: e.target.value }))}
                        className="w-full"
                        placeholder="09:00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-500 mb-1.5">Send Days</label>
                    <div className="flex gap-2 flex-wrap">
                      {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => {
                        const days = campaignForm.schedule_days || ['mon', 'tue', 'wed', 'thu', 'fri']
                        const active = days.includes(day)
                        return (
                          <button
                            key={day}
                            onClick={() => {
                              const current = campaignForm.schedule_days || ['mon', 'tue', 'wed', 'thu', 'fri']
                              const next = active ? current.filter(d => d !== day) : [...current, day]
                              setCampaignForm(f => ({ ...f, schedule_days: next }))
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-accent-red text-white' : 'bg-neutral-800 text-neutral-400'}`}
                          >
                            {day.charAt(0).toUpperCase() + day.slice(1)}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/ambassador/campaigns/${editingCampaign.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(campaignForm),
                      })
                      if (res.ok) {
                        setEditingCampaign(null)
                        fetchCampaigns()
                      }
                    }}
                    className="w-full bg-accent-red text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    Save Campaign
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INBOX */}
      {activeTab === 'inbox' && (
        <div>
          <p className="text-sm text-neutral-400 mb-4">{pendingReplies.length} pending approval</p>
          {pendingReplies.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-12 text-center">
              <p className="text-neutral-400">No replies pending. All caught up.</p>
              <p className="text-xs text-neutral-600 mt-2">Inbound replies from Smartlead appear here for AI draft + approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingReplies.map(reply => (
                <div key={reply.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
                  {/* Thread */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 mb-4 text-sm text-neutral-300 whitespace-pre-wrap">
                    {reply.thread_text || 'No thread context'}
                  </div>

                  {/* Drafts */}
                  {!reply.draft_a && !reply.draft_b ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-neutral-500 mb-3">No drafts generated yet</p>
                      <button
                        onClick={() => handleGenerateDrafts(reply.id)}
                        disabled={draftLoading[reply.id]}
                        className="bg-blue-800 text-blue-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {draftLoading[reply.id] ? 'Generating...' : '✨ Generate AI Drafts'}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {[reply.draft_a, reply.draft_b].filter(Boolean).map((draft, i) => (
                        <div key={i} className="border border-neutral-700 rounded-lg p-4">
                          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Option {String.fromCharCode(65 + i)}</p>
                          <p className="text-sm text-white whitespace-pre-wrap mb-4">{draft}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSendReply(reply.id, String.fromCharCode(65 + i))}
                              disabled={sendingReply === reply.id}
                              className="flex-1 bg-emerald-800 text-emerald-200 px-3 py-2 rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              ✅ Approve & Send
                            </button>
                            <button
                              onClick={() => {
                                const edited = window.prompt('Edit your reply:')
                                if (edited) handleSendReply(reply.id, `edited_${String.fromCharCode(97 + i)}`, edited)
                              }}
                              disabled={sendingReply === reply.id}
                              className="flex-1 bg-blue-900 text-blue-200 px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
                            >
                              ✏️ Edit & Send
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <button onClick={() => handleDiscardReply(reply.id)} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
                      ❌ Discard Both
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONTACT DRAWER */}
      {drawerOpen && selectedContact && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-[480px] bg-neutral-900 border-l border-neutral-800 h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xl font-semibold text-white">{selectedContact.name}</p>
                <p className="text-sm text-neutral-400 mt-0.5">{selectedContact.role} · {selectedContact.company}</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-neutral-500 hover:text-white transition-colors text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Email</p>
                  <p className="text-sm text-white mt-1">{selectedContact.email}</p>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Status</p>
                  <p className="text-sm text-white mt-1">{STATUS_LABELS[selectedContact.status]}</p>
                </div>
              </div>

              {selectedContact.notes && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Notes</p>
                  <p className="text-sm text-neutral-300 mt-1">{selectedContact.notes}</p>
                </div>
              )}
              {/* Social Links */}
              <div className="grid grid-cols-2 gap-3">
                {SOCIAL_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1.5">
                      <span>{f.icon}</span> {f.label}
                    </label>
                    <input
                      type="url"
                      value={(selectedContact as Record<string, string | null>)[f.key] || ''}
                      onChange={async e => {
                        await fetch(`/api/ambassador/contacts/${selectedContact.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ [f.key]: e.target.value }),
                        })
                        setSelectedContact(c => c ? { ...c, [f.key]: e.target.value } : c)
                      }}
                      className="w-full text-sm"
                      placeholder="https://..."
                    />
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs text-neutral-500 mb-2">Assign to Campaign</p>
                <select
                  value={selectedContact.campaign_id || ''}
                  onChange={async e => {
                    const cid = e.target.value || null
                    await fetch(`/api/ambassador/contacts/${selectedContact.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ campaign_id: cid }),
                    })
                    setSelectedContact(c => c ? { ...c, campaign_id: cid } : c)
                    fetchContacts()
                  }}
                  className="w-full text-sm"
                >
                  <option value="">— No campaign —</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs text-neutral-500 mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ORDER.map(status => (
                    <button
                      key={status}
                      onClick={() => handleUpdateStatus(selectedContact.id, status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedContact.status === status ? 'bg-accent-red text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS PANEL */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSettingsOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-[560px] bg-neutral-900 border-l border-neutral-800 h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <p className="text-xl font-semibold text-white">⚙ Settings</p>
              <button onClick={() => setSettingsOpen(false)} className="text-neutral-500 hover:text-white transition-colors text-xl">✕</button>
            </div>

            <div className="space-y-6">
              {/* About Me / Opportunity Brief */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">About Me / Opportunity Brief</label>
                <p className="text-xs text-neutral-500 mb-3">Injected into every AI draft generation call</p>
                <textarea
                  value={settings.opportunity_brief}
                  onChange={e => setSettings(s => ({ ...s, opportunity_brief: e.target.value }))}
                  rows={6}
                  className="w-full"
                  placeholder="We represent a network of high-net-worth investors interested in off-market commercial property..."
                />
              </div>

              {/* Send settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5">Timezone</label>
                  <input value={settings.default_timezone} onChange={e => setSettings(s => ({ ...s, default_timezone: e.target.value }))} className="w-full" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1.5">Send from</label>
                    <input value={settings.send_window_start} onChange={e => setSettings(s => ({ ...s, send_window_start: e.target.value }))} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1.5">Send until</label>
                    <input value={settings.send_window_end} onChange={e => setSettings(s => ({ ...s, send_window_end: e.target.value }))} className="w-full" />
                  </div>
                </div>
              </div>

              {/* Webhook URL */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                <p className="text-sm font-medium text-white mb-1">Webhook URL</p>
                <p className="text-xs text-neutral-500 mb-3">Paste this into Smartlead campaign settings</p>
                <div className="flex gap-2">
                  <input value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/ambassador/webhook`} readOnly className="flex-1 text-xs bg-neutral-900" />
                  <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/ambassador/webhook`)} className="bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-lg text-xs hover:bg-neutral-700">Copy</button>
                </div>
              </div>

              {/* Smartlead API key — display only */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                <p className="text-sm font-medium text-white mb-1">Smartlead API Key</p>
                <p className="text-xs text-neutral-500 mb-3">Managed in Vercel dashboard — not editable here</p>
                <p className="text-xs text-neutral-400 font-mono">SMARTLEAD_API_KEY (set in Vercel env vars)</p>
              </div>

              <button onClick={handleSaveSettings} disabled={settingsSaving} className="w-full bg-accent-red text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {settingsSaving ? 'Saving...' : 'Save Settings'}
              </button>

              {/* Tone Examples */}
              <div>
                <p className="text-sm font-medium text-white mb-3">Tone Examples</p>
                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                  {toneExamples.map(example => (
                    <div key={example.id} className="flex gap-2 items-start bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                      <p className="flex-1 text-xs text-neutral-300 whitespace-pre-wrap">{example.body}</p>
                      <button onClick={() => handleDeleteToneExample(example.id)} className="text-neutral-600 hover:text-red-400 text-xs shrink-0">✕</button>
                    </div>
                  ))}
                  {!toneExamples.length && <p className="text-xs text-neutral-600">No examples yet. Approved replies are stored automatically.</p>}
                </div>
                <AddToneExampleForm onAdd={handleAddToneExample} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddToneExampleForm({ onAdd }: { onAdd: (body: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="flex gap-2">
      <input value={value} onChange={e => setValue(e.target.value)} placeholder="Add a tone example manually..." className="flex-1 text-sm" onKeyDown={e => { if (e.key === 'Enter' && value.trim()) { onAdd(value.trim()); setValue('') } }} />
      <button onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue('') } }} className="bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-lg text-xs hover:bg-neutral-700">Add</button>
    </div>
  )
}
