interface Pattern {
  id: number
  niche: string
  hook_type: string
  structure: string
  cta_type: string
  pattern_description: string
  competitor_count: number
  avg_engagement_score: number
  status: string
  first_detected: string
  last_seen: string
}

const statusColors: Record<string, string> = {
  emerging: 'bg-blue-500/20 text-blue-400',
  active: 'bg-green-500/20 text-green-400',
  declining: 'bg-yellow-500/20 text-yellow-400',
  dormant: 'bg-neutral-500/20 text-neutral-400',
}

export default function PatternCard({ pattern }: { pattern: Pattern }) {
  return (
    <div className="bg-bg-card border border-border rounded-lg p-4 hover:border-border-light transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${statusColors[pattern.status]}`}>
            {pattern.status}
          </span>
          <span className="text-xs text-neutral-600 bg-neutral-800 px-1.5 py-0.5 rounded">
            {pattern.niche}
          </span>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-white">{pattern.avg_engagement_score}</p>
          <p className="text-[10px] text-neutral-500 uppercase">Avg Score</p>
        </div>
      </div>
      <p className="text-sm text-neutral-300 mb-3">{pattern.pattern_description}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs bg-neutral-800/50 text-neutral-400 px-2 py-1 rounded">{pattern.hook_type}</span>
        <span className="text-xs bg-neutral-800/50 text-neutral-400 px-2 py-1 rounded">{pattern.structure}</span>
        <span className="text-xs bg-neutral-800/50 text-neutral-400 px-2 py-1 rounded">{pattern.cta_type}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-neutral-600">
        <span>{pattern.competitor_count} competitor{pattern.competitor_count !== 1 ? 's' : ''}</span>
        <span>First seen: {new Date(pattern.first_detected).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
