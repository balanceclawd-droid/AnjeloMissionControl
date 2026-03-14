interface Alert {
  id: number
  alert_type: string
  severity: string
  message: string
  niche?: string
  created_at: string
  dismissed: number
}

const severityColors: Record<string, string> = {
  low: 'border-l-severity-low',
  medium: 'border-l-severity-medium',
  high: 'border-l-severity-high',
  critical: 'border-l-red-500',
}

const severityBadgeColors: Record<string, string> = {
  low: 'bg-severity-low/20 text-severity-low',
  medium: 'bg-severity-medium/20 text-severity-medium',
  high: 'bg-severity-high/20 text-severity-high',
  critical: 'bg-red-500/20 text-red-400',
}

// Extract tweet ID from message like "... [2032484860472725915]"
function extractTweetId(message: string): string | null {
  const match = message.match(/\[(\d{15,})\]/)
  return match ? match[1] : null
}

// Determine the "more info" link based on alert type
function getAlertLink(alert: Alert): { href: string; label: string } | null {
  const tweetId = extractTweetId(alert.message)
  if (tweetId) {
    return { href: `https://x.com/i/status/${tweetId}`, label: 'View on X ↗' }
  }
  if (alert.alert_type.startsWith('pattern')) {
    const params = alert.niche ? `?niche=${encodeURIComponent(alert.niche)}` : ''
    return { href: `/patterns${params}`, label: 'View Patterns ↗' }
  }
  if (alert.alert_type === 'engagement_spike' || alert.alert_type === 'competitor_spike') {
    return { href: '/posts', label: 'View Posts ↗' }
  }
  return null
}

export default function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss?: (id: number) => void }) {
  const typeLabels: Record<string, string> = {
    pattern_emerging: 'Pattern Emerging',
    pattern_accelerating: 'Accelerating',
    engagement_spike: 'Engagement Spike',
    niche_trend: 'Niche Trend',
    competitor_spike: 'Competitor Spike',
  }

  const link = getAlertLink(alert)
  const isExternal = link?.href.startsWith('http')

  return (
    <div className={`bg-bg-card border border-border rounded-lg p-4 border-l-4 ${severityColors[alert.severity] || 'border-l-border'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${severityBadgeColors[alert.severity] || 'bg-neutral-800 text-neutral-400'}`}>
              {alert.severity}
            </span>
            <span className="text-xs text-neutral-500">
              {typeLabels[alert.alert_type] || alert.alert_type}
            </span>
            {alert.niche && (
              <span className="text-xs text-neutral-600 bg-neutral-800 px-1.5 py-0.5 rounded">
                {alert.niche}
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-300">{alert.message}</p>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-xs text-neutral-600">
              {new Date(alert.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            {link && (
              <a
                href={link.href}
                target={isExternal ? '_blank' : '_self'}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="text-xs text-accent-red hover:underline"
              >
                {link.label}
              </a>
            )}
          </div>
        </div>
        {onDismiss && !alert.dismissed && (
          <button
            onClick={() => onDismiss(alert.id)}
            className="text-neutral-600 hover:text-neutral-400 text-xs shrink-0"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
