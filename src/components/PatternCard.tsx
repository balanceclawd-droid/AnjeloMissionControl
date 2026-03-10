'use client'
import { useState, useEffect } from 'react'

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
  post_ids: number[]
}

interface PostDetail {
  id: number
  content: string
  engagement_score: number
  posted_at: string
  bookmark_count: number
  quote_count: number
  conversation_depth: number
  twitter_post_id: string
  competitors: { name: string; niche: string } | null
}

const statusColors: Record<string, string> = {
  emerging: 'bg-blue-500/20 text-blue-400',
  active: 'bg-green-500/20 text-green-400',
  declining: 'bg-yellow-500/20 text-yellow-400',
  dormant: 'bg-neutral-500/20 text-neutral-400',
}

const severityBar = (score: number) => {
  if (score >= 90) return 'bg-red-500'
  if (score >= 70) return 'bg-orange-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-blue-500'
}

export default function PatternCard({ pattern }: { pattern: Pattern }) {
  const [expanded, setExpanded] = useState(false)
  const [posts, setPosts] = useState<PostDetail[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (expanded && posts.length === 0 && pattern.post_ids?.length > 0) {
      setLoading(true)
      fetch(`/api/patterns/${pattern.id}/posts?t=${Date.now()}`)
        .then(r => r.json())
        .then(data => {
          setPosts(Array.isArray(data) ? data : [])
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [expanded, pattern.id, pattern.post_ids, posts.length])

  return (
    <div
      className={`bg-bg-card border rounded-lg p-4 transition-colors cursor-pointer ${expanded ? 'border-accent-red/40 col-span-2' : 'border-border hover:border-border-light'}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${statusColors[pattern.status]}`}>
            {pattern.status}
          </span>
          <span className="text-xs text-neutral-600 bg-neutral-800 px-1.5 py-0.5 rounded">
            {pattern.niche}
          </span>
        </div>
        <div className="text-right flex items-center gap-3">
          <div>
            <p className="text-lg font-semibold text-white">{pattern.avg_engagement_score}</p>
            <p className="text-[10px] text-neutral-500 uppercase">Avg Score</p>
          </div>
          <span className="text-neutral-600 text-xs">{expanded ? '▲' : '▼'}</span>
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
        {pattern.post_ids?.length > 0 && (
          <span>{pattern.post_ids.length} post{pattern.post_ids.length !== 1 ? 's' : ''} matched</span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-3" onClick={e => e.stopPropagation()}>
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Matched Posts</h3>
          {loading ? (
            <p className="text-xs text-neutral-600">Loading posts...</p>
          ) : posts.length === 0 ? (
            <p className="text-xs text-neutral-600">No post details available</p>
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-neutral-900/50 border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-accent-red">{post.competitors?.name || 'Unknown'}</span>
                      <span className="text-[10px] text-neutral-600">{new Date(post.posted_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-neutral-300 whitespace-pre-wrap break-words">{post.content}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-white">{post.engagement_score}</p>
                    <div className={`w-10 h-1 rounded-full ml-auto mt-1 ${severityBar(post.engagement_score)}`} />
                  </div>
                </div>
                <div className="flex gap-4 text-[10px] text-neutral-500">
                  <span>📌 {post.bookmark_count || 0} bookmarks</span>
                  <span>🔁 {post.quote_count || 0} quotes</span>
                  <span>💬 {post.conversation_depth || 0} conv depth</span>
                  {post.twitter_post_id && (
                    <a
                      href={`https://x.com/i/status/${post.twitter_post_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-red hover:underline ml-auto"
                      onClick={e => e.stopPropagation()}
                    >
                      View on X ↗
                    </a>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Why this pattern */}
          <div className="bg-neutral-900/30 border border-border rounded-lg p-3 mt-2">
            <h4 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Why this pattern was detected</h4>
            <p className="text-xs text-neutral-500">
              {pattern.hook_type === 'media-only' && 'These posts use minimal text with media attachments. Short captions + strong visuals outperform long-form copy in this niche.'}
              {pattern.hook_type === 'question' && 'Question hooks drive replies and engagement. These competitors are using questions to spark conversation and boost algorithmic reach.'}
              {pattern.hook_type === 'identity' && 'Bold, short identity statements (no links, no asks) create tribal engagement. Followers share these to signal belonging.'}
              {!['media-only', 'question', 'identity'].includes(pattern.hook_type) && `${pattern.competitor_count} competitors in ${pattern.niche} are using "${pattern.hook_type}" hooks with above-average engagement.`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
