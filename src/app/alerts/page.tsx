'use client'
import { useEffect, useState } from 'react'
import AlertCard from '@/components/AlertCard'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [showDismissed, setShowDismissed] = useState(false)

  useEffect(() => {
    fetch(`/api/alerts?dismissed=${showDismissed}`)
      .then(r => r.json())
      .then(setAlerts)
  }, [showDismissed])

  const dismissAlert = async (id: number) => {
    await fetch('/api/alerts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, dismissed: true })
    })
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-sm text-neutral-500 mt-1">Intelligence alerts and notifications</p>
        </div>
        <button
          onClick={() => setShowDismissed(!showDismissed)}
          className="text-xs text-neutral-400 hover:text-white bg-bg-card border border-border px-3 py-1.5 rounded-lg"
        >
          {showDismissed ? 'Show Active' : 'Show Dismissed'}
        </button>
      </div>
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <p className="text-neutral-600 text-sm py-8 text-center">No alerts to display</p>
        ) : (
          alerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} onDismiss={!showDismissed ? dismissAlert : undefined} />
          ))
        )}
      </div>
    </div>
  )
}
