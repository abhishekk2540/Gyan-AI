import { useRef, useState } from 'react'
import { ArrowUp, Check, FileText, LoaderCircle, Plus, Search, Upload, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { apiUrl } from '../lib/api'

const DOCS_KEY = 'gyan-ai-documents'

function readDocs() {
  try { return JSON.parse(localStorage.getItem(DOCS_KEY) || '[]') } catch { return [] }
}

function formatSize(size) {
  if (typeof size === 'string') return size
  if (!size) return 'PDF document'
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${(size / 1024).toFixed(0)} KB`
}

export default function RagTab({ addToast }) {
  const [docs, setDocs] = useState(readDocs)
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef(null)

  const saveDocs = nextDocs => {
    setDocs(nextDocs)
    localStorage.setItem(DOCS_KEY, JSON.stringify(nextDocs))
  }

  const handleFiles = async files => {
    const file = files?.[0]
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'docx', 'txt'].includes(extension)) {
      setUploadError('The knowledge base supports PDF, DOCX, and TXT files.')
      addToast('Choose a PDF, DOCX, or TXT file', 'error')
      return
    }

    setUploadError('')
    setUploading(true)
    const pendingDoc = { name: file.name, size: file.size, status: 'indexing', uploadedAt: Date.now() }
    saveDocs([pendingDoc, ...docs.filter(item => item.name !== file.name)])
    const form = new FormData()
    form.append('file', file)

    try {
      const response = await fetch(apiUrl('/api/rag/upload'), { method: 'POST', body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Upload failed (${response.status}).`)
      saveDocs([{ ...pendingDoc, status: 'indexed', chunks: data.chunks }, ...docs.filter(item => item.name !== file.name)])
      addToast(`${file.name} indexed successfully`)
    } catch (error) {
      const failedDocs = [{ ...pendingDoc, status: 'error' }, ...docs.filter(item => item.name !== file.name)]
      saveDocs(failedDocs)
      setUploadError(error.message || 'Could not index this document.')
      addToast(error.message || 'Document upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleQuery = async () => {
    if (!query.trim() || loading) return
    setLoading(true)
    setAnswer('')
    setSources([])
    try {
      const response = await fetch(apiUrl('/api/rag/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || `Search failed (${response.status}).`)
      }
      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json()
        setAnswer(data.answer || data.error || 'No answer was returned.')
        setSources(data.sources || [])
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let answerText = ''
      let sourceList = []
      const handleEvent = eventText => {
        const dataText = eventText.split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart())
          .join('\n')
        if (!dataText || dataText.trim() === '[DONE]') return
        try {
          const event = JSON.parse(dataText)
          if (event.sources) sourceList = event.sources
          if (event.content) answerText += event.content
        } catch { /* Ignore partial events. */ }
      }

      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const events = buffer.split(/\r?\n\r?\n/)
        buffer = events.pop() || ''
        events.forEach(handleEvent)
        setSources([...sourceList])
        if (answerText) setAnswer(answerText)
        if (done) break
      }
      if (buffer.trim()) handleEvent(buffer)
      setSources([...sourceList])
      setAnswer(answerText)
    } catch (error) {
      setAnswer(error.message || 'Document search failed. Please try again.')
      addToast(error.message || 'Document search failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rag-workspace workspace-view page-frame">
      <div className="page-heading">
        <div><p className="eyebrow">Knowledge Base</p><h1>Ask your documents</h1><p className="page-description">Bring a PDF into your workspace, then ask questions grounded in its contents.</p></div>
      </div>

      <div className="rag-workspace-grid">
        <aside className="document-column">
          <div className="column-heading"><div><h2>Your documents</h2><p>{docs.length ? `${docs.length} indexed ${docs.length === 1 ? 'document' : 'documents'}` : 'Files you add to this workspace'}</p></div><button className="small-icon-button" onClick={() => fileRef.current?.click()} aria-label="Add a document" title="Add a document"><Plus size={17} /></button></div>

          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" hidden onChange={event => { handleFiles(event.target.files); event.target.value = '' }} />
          <button
            className={`upload-dropzone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={event => { event.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={event => { event.preventDefault(); setDragOver(false); handleFiles(event.dataTransfer.files) }}
            disabled={uploading}
          >
            <span className="upload-glyph">{uploading ? <LoaderCircle size={19} className="spin-icon" /> : <Upload size={19} />}</span>
            <span className="upload-title">{uploading ? 'Indexing document…' : 'Drop a file or browse'}</span>
            <span className="upload-meta">PDF, DOCX, TXT · indexed for document search</span>
          </button>
          {uploadError && <div className="inline-error"><X size={15} />{uploadError}</div>}

          {docs.length > 0 ? (
            <div className="document-list">
              {docs.map((doc, index) => (
                <div className="document-row" key={`${doc.name}-${index}`}>
                  <div className="file-type-icon"><FileText size={17} /></div>
                  <div className="document-meta"><span className="document-name" title={doc.name}>{doc.name}</span><span className="document-size">{formatSize(doc.size)}</span></div>
                  {doc.status === 'indexing' ? <LoaderCircle size={15} className="spin-icon status-icon" /> : doc.status === 'error' ? <X size={15} className="status-icon error-icon" /> : <Check size={15} className="status-icon success-icon" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="document-empty"><FileText size={18} /><p>No documents yet</p><span>Uploaded PDFs will appear here once they have been indexed.</span></div>
          )}

          <div className="privacy-note"><span className="privacy-mark" />Documents are indexed for retrieval by the assistant.</div>
        </aside>

        <div className="document-chat-column">
          <div className="document-chat-heading"><div><h2>Ask a question</h2><p>Answers are generated from your indexed documents.</p></div><span className="retrieval-label"><Search size={14} />RAG search</span></div>
          <div className="document-answer-area">
            {!answer && !loading ? (
              <div className="answer-placeholder">
                <div className="answer-placeholder-mark"><Search size={19} /></div>
                <h3>Find the detail you need</h3>
                <p>{docs.length ? 'Ask a specific question about your files. Gyan will look for relevant passages before answering.' : 'Add a PDF, DOCX, or TXT file first. You can then ask questions and review source passages.'}</p>
              </div>
            ) : (
              <div className="answer-result">
                <div className="answer-label">Answer</div>
                {loading && !answer ? <div className="answer-loading"><LoaderCircle size={16} className="spin-icon" />Searching documents and preparing an answer…</div> : <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown></div>}
                {sources.length > 0 && <details className="source-details"><summary>{sources.length} source {sources.length === 1 ? 'passage' : 'passages'}</summary><div className="source-list">{sources.map((source, index) => <blockquote key={index}>{source}</blockquote>)}</div></details>}
              </div>
            )}
          </div>
          <div className="rag-composer-wrap">
            <div className="chat-composer">
              <textarea className="composer-input" placeholder={docs.length ? 'Ask something about your documents…' : 'Upload a document to begin…'} value={query} rows={1} disabled={!docs.length || loading} onChange={event => { setQuery(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px` }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleQuery() } }} />
              <div className="composer-toolbar"><span className="rag-composer-hint">{docs.length ? 'Searches your indexed PDFs' : 'PDF upload required'}</span><button className="send-button" disabled={!query.trim() || loading || !docs.length} onClick={handleQuery} aria-label="Ask documents">{loading ? <LoaderCircle size={17} className="spin-icon" /> : <ArrowUp size={18} />}</button></div>
            </div>
            <p className="composer-hint">Responses can be incomplete; check the source passages when details matter.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
