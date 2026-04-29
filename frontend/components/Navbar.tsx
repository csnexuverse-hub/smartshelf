'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Navbar({ current }: { current?: string }) {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const user = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}')
    : {}

  return (
    <header style={{
      background: 'rgba(10,10,15,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/sessions" className="flex items-center gap-2.5 group" style={{ textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
            transition: 'box-shadow 0.2s',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <span className="font-display" style={{ fontSize: 17, fontWeight: 700, color: '#e8e8f0', letterSpacing: '-0.01em' }}>
            LibraryScan
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <Link href="/sessions"
            className="btn-ghost"
            style={{
              color: current === 'Sessions' ? 'var(--violet3)' : 'var(--text3)',
              background: current === 'Sessions' ? 'rgba(124,58,237,0.1)' : 'transparent',
              fontWeight: current === 'Sessions' ? 600 : 400,
              fontSize: 13,
            }}>
            Sessions
          </Link>
        </nav>

        {/* User */}
        <div className="flex items-center gap-3">
          {user.username && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 10px 4px 6px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--violet), var(--violet3))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff',
              }}>
                {(user.username || 'U')[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                {user.username}
              </span>
            </div>
          )}
          <button onClick={handleLogout} className="btn-ghost" style={{ fontSize: 12 }}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}