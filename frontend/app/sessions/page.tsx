'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { getSessions, createSession, deleteSession, type Session } from '@/lib/api'

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ name: '', location: '', department: '' })
  const [error, setError]       = useState('')

  const load = useCallback(async () => {
    try {
      const data = await getSessions()
      setSessions(data)
    } catch {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return }
    load()
  }, [load, router])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    setError('')
    try {
      const session = await createSession({
        name: form.name.trim(),
        location: form.location || undefined,
        department: form.department || undefined,
      })
      setShowForm(false)
      setForm({ name: '', location: '', department: '' })
      router.push(`/sessions/${session.id}/scan`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create session')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete session "${name}" and all its books?`)) return
    try {
      await deleteSession(id)
      setSessions(s => s.filter(x => x.id !== id))
    } catch {
      alert('Failed to delete session')
    }
  }

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  if (loading) return (
    <div className="mesh-bg min-h-screen">
      <Navbar current="Sessions" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12, color: 'var(--text3)' }}>
        <div className="spinner" />
        <span style={{ fontSize: 14 }}>Loading sessions…</span>
      </div>
    </div>
  )

  return (
    <div className="mesh-bg min-h-screen">
      <Navbar current="Sessions" />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px' }}>
        {/* Header */}
        <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 48 }}>
          <div>
            <h1 className="font-display" style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 8 }}>
              Scan Sessions
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 300 }}>
              Each session groups a batch of books scanned together
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Session
          </button>
        </div>

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="fade-up" style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(124,58,237,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--violet3)" strokeWidth="1.5">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <h3 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              No sessions yet
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 28 }}>
              Create your first scan session to start cataloguing books
            </p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              Create First Session
            </button>
          </div>
        )}

        {/* Sessions grid */}
        {sessions.length > 0 && (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {sessions.map((session, i) => (
              <div key={session.id} className="card fade-up" style={{
                padding: '24px',
                cursor: 'pointer',
                animationDelay: `${i * 50}ms`,
                transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
              }}
                onClick={() => router.push(`/sessions/${session.id}/scan`)}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(124,58,237,0.1)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11,
                    background: 'rgba(124,58,237,0.1)',
                    border: '1px solid rgba(124,58,237,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--violet3)" strokeWidth="1.8">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(session.id, session.name) }}
                    className="btn-ghost"
                    style={{ padding: '4px 8px', color: 'var(--text3)' }}
                    title="Delete session"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                      <path d="M10,11v6M14,11v6"/>
                    </svg>
                  </button>
                </div>

                <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.01em' }}>
                  {session.name}
                </h3>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {session.location && (
                    <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      {session.location}
                    </span>
                  )}
                  {session.department && (
                    <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9,22 9,12 15,12 15,22"/>
                      </svg>
                      {session.department}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDate(session.created_at)}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--violet3)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    Open →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create session modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div className="card scale-in" style={{ width: '100%', maxWidth: 440, padding: '32px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                New Scan Session
              </h2>
              <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setShowForm(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>
                  Session Name *
                </label>
                <input
                  className="input"
                  placeholder="e.g. May 2026 New Arrivals"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>
                  Location
                </label>
                <input
                  className="input"
                  placeholder="e.g. Central Library, Floor 2"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>
                  Department
                </label>
                <input
                  className="input"
                  placeholder="e.g. Fiction, Science, Reference"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                />
              </div>

              {error && (
                <div style={{ padding: '11px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13, color: '#f87171' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={creating}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {creating ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating…</> : 'Create & Start Scanning'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}