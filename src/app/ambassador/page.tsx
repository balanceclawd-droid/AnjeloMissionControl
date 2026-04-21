'use client'

import { useEffect, useState } from 'react'

type Contact = {
  id: string
  name: string
  email: string
  company: string
  role: string
  notes: string
  status: string
  campaign_id: string | null
  last_activity: string
  next_step: string
  last_activity_at: string
}

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
  campaign_id: string
  thread_text: string
  draft_a: string
  draft_b: string
  status: string
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

  // Import state
  const [importMode, setImportMode] = useState<'csv' | 'paste' | 'manual'>('paste')
  const [pasteText, setPasteText] = useState('')
  const [manualForm, setManualForm] = useState({ name: '', email: '', company: '', role: '', notes: '' })
  const [importLoading, setImportLoading] = useState(false)

  // Campaign edit state
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [campaignForm, setCampaignForm] = useState<Partial<Campaign>>({})
  const [launchLoading, setLaunchLoading] = useState(false)

  // Reply action state
  const [replyDraft, setReplyDraft] = useState<{ draft_a: string; draft_b: string } | null>(null)

  useEffect(() => {
    fetchContacts()
    fetchCampaigns()
    fetchReplies()
  }, [])

  async function fetchContacts() {
    try {
      const res = await fetch('/api/ambassador/contacts')
      if (res.ok) {
        const data = await res.json()
        setContacts(data)
      }
    } catch {}
  }

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/ambassador/campaigns')
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data)
      }
    } catch {}
  }

  async function fetchReplies() {
    try {
      const res = await fetch('/api/ambassador/replies')
      if (res.ok) {
        const data = await res.json()
        setReplies(data)
      }
    } catch {}
  }

  async function handleImport() {
    setImportLoading(true)
    try {
      let parsed: Partial<Contact>[] = []

      if (importMode === 'paste' && pasteText.trim()) {
        const lines = pasteText.trim().split('\n')
        parsed = lines.map(line => {
          const parts = line.split(/[\t,]/).map(s => s.trim())
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
        setManualForm({ name: '', email: '', company: '', role: '', notes: '' })
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

  async function handleReplyAction(replyId: string, action: string, editedText?: string) {
    const res = await fetch(`/api/ambassador/replies/${replyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, edited_text: editedText }),
    })
    if (res.ok) {
      fetchReplies()
    }
  }

  const groupedContacts = STATUS_ORDER.reduce<Record<string, Contact[]>>((acc, status) => {
    acc[status] = contacts.filter(c => c.status === status)
    return acc
  }, {})

  const pendingReplies = replies.filter(r => r.status === 'pending')

  return (
    <div className="max-w-[1600px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">✉ Ambassador Outreach</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage recruiting contacts, campaigns, and reply approval</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-800 mb-6">
        {(['pipeline', 'import', 'campaigns', 'inbox'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-accent-red text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {tab === 'pipeline' ? 'Pipeline' : tab === 'import' ? 'Import Contacts' : tab === 'campaigns' ? 'Campaigns' : 'Reply Inbox'}
            {tab === 'inbox' && pendingReplies.length > 0 && (
              <span className="ml-2 bg-accent-red text-white text-xs px-2 py-0.5 rounded-full">{pendingReplies.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* PIPELINE TAB */}
      {activeTab === 'pipeline' && (
        <div>
          {/* Kanban header */}
          <div className="grid grid-cols-6 gap-3 mb-4">
            {STATUS_ORDER.map(status => (
              <div key={status} className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">{STATUS_LABELS[status]}</p>
                <p className="text-xl font-bold text-white mt-1">{groupedContacts[status]?.length || 0}</p>
              </div>
            ))}
          </div>

          {/* Pipeline rows */}
          <div className="space-y-3">
            {STATUS_ORDER.map(status => (
              groupedContacts[status]?.length > 0 && (
                <div key={status}>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">{STATUS_LABELS[status]}</p>
                  <div className="space-y-2">
                    {groupedContacts[status].map(contact => (
                      <div
                        key={contact.id}
                        onClick={() => { setSelectedContact(contact); setDrawerOpen(true); }}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 hover:border-neutral-700 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">{contact.name}</p>
                            <p className="text-sm text-neutral-400 mt-0.5">{contact.role} · {contact.company}</p>
                            <p className="text-xs text-neutral-600 mt-1">{contact.email}</p>
                          </div>
                          <div className="text-right">
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

      {/* IMPORT TAB */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-3 gap-4">
          {/* Toggle */}
          <div className="col-span-3 flex gap-2 mb-4">
            {(['paste', 'csv', 'manual'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setImportMode(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  importMode === mode ? 'bg-accent-red text-white' : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                }`}
              >
                {mode === 'paste' ? 'Paste from Clipboard' : mode === 'csv' ? 'CSV Upload' : 'Manual Entry'}
              </button>
            ))}
          </div>

          {/* Paste */}
          {importMode === 'paste' && (
            <div className="col-span-2 bg-neutral-900 border border-neutral-800 rounded-lg p-5">
              <p className="text-sm font-medium text-white mb-3">Paste comma or tab-separated values</p>
              <p className="text-xs text-neutral-500 mb-4">One contact per row: Name, Email, Company, Role, Notes</p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={10}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-accent-red"
                placeholder={"Alice Smith, alice@acme.com, Acme Corp, VP Engineering, Warm intro from YC\nBob Jones, bob@startup.io, Startup.io, CEO, Referred by Charlie"}
              />
              <button
                onClick={handleImport}
                disabled={importLoading || !pasteText.trim()}
                className="mt-4 bg-accent-red text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {importLoading ? 'Importing...' : 'Import Contacts'}
              </button>
            </div>
          )}

          {/* CSV */}
          {importMode === 'csv' && (
            <div className="col-span-2 bg-neutral-900 border border-neutral-800 rounded-lg p-5">
              <p className="text-sm font-medium text-white mb-3">Upload CSV file</p>
              <p className="text-xs text-neutral-500 mb-4">Columns: Name, Email, Company, Role, Notes</p>
              <label className="block border-2 border-dashed border-neutral-700 rounded-lg p-10 text-center cursor-pointer hover:border-neutral-600 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleCsvUpload(file)
                  }}
                />
                <p className="text-neutral-400">Drop CSV file here or click to upload</p>
                <p className="text-xs text-neutral-600 mt-2">.csv only, max 10MB</p>
              </label>
            </div>
          )}

          {/* Manual */}
          {importMode === 'manual' && (
            <div className="col-span-2 bg-neutral-900 border border-neutral-800 rounded-lg p-5">
              <p className="text-sm font-medium text-white mb-4">Add single contact manually</p>
              <div className="grid grid-cols-2 gap-4">
                {(['name', 'email', 'company', 'role', 'notes'].map(field => (
                  <div key={field} className={field === 'notes' ? 'col-span-2' : ''}>
                    <label className="block text-xs text-neutral-500 mb-1.5 capitalize">{field}</label>
                    {field === 'notes' ? (
                      <textarea
                        value={manualForm.notes}
                        onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                        rows={3}
                        className="w-full"
                        placeholder="Notes about this contact..."
                      />
                    ) : (
                      <input
                        type={field === 'email' ? 'email' : 'text'}
                        value={manualForm[field as keyof typeof manualForm]}
                        onChange={e => setManualForm(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full"
                        placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      />
                    )}
                  </div>
                )))}
              </div>
              <button
                onClick={handleImport}
                disabled={importLoading || !manualForm.email}
                className="mt-4 bg-accent-red text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {importLoading ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          )}

          {/* Quick stats */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
            <p className="text-sm font-medium text-white mb-3">Contact Stats</p>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-400">Total contacts</span>
                <span className="text-sm font-semibold text-white">{contacts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-400">New</span>
                <span className="text-sm font-semibold text-white">{groupedContacts.new?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-400">Contacted</span>
                <span className="text-sm font-semibold text-white">{groupedContacts.contacted?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-400">Replied</span>
                <span className="text-sm font-semibold text-white">{groupedContacts.replied?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-400">Interested</span>
                <span className="text-sm font-semibold text-emerald-400">{groupedContacts.interested?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGNS TAB */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-neutral-400">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total</p>
            <button
              onClick={async () => {
                const res = await fetch('/api/ambassador/campaigns', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: 'New Campaign' }),
                })
                if (res.ok) fetchCampaigns()
              }}
              className="bg-accent-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              + New Campaign
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-12 text-center">
              <p className="text-neutral-400">No campaigns yet. Create your first one.</p>
              <p className="text-xs text-neutral-600 mt-2">Campaigns configure your outreach sequences in Smartlead</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {campaigns.map(campaign => (
                <div key={campaign.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="font-medium text-white">{campaign.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                        campaign.status === 'active' ? 'bg-emerald-900 text-emerald-300' :
                        campaign.status === 'draft' ? 'bg-neutral-800 text-neutral-300' :
                        'bg-neutral-800 text-neutral-500'
                      }`}>{campaign.status}</span>
                    </div>
                  </div>

                  {/* 3-step sequence preview */}
                  <div className="space-y-2 mb-4">
                    {[
                      campaign.step1_template || 'Step 1 — Initial outreach',
                      campaign.step2_template || 'Step 2 — Follow-up (~3 days)',
                      campaign.step3_template || 'Step 3 — Final follow-up (~7 days)',
                    ].map((step, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs text-neutral-300 font-medium">
                          {i + 1}
                        </div>
                        <p className="text-sm text-neutral-400">{step}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setEditingCampaign(campaign); setCampaignForm(campaign); }}
                      className="flex-1 bg-neutral-800 text-neutral-300 px-3 py-2 rounded-lg text-sm hover:bg-neutral-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleLaunchCampaign(campaign.id)}
                      disabled={launchLoading || campaign.status === 'active'}
                      className="flex-1 bg-accent-red text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {launchLoading ? 'Launching...' : 'Launch'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INBOX TAB */}
      {activeTab === 'inbox' && (
        <div>
          <p className="text-sm text-neutral-400 mb-4">{pendingReplies.length} reply(ies) awaiting approval</p>

          {pendingReplies.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-12 text-center">
              <p className="text-neutral-400">No replies pending approval. All caught up.</p>
              <p className="text-xs text-neutral-600 mt-2">Replies from prospects will appear here after Smartlead AI drafts options</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingReplies.map(reply => (
                <div key={reply.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
                  {/* Thread */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 mb-4 text-sm text-neutral-300 whitespace-pre-wrap">
                    {reply.thread_text || 'No thread context available'}
                  </div>

                  {/* Draft options */}
                  {reply.draft_a || reply.draft_b ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[reply.draft_a, reply.draft_b].filter(Boolean).map((draft, i) => (
                        <div key={i} className="border border-neutral-700 rounded-lg p-4">
                          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Option {String.fromCharCode(65 + i)}</p>
                          <p className="text-sm text-white whitespace-pre-wrap mb-4">{draft}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReplyAction(reply.id, 'approved')}
                              className="flex-1 bg-emerald-800 text-emerald-200 px-3 py-2 rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                            >
                              ✅ Approve & Send
                            </button>
                            <button
                              onClick={() => {
                                setReplyDraft({ draft_a: reply.draft_a || '', draft_b: reply.draft_b || '' })
                                // For edit mode, we use a simple approach - just mark which was edited
                                handleReplyAction(reply.id, 'edited', draft || '')
                              }}
                              className="flex-1 bg-blue-900 text-blue-200 px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-800 transition-colors"
                            >
                              ✏️ Edit & Send
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-neutral-500 text-sm">
                      Drafts not yet generated. Smartlead AI will produce options shortly.
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleReplyAction(reply.id, 'discarded')}
                      className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
                    >
                      ❌ Discard Both
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact Drawer */}
      {drawerOpen && selectedContact && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-[480px] bg-neutral-900 border-l border-neutral-800 h-full overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}
          >
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

              {selectedContact.last_activity && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Last Activity</p>
                  <p className="text-sm text-neutral-300 mt-1">{selectedContact.last_activity}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-neutral-500 mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ORDER.map(status => (
                    <button
                      key={status}
                      onClick={() => handleUpdateStatus(selectedContact.id, status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedContact.status === status
                          ? 'bg-accent-red text-white'
                          : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                      }`}
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
    </div>
  )
}
