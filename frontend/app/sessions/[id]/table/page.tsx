'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import {
  getSession, getSessionBooks, updateBook, deleteBook,
  downloadCSV, downloadExcel,
  type Book, type Session
} from '@/lib/api'

type EditingCell = { bookId: string; field: string }

const COLUMNS = [
  { key: 'sno',               label: '#',           width: '44px'  },
  { key: 'title',             label: 'Title',       width: '200px' },
  { key: 'authors',           label: 'Author(s)',   width: '150px' },
  { key: 'publisher',         label: 'Publisher',   width: '130px' },
  { key: 'publication_date',  label: 'Year',        width: '70px'  },
  { key: 'isbn_13',           label: 'ISBN-13',     width: '130px' },
  { key: 'isbn_10',           label: 'ISBN-10',     width: '100px' },
  { key: 'edition',           label: 'Edition',     width: '90px'  },
  { key: 'language',          label: 'Language',    width: '90px'  },
  { key: 'categories',        label: 'Category',    width: '130px' },
  { key: 'page_count',        label: 'Pages',       width: '70px'  },
  { key: 'demand_label',      label: 'Demand',      width: '90px'  },
  { key: 'demand_score',      label: 'Score',       width: '68px'  },
  { key: 'ai_confidence',     label: 'Confidence',  width: '88px'  },
  { key: 'verification_status', label: 'Status',   width: '120px' },
  { key: 'author_details',    label: 'Author Info', width: '180px' },
  { key: 'actions',           label: '',            width: '60px'  },
]

const EDITABLE = ['title','authors','publisher','publication_date','isbn_13','isbn_10','edition','language','demand_label']

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="stat-card">
      <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span className="font-display" style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text)', letterSpacing: '-0.02em' }}>
        {value}
      </span>
    </div>
  )
}

