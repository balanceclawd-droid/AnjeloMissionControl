interface MetricCardProps {
  label: string
  value: string | number
  change?: number
  subtitle?: string
}

export default function MetricCard({ label, value, change, subtitle }: MetricCardProps) {
  return (
    <div className="bg-bg-card border border-border rounded-lg p-4">
      <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-semibold text-white">{value}</p>
        {change !== undefined && (
          <span className={`text-sm font-medium mb-0.5 ${change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-neutral-500'}`}>
            {change > 0 ? '↑' : change < 0 ? '↓' : '—'} {Math.abs(change)}%
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-neutral-600 mt-1">{subtitle}</p>}
    </div>
  )
}
