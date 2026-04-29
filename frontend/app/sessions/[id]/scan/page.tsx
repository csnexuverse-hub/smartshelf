'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { scanBook, getSession, getSessionBooks, type Book, type Session } from '@/lib/api'

type ScanState = 'idle' | 'preview' | 'processing' | 'done' | 'error'

const statusSteps = [
  { msg: 'Uploading image…',           pct: 12 },
  { msg: 'Gemini AI analyzing cover…', pct: 28 },
  { msg: 'Extracting title & author…', pct: 42 },
  { msg: 'Looking up Google Books…',   pct: 58 },
  { msg: 'Enriching metadata…',        pct: 72 },
  { msg: 'Calculating demand score…',  pct: 84 },
  { msg: 'Finalizing…',               pct: 92 },
]

function ConfidencePill({ value }: { value?: number }) {
  if (!value) return <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
  const pct = Math.round(value * 100)
  const color = value >= 0.85 ? '#34d399' : value >= 0.65 ? '#fbbf24' : '#f87171'
  return (
    <span style={{ color, fontWeight: 700, fontSize: 13 }}>{pct}%</span>
  )
}

function DemandChip({ label }: { label?: string }) {
  if (!label) return <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
  const colors: Record<string, string> = { High: '#34d399', Medium: '#fbbf24', Low: 'var(--text3)' }
  return (
    <span style={{ color: colors[label] || 'var(--text3)', fontWeight: 700, fontSize: 13 }}>
      {label}
    </span>
  )
}

