'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    if (localStorage.getItem('token')) router.replace('/sessions')
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(username, password)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify({ username: data.username, role: data.role }))
      router.push('/sessions')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mesh-bg min-h-screen flex items-center justify-center p-4">
      {/* Decorative orbs */}
      <div style={{
        position: 'fixed', top: '15%', left: '10%', width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '20%', right: '8%', width: 300, height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="fade-up w-full" style={{ maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div className="text-center" style={{ marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(124,58,237,0.35), 0 0 0 1px rgba(124,58,237,0.2)',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <h1 className="font-display" style={{ fontSize: 30, fontWeight: 800, color: '#e8e8f0', letterSpacing: '-0.03em', marginBottom: 6 }}>
            LibraryScan
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 300 }}>
            AI-powered book metadata extraction
          </p>
        </div>

        {/* Card */}
        <div className="card-glass" style={{ padding: '36px 32px' }}>
          <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 28, letterSpacing: '-0.01em' }}>
            Sign in to continue
          </h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>
                Username
              </label>
              <input
                className="input"
                type="text"
                placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>
                Password
              </label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{
                padding: '11px 14px', borderRadius: 10,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                fontSize: 13, color: '#f87171',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px 22px', fontSize: 15, marginTop: 4 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
            Default credentials: <strong style={{ color: 'var(--text2)' }}>admin / admin123</strong>
          </p>
        </div>

        {/* Powered by */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--text3)' }}>
          Powered by{' '}
          <span style={{ color: 'var(--violet3)', fontWeight: 500 }}>Gemini AI</span>
          {' '}·{' '}
          <span style={{ color: 'var(--violet3)', fontWeight: 500 }}>Google Books</span>
          {' '}·{' '}
          <span style={{ color: 'var(--violet3)', fontWeight: 500 }}>Open Library</span>
        </p>
      </div>
    </div>
  )
}