export default function TablePage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const router = useRouter()

  const [session, setSession]       = useState<Session | null>(null)
  const [books, setBooks]           = useState<Book[]>([])
  const [loading, setLoading]       = useState(true)
  const [editing, setEditing]       = useState<EditingCell | null>(null)
  const [editValue, setEditValue]   = useState('')
  const [saving, setSaving]         = useState<string | null>(null)
  const [exporting, setExporting]   = useState<'csv' | 'xlsx' | null>(null)
  const [search, setSearch]         = useState('')
  const [expandedBook, setExpandedBook] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([getSession(sessionId), getSessionBooks(sessionId)])
      setSession(s); setBooks(b)
    } catch { router.push('/sessions') }
    finally { setLoading(false) }
  }, [sessionId, router])

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return }
    load()
  }, [load, router])

  const startEdit = (bookId: string, field: string, current: string) => {
    if (!EDITABLE.includes(field)) return
    setEditing({ bookId, field })
    setEditValue(current)
  }

  const commitEdit = async () => {
    if (!editing) return
    const { bookId, field } = editing
    setSaving(bookId)
    try {
      let payload: any = {}
      if (field === 'authors') {
        payload.authors = editValue.split(',').map(s => s.trim()).filter(Boolean)
      } else if (field === 'page_count') {
        payload.page_count = parseInt(editValue) || null
      } else {
        payload[field] = editValue || null
      }
      const updated = await updateBook(bookId, payload)
      setBooks(prev => prev.map(b => b.id === bookId ? updated : b))
    } catch { alert('Failed to save changes') }
    finally { setSaving(null); setEditing(null) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(null)
  }

  const handleDelete = async (bookId: string) => {
    if (!confirm('Remove this book from the session?')) return
    try {
      await deleteBook(bookId)
      setBooks(prev => prev.filter(b => b.id !== bookId))
    } catch { alert('Failed to delete book') }
  }

  const handleExport = async (fmt: 'csv' | 'xlsx') => {
    setExporting(fmt)
    try {
      if (fmt === 'csv') await downloadCSV(sessionId)
      else await downloadExcel(sessionId)
    } catch { alert('Export failed') }
    finally { setExporting(null) }
  }

  const getCellValue = (book: Book, key: string): string => {
    if (key === 'authors') return (book.authors || []).join(', ')
    if (key === 'categories') return (book.categories || []).join(', ')
    if (key === 'ai_confidence') return book.ai_confidence ? `${Math.round(book.ai_confidence * 100)}%` : '—'
    if (key === 'demand_score') return book.demand_score ? `${book.demand_score}/100` : '—'
    if (key === 'author_details') {
      const d = book.author_details
      if (!d) return '—'
      return [d.name, d.birth_date ? `b. ${d.birth_date}` : '', d.work_count ? `${d.work_count} works` : ''].filter(Boolean).join(' · ')
    }
    const val = (book as any)[key]
    return val != null ? String(val) : '—'
  }

  const filteredBooks = books.filter(b => {
    if (!search) return true
    const q = search.toLowerCase()
    return (b.title || '').toLowerCase().includes(q)
      || (b.authors || []).join(' ').toLowerCase().includes(q)
      || (b.isbn_13 || '').includes(q)
      || (b.publisher || '').toLowerCase().includes(q)
  })

  const confidenceColor = (c?: number) => {
    if (!c) return 'var(--text3)'
    if (c >= 0.85) return '#34d399'
    if (c >= 0.65) return '#fbbf24'
    return '#f87171'
  }

  if (loading) return (
    <div className="mesh-bg min-h-screen">
      <Navbar current="Sessions" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12, color: 'var(--text3)', fontSize: 14 }}>
        <div className="spinner" /> Loading…
      </div>
    </div>
  )

  return (
    <div className="mesh-bg min-h-screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <Navbar current="Sessions" />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1600, margin: '0 auto', width: '100%', padding: '24px 20px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <button onClick={() => router.push('/sessions')} style={{ color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
              Sessions
            </button>
            <span style={{ color: 'var(--text3)' }}>/</span>
            <button onClick={() => router.push(`/sessions/${sessionId}/scan`)}
              style={{ color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
              {session?.name}
            </button>
            <span style={{ color: 'var(--text3)' }}>/</span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>Table</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="input"
              style={{ paddingLeft: 32, width: 220, padding: '8px 14px 8px 32px', fontSize: 13 }}
              placeholder="Search books…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Scan More */}
          <button
            className="btn-secondary"
            style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 7 }}
            onClick={() => router.push(`/sessions/${sessionId}/scan`)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Scan More
          </button>

          {/* Export buttons */}
          <button
            className="btn-primary"
            style={{ fontSize: 13, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 7 }}
            onClick={() => handleExport('xlsx')}
            disabled={exporting !== null || books.length === 0}
          >
            {exporting === 'xlsx'
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Exporting…</>
              : <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Excel
                </>
            }
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 7 }}
            onClick={() => handleExport('csv')}
            disabled={exporting !== null || books.length === 0}
          >
            {exporting === 'csv'
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Exporting…</>
              : <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  CSV
                </>
            }
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <StatCard label="Total Books" value={books.length} />
          <StatCard label="Verified" value={books.filter(b => b.verification_status === 'verified').length} color="#34d399" />
          <StatCard label="Needs Review" value={books.filter(b => b.verification_status === 'needs_review').length} color="#fbbf24" />
          <StatCard label="High Demand" value={books.filter(b => b.demand_label === 'High').length} color="var(--violet3)" />
          <div className="stat-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--violet3)" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Click any cell to edit</span>
          </div>
        </div>

        {/* Table */}
        {filteredBooks.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.4 }}>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <p style={{ fontSize: 16, marginBottom: 8 }}>{search ? 'No matches found' : 'No books in this session'}</p>
              {!search && (
                <button className="btn-primary" style={{ marginTop: 12, fontSize: 13 }}
                  onClick={() => router.push(`/sessions/${sessionId}/scan`)}>
                  Scan First Book
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <table className="data-table" style={{ minWidth: 1400 }}>
              <thead>
                <tr>
                  {COLUMNS.map(col => (
                    <th key={col.key} style={{ minWidth: col.width, width: col.width }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((book, idx) => (
                  <>
                  <tr key={book.id} style={{ opacity: saving === book.id ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                    {COLUMNS.map(col => {
                      if (col.key === 'sno') return (
                        <td key="sno" style={{ color: 'var(--text3)', textAlign: 'center', fontWeight: 500, fontSize: 12 }}>
                          {idx + 1}
                        </td>
                      )
                      if (col.key === 'actions') return (
                        <td key="actions">
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn-ghost"
                              style={{ padding: '5px 7px', color: 'var(--violet3)' }}
                              title="Expand details"
                              onClick={() => setExpandedBook(expandedBook === book.id ? null : book.id)}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                {expandedBook === book.id
                                  ? <polyline points="18 15 12 9 6 15"/>
                                  : <polyline points="6 9 12 15 18 9"/>}
                              </svg>
                            </button>
                            <button
                              className="btn-ghost"
                              style={{ padding: '5px 7px', color: '#f87171' }}
                              title="Delete book"
                              onClick={() => handleDelete(book.id)}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      )
                      if (col.key === 'demand_label') return (
                        <td key="demand_label"
                          style={{ cursor: 'pointer' }}
                          onClick={() => startEdit(book.id, 'demand_label', book.demand_label || '')}
                        >
                          {editing?.bookId === book.id && editing.field === 'demand_label' ? (
                            <select className="input" style={{ padding: '4px 8px', fontSize: 12 }}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              autoFocus
                            >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                            </select>
                          ) : (
                            <span className={`demand-${book.demand_label}`}>{book.demand_label || '—'}</span>
                          )}
                        </td>
                      )
                      if (col.key === 'ai_confidence') return (
                        <td key="ai_confidence">
                          <span style={{ color: confidenceColor(book.ai_confidence), fontWeight: 700, fontSize: 12 }}>
                            {book.ai_confidence ? `${Math.round(book.ai_confidence * 100)}%` : '—'}
                          </span>
                        </td>
                      )
                      if (col.key === 'verification_status') return (
                        <td key="verification_status">
                          <span className={`badge badge-${book.verification_status}`}>
                            {book.verification_status?.replace('_', ' ')}
                          </span>
                        </td>
                      )

                      const isEditable = EDITABLE.includes(col.key)
                      const cellVal = getCellValue(book, col.key)
                      const isEditing = editing?.bookId === book.id && editing.field === col.key

                      return (
                        <td key={col.key}
                          style={{
                            cursor: isEditable ? 'pointer' : 'default',
                            background: isEditing ? 'rgba(124,58,237,0.05)' : undefined,
                          }}
                          onClick={() => isEditable && startEdit(book.id, col.key, cellVal === '—' ? '' : cellVal)}
                          title={isEditable ? 'Click to edit' : undefined}
                        >
                          {isEditing ? (
                            <input
                              className="input"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={handleKeyDown}
                              autoFocus
                            />
                          ) : (
                            <span style={{ color: cellVal === '—' ? 'var(--text3)' : 'var(--text)' }}
                              title={cellVal !== '—' ? cellVal : undefined}>
                              {cellVal.length > 28 ? cellVal.slice(0, 28) + '…' : cellVal}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>

                  {/* Expanded row */}
                  {expandedBook === book.id && (
                    <tr key={`${book.id}-exp`}>
                      <td colSpan={COLUMNS.length} style={{ background: 'rgba(124,58,237,0.03)', padding: 0 }}>
                        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
                          <div>
                            <p style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>
                              Description
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                              {book.description || 'No description available.'}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>
                              Author Details
                            </p>
                            {book.author_details ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {book.author_details.name && (
                                  <p style={{ fontSize: 12, color: 'var(--text2)' }}>
                                    <span style={{ color: 'var(--text3)' }}>Name: </span>{book.author_details.name}
                                  </p>
                                )}
                                {book.author_details.birth_date && (
                                  <p style={{ fontSize: 12, color: 'var(--text2)' }}>
                                    <span style={{ color: 'var(--text3)' }}>Born: </span>{book.author_details.birth_date}
                                  </p>
                                )}
                                {book.author_details.work_count > 0 && (
                                  <p style={{ fontSize: 12, color: 'var(--text2)' }}>
                                    <span style={{ color: 'var(--text3)' }}>Works: </span>{book.author_details.work_count}
                                  </p>
                                )}
                                {book.author_details.top_subjects?.length > 0 && (
                                  <p style={{ fontSize: 12, color: 'var(--text2)' }}>
                                    <span style={{ color: 'var(--text3)' }}>Subjects: </span>
                                    {book.author_details.top_subjects.slice(0, 3).join(', ')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p style={{ fontSize: 12, color: 'var(--text3)' }}>No author data available.</p>
                            )}
                          </div>
                          <div>
                            <p style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>
                              Demand Analysis
                            </p>
                            <p className={`demand-${book.demand_label}`} style={{ marginBottom: 4 }}>
                              {book.demand_label || '—'} · {book.demand_score ?? '—'}/100
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--text3)' }}>
                              Based on Google Books ratings & category signals
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            Showing {filteredBooks.length} of {books.length} books · Click any cell to edit
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Session: {session?.name}</span>
        </div>
      </main>
    </div>
  )
}