export default function ScanPage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const router = useRouter()

  const [session, setSession]     = useState<Session | null>(null)
  const [books, setBooks]         = useState<Book[]>([])
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [preview, setPreview]     = useState<string | null>(null)
  const [file, setFile]           = useState<File | null>(null)
  const [result, setResult]       = useState<Book | null>(null)
  const [error, setError]         = useState('')
  const [progress, setProgress]   = useState(0)
  const [stepIdx, setStepIdx]     = useState(0)
  const [cameraActive, setCameraActive] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const streamRef    = useRef<MediaStream | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    getSession(sessionId).then(setSession).catch(() => router.push('/sessions'))
    getSessionBooks(sessionId).then(setBooks).catch(() => {})
  }, [sessionId, router])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)
    } catch {
      alert('Camera not accessible. Please use Upload instead.')
    }
  }

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const f = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
      setFile(f)
      setPreview(canvas.toDataURL('image/jpeg', 0.92))
      setScanState('preview')
      stopCamera()
    }, 'image/jpeg', 0.92)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
    setScanState('preview')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (!f || !f.type.startsWith('image/')) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
    setScanState('preview')
  }

  const handleScan = async () => {
    if (!file) return
    setScanState('processing')
    setError('')
    setProgress(0)
    setStepIdx(0)

    let idx = 0
    setProgress(statusSteps[0].pct)
    const interval = setInterval(() => {
      idx = Math.min(idx + 1, statusSteps.length - 1)
      setStepIdx(idx)
      setProgress(statusSteps[idx].pct)
    }, 3800)

    try {
      const book = await scanBook(sessionId, file, () => {})
      clearInterval(interval)
      setProgress(100)
      setResult(book)
      setBooks(prev => [...prev, book])
      setScanState('done')
    } catch (err: any) {
      clearInterval(interval)
      setError(err.response?.data?.detail || 'AI processing failed. Check your GEMINI_API_KEY.')
      setScanState('error')
    }
  }

  const reset = () => {
    setScanState('idle')
    setPreview(null)
    setFile(null)
    setResult(null)
    setError('')
    setProgress(0)
    setStepIdx(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="mesh-bg min-h-screen">
      <Navbar current="Sessions" />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Breadcrumb + View Table */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <button onClick={() => router.push('/sessions')} style={{ color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
              Sessions
            </button>
            <span style={{ color: 'var(--text3)' }}>/</span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{session?.name || '…'}</span>
          </div>

          <button
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 18px' }}
            onClick={() => router.push(`/sessions/${sessionId}/table`)}
            disabled={books.length === 0}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            View Table
            {books.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 12,
                background: 'rgba(124,58,237,0.15)', color: 'var(--violet3)',
              }}>{books.length}</span>
            )}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>

          {/* ── LEFT: Capture panel ── */}
          <div>
            <h2 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 22 }}>
              Scan a Book
            </h2>

            {/* Camera view */}
            {cameraActive && (
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '4/3', marginBottom: 16 }}>
                <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
                <div className="scan-line" />
                <div className="corner-guide tl" />
                <div className="corner-guide tr" />
                <div className="corner-guide bl" />
                <div className="corner-guide br" />
                <div style={{
                  position: 'absolute', inset: 0,
                  border: '1px solid rgba(124,58,237,0.3)',
                  borderRadius: 16,
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12 }}>
                  <button className="btn-primary" style={{ padding: '10px 28px', fontSize: 15 }} onClick={capturePhoto}>
                    📸 Capture
                  </button>
                  <button className="btn-secondary" style={{ padding: '10px 18px' }} onClick={stopCamera}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Idle: drop zone */}
            {scanState === 'idle' && !cameraActive && (
              <div
                style={{
                  border: '1px dashed rgba(124,58,237,0.3)',
                  borderRadius: 16, padding: '48px 24px',
                  textAlign: 'center',
                  background: 'rgba(124,58,237,0.03)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                className="fade-up"
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = 'var(--violet2)'; (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.07)' }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.3)'; (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.03)' }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{
                  width: 64, height: 64, borderRadius: 18,
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--violet3)" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
                  Drop a book image here
                </p>
                <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
                  or click to browse files
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    className="btn-primary"
                    style={{ fontSize: 13, padding: '9px 20px' }}
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                  >
                    Upload Image
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 13, padding: '9px 18px' }}
                    onClick={e => { e.stopPropagation(); startCamera() }}
                  >
                    📷 Use Camera
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 20 }}>
                  Tip: Capture back cover for best ISBN detection
                </p>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              </div>
            )}

            {/* Preview */}
            {scanState === 'preview' && preview && (
              <div className="fade-up">
                <div style={{ borderRadius: 14, overflow: 'hidden', background: '#000', marginBottom: 14, border: '1px solid var(--border)' }}>
                  <img src={preview} alt="Book preview" style={{ width: '100%', objectFit: 'contain', maxHeight: 320, display: 'block' }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', fontSize: 14 }}
                    onClick={handleScan}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                      <polyline points="13 2 13 9 20 9"/>
                    </svg>
                    Scan with Gemini AI
                  </button>
                  <button className="btn-secondary" style={{ padding: '12px 18px' }} onClick={reset}>
                    Retake
                  </button>
                </div>
              </div>
            )}

            {/* Processing */}
            {scanState === 'processing' && (
              <div className="fade-up card" style={{ padding: '32px 24px', textAlign: 'center' }}>
                {preview && (
                  <div style={{ position: 'relative', width: 120, height: 152, margin: '0 auto 24px', borderRadius: 10, overflow: 'hidden' }}>
                    <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: 'rgba(124,58,237,0.2)',
                        border: '2px solid var(--violet2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div className="spinner" />
                      </div>
                    </div>
                    <div className="scan-line" />
                  </div>
                )}
                <p style={{ color: 'var(--violet3)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  {statusSteps[stepIdx]?.msg}
                </p>
                <p style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 20 }}>
                  This takes 10–30 seconds
                </p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <p style={{ color: 'var(--text3)', fontSize: 11, marginTop: 8 }}>{progress}%</p>
              </div>
            )}

            {/* Error */}
            {scanState === 'error' && (
              <div className="fade-up" style={{
                padding: '20px 22px', borderRadius: 14,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <p style={{ color: '#f87171', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
                  ⚠ Processing failed
                </p>
                <p style={{ color: 'rgba(248,113,113,0.7)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                  {error}
                </p>
                <button className="btn-secondary" style={{ fontSize: 13 }} onClick={reset}>
                  Try Again
                </button>
              </div>
            )}

            {/* Done */}
            {scanState === 'done' && result && (
              <div className="fade-up">
                <div style={{
                  padding: '20px 22px', borderRadius: 14,
                  background: 'rgba(16,185,129,0.05)',
                  border: '1px solid rgba(16,185,129,0.18)',
                  marginBottom: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(16,185,129,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <span style={{ color: '#34d399', fontWeight: 600, fontSize: 13 }}>Book scanned successfully</span>
                    <span className={`badge badge-${result.verification_status}`}>
                      {result.verification_status?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.3, marginBottom: 4 }}>
                    {result.title || 'Unknown Title'}
                  </p>
                  {result.authors?.length > 0 && (
                    <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
                      {result.authors.join(', ')}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>AI Confidence</p>
                      <ConfidencePill value={result.ai_confidence} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Demand</p>
                      <DemandChip label={result.demand_label} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Score</p>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{result.demand_score ?? '—'}/100</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Source</p>
                      <span style={{ fontSize: 13, color: 'var(--violet3)', fontWeight: 500 }}>
                        {result.data_source?.replace('_', ' ') || '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14 }}
                    onClick={reset}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Scan Next Book
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 13, padding: '10px 18px' }}
                    onClick={() => router.push(`/sessions/${sessionId}/table`)}
                  >
                    View Table
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Recent scans ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                Recent Scans
              </h2>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)',
              }}>
                {books.length} books
              </span>
            </div>

            {books.length === 0 ? (
              <div style={{
                padding: '48px 24px', textAlign: 'center',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 16, color: 'var(--text3)', fontSize: 13,
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.2" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                No books scanned yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 560, overflowY: 'auto', paddingRight: 4 }}>
                {[...books].reverse().map((book, i) => (
                  <div key={book.id} className="card slide-in" style={{
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    animationDelay: `${i * 40}ms`,
                    cursor: 'default',
                  }}>
                    <div style={{
                      width: 36, height: 44, borderRadius: 6, flexShrink: 0,
                      background: 'rgba(124,58,237,0.1)',
                      border: '1px solid rgba(124,58,237,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>
                      📖
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                        {book.title || 'Processing…'}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                        {book.authors?.join(', ') || '—'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`badge badge-${book.verification_status}`}>
                          {book.verification_status?.replace('_', ' ')}
                        </span>
                        {book.demand_label && (
                          <span className={`demand-${book.demand_label}`} style={{ fontSize: 11 }}>
                            {book.demand_label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <ConfidencePill value={book.ai_confidence} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}