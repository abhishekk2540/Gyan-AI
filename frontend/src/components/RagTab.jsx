import { useState, useRef, useEffect } from 'react'
import AnimatedTitle from './AnimatedTitle'
import ReactMarkdown from 'react-markdown'

export default function RagTab({ addToast }) {
  const [docs, setDocs]       = useState([])
  const [query, setQuery]     = useState('')
  const [answer, setAnswer]   = useState(null)

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const fileRef    = useRef(null)
  const answerRef  = useRef(null)

  // Auto-scroll to answer when it starts streaming
  useEffect(() => {
    if (answer && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [answer])

  const handleFiles = async (files) => {
    const file = files[0]
    if (!file || file.type !== 'application/pdf') {
      addToast('Please upload a PDF file', 'error'); return
    }

    setUploading(true)
    const newDoc = { name: file.name, size: (file.size / 1024).toFixed(1) + ' KB', status: 'indexing' }
    setDocs(prev => [...prev, newDoc])

    const attemptUpload = async () => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/rag/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server error ${res.status}`)
      }
      return res
    }

    try {
      try {
        await attemptUpload()
      } catch (firstErr) {
        console.warn('[RAG Upload] First attempt failed, retrying…', firstErr.message)
        await new Promise(r => setTimeout(r, 800))
        await attemptUpload()
      }
      setDocs(prev => prev.map(d => d.name === file.name ? { ...d, status: 'indexed' } : d))
      addToast(`${file.name} indexed successfully!`)
    } catch (err) {
      setDocs(prev => prev.map(d => d.name === file.name ? { ...d, status: 'error' } : d))
      addToast(err.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleQuery = async () => {
    if (!query.trim() || loading) return
    setLoading(true); setAnswer('')
    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) throw new Error()

      if (res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setAnswer(data.answer || data.error)
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let aiContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunkStr = decoder.decode(value, { stream: true })
        const lines = chunkStr.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const json = JSON.parse(data)
            if (json.content) {
              aiContent += json.content
              setAnswer(aiContent)
            }
          } catch { /* non-json chunk */ }
        }
      }
    } catch (err) {
      const msg = err.message || 'RAG query failed'
      setAnswer(`⚠️ ${msg}`)
      addToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rag-container">
      {/* Header */}
      <div className="chat-header" style={{ flexShrink: 0 }}>
        <AnimatedTitle title="Ask Docs" accentWord="Docs" />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="model-badge">📚 RAG</div>
          <button className="clear-btn" onClick={() => { setQuery(''); setAnswer(null); setDocs([]) }}>🗑️ Clear All</button>
        </div>
      </div>

      {/* ── 2-Column Layout ─────────────────────────────────── */}
      <div className="rag-layout">

        {/* LEFT — Upload & Indexed Docs */}
        <div className="rag-left">
          <div className="section-label">Upload Document</div>

          {/* Drop zone */}
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={(e) => { if (e.target !== fileRef.current) fileRef.current?.click() }}
          >
            <div className="upload-icon">{uploading ? '⏳' : '📄'}</div>
            <h3>{uploading ? 'Indexing PDF…' : 'Drop a PDF here'}</h3>
            <p>or click to browse</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Only PDF files supported</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files.length > 0) {
                  handleFiles(e.target.files)
                  e.target.value = null
                }
              }}
            />
          </div>

          {/* Indexed docs list */}
          {docs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="section-label">Indexed Documents ({docs.length})</div>
              <div className="doc-list">
                {docs.map((d, i) => (
                  <div key={i} className="doc-item">
                    <span className="doc-icon">📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="doc-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      <div className="doc-size">{d.size}</div>
                    </div>
                    <span className={`doc-status ${d.status}`}>
                      {d.status === 'indexing' ? '⏳' : d.status === 'indexed' ? '✅' : '❌'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state hint */}
          {docs.length === 0 && (
            <div style={{ marginTop: 20, padding: '16px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>How it works</div>
              <div>1. Upload a PDF document</div>
              <div>2. It gets split into chunks & indexed</div>
              <div>3. Ask any question on the right</div>
              <div>4. AI answers using only your doc</div>
            </div>
          )}
        </div>

        {/* RIGHT — Query & Answer */}
        <div className="rag-right">
          <div className="section-label">Ask a Question</div>

          {/* Query input */}
          <div className="chat-input-area" style={{ flexShrink: 0 }}>
            <textarea
              id="rag-query-input"
              className="chat-input"
              placeholder={docs.length === 0 ? 'Upload a PDF first…' : 'What does the document say about…'}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuery() } }}
              rows={2}
              disabled={docs.length === 0 && !loading}
            />
            <button
              id="rag-search-btn"
              className="send-btn"
              disabled={!query.trim() || loading || (docs.length === 0)}
              onClick={handleQuery}
            >
              {loading ? <span className="spinner" /> : '➤'}
            </button>
          </div>

          {/* Answer scroll area */}
          <div className="rag-answer-area">
            {/* Loading */}
            {loading && (
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span className="spinner" />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Searching documents and generating answer…</span>
              </div>
            )}

            {/* Answer */}
            {answer && (
              <div ref={answerRef} className="card" style={{ animation: 'fadeUp 0.3s ease', flexShrink: 0 }}>
                <div className="section-label">Answer</div>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)' }}>
                  <ReactMarkdown>{answer}</ReactMarkdown>
                </div>
              </div>
            )}



            {/* Empty prompt */}
            {!loading && !answer && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                {docs.length === 0
                  ? '← Upload a PDF to get started'
                  : 'Ask a question about your document above'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
