'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '◆' },
  { href: '/clients', label: 'Clients', icon: '●' },
  { href: '/competitors', label: 'Competitors', icon: '▲' },
  { href: '/posts', label: 'Posts', icon: '■' },
  { href: '/patterns', label: 'Patterns', icon: '◎' },
  { href: '/alerts', label: 'Alerts', icon: '⚡' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-bg-card border-r border-border flex flex-col z-50">
      <div className="p-6 border-b border-border">
        <h1 className="text-lg font-bold text-white tracking-tight">
          <span className="text-accent-red">●</span> Intel Dashboard
        </h1>
        <p className="text-xs text-neutral-500 mt-1">Competitive Intelligence</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-accent-red/10 text-accent-red font-medium'
                  : 'text-neutral-400 hover:text-white hover:bg-bg-hover'
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-xs text-neutral-600">v1.0.0</p>
      </div>
    </aside>
  )
}
