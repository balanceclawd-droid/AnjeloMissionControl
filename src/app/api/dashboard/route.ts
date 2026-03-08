import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  const alerts = db.prepare('SELECT * FROM alerts WHERE dismissed = 0 ORDER BY created_at DESC LIMIT 10').all()
  const patterns = db.prepare('SELECT * FROM patterns ORDER BY avg_engagement_score DESC LIMIT 5').all()

  const clients = db.prepare('SELECT * FROM clients WHERE status = ?').all('active') as any[]

  const clientGrid = clients.map(client => {
    const latestMetric = db.prepare('SELECT * FROM weekly_metrics WHERE client_id = ? ORDER BY week_ending DESC LIMIT 1').get(client.id) as any
    const prevMetric = db.prepare('SELECT * FROM weekly_metrics WHERE client_id = ? ORDER BY week_ending DESC LIMIT 1 OFFSET 1').get(client.id) as any

    return {
      ...client,
      latest_metric: latestMetric ? { ...latestMetric, data: JSON.parse(latestMetric.data) } : null,
      prev_metric: prevMetric ? { ...prevMetric, data: JSON.parse(prevMetric.data) } : null,
    }
  })

  const stats = {
    total_clients: (db.prepare('SELECT COUNT(*) as count FROM clients WHERE status = ?').get('active') as any).count,
    total_competitors: (db.prepare('SELECT COUNT(*) as count FROM competitors').get() as any).count,
    total_posts: (db.prepare('SELECT COUNT(*) as count FROM competitive_posts').get() as any).count,
    active_patterns: (db.prepare("SELECT COUNT(*) as count FROM patterns WHERE status IN ('emerging', 'active')").get() as any).count,
    active_alerts: (db.prepare('SELECT COUNT(*) as count FROM alerts WHERE dismissed = 0').get() as any).count,
  }

  return NextResponse.json({ alerts, patterns, clientGrid, stats })
}
