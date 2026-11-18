import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp, BookOpen, Check, ChevronRight, Copy, FileText, Globe2, Image as ImageIcon,
  LoaderCircle, Paperclip, RotateCcw, ScanEye, Square,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'katex/dist/katex.min.css'
import { apiUrl } from '../lib/api'

const SUGGESTIONS = [
  { label: 'Explain a concept', prompt: 'Explain a difficult concept in clear, simple terms.' },
  { label: 'Help me write', prompt: 'Help me draft a thoughtful, polished message.' },
  { label: 'Explore an idea', prompt: 'Help me think through an idea and its possibilities.' },
]

const WORKSPACES = [
  { id: 'rag', label: 'Ask your documents', detail: 'Search PDFs in your knowledge base', icon: FileText },
  { id: 'agent', label: 'Research the web', detail: 'Run a web-assisted research task', icon: Globe2 },
  { id: 'vision', label: 'Analyze an image', detail: 'Describe a photo or camera frame', icon: ScanEye },
  { id: 'poster', label: 'Create a poster', detail: 'Generate an image from a prompt', icon: ImageIcon },
]

export default function ChatTab({ conversation, onCreateConversation, onConversationUpdate, onNavigate, addToast }) {
  const [messages, setMessages] = useState(conversation?.messages || [])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(null)
  const messagesRef = useRef(messages)
  const conversationIdRef = useRef(conversation?.id || null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const fileRef = useRef(null)
  const abortCtrlRef = useRef(null)

  useEffect(() => {
    conversationIdRef.current = conversation?.id || null
    const nextMessages = conversation?.messages || []
    messagesRef.current = nextMessages
    setMessages(nextMessages)
  }, [conversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const commitMessages = (id, nextMessages) => {
    messagesRef.current = nextMessages
    setMessages(nextMessages)
    if (id) onConversationUpdate(id, nextMessages)
  }

  const sendMessage = async (text, options = {}) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const baseMessages = options.baseMessages ?? messagesRef.current
    const userMessages = options.addUser === false
      ? baseMessages
      : [...baseMessages, { role: 'user', content }]
    let conversationId = conversationIdRef.current
    if (!conversationId) {
      conversationId = onCreateConversation(content, userMessages)
      conversationIdRef.current = conversationId
    }
    const requestMessages = userMessages
    commitMessages(conversationId, [...userMessages, { role: 'assistant', content: '' }])
    setLoading(true)
    abortCtrlRef.current = new AbortController()

    const streamResponse = async () => {
      const res = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: requestMessages }),
        signal: abortCtrlRef.current.signal,
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || `The assistant could not respond (${res.status}).`)
      }

      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await res.json()
        const next = [...userMessages, { role: 'assistant', content: data.error || '' }]
        commitMessages(conversationId, next)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantText = ''
      let doneSignal = false

      const readEvent = eventText => {
        const data = eventText.split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart())
          .join('\n')
        if (!data) return
        if (data.trim() === '[DONE]') { doneSignal = true; return }
        try {
          const event = JSON.parse(data)
          assistantText += event.content || event.delta || ''
        } catch { /* Ignore non-JSON keep-alive events. */ }
      }

      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const events = buffer.split(/\r?\n\r?\n/)
        buffer = events.pop() || ''
        events.forEach(readEvent)
        if (assistantText) {
          commitMessages(conversationId, [...userMessages, { role: 'assistant', content: assistantText }])
        }
        if (done || doneSignal) break
      }
      if (buffer.trim()) readEvent(buffer)
      if (assistantText) commitMessages(conversationId, [...userMessages, { role: 'assistant', content: assistantText }])
    }

    try {
      try {
        await streamResponse()
      } catch (firstError) {
        if (firstError.name === 'AbortError') throw firstError
        console.warn('[Chat] Request failed, retrying once:', firstError.message)
        await new Promise(resolve => window.setTimeout(resolve, 500))
        await streamResponse()
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        const friendlyMessage = error.message || 'Could not reach the assistant. Check that the backend is running.'
        commitMessages(conversationId, [...userMessages, { role: 'assistant', content: friendlyMessage }])
        addToast('The assistant could not respond', 'error')
      }
    } finally {
      setLoading(false)
      abortCtrlRef.current = null
    }
  }

  const regenerate = () => {
    const current = messagesRef.current
    let userIndex = -1
    for (let index = current.length - 1; index >= 0; index -= 1) {
      if (current[index].role === 'user') { userIndex = index; break }
    }
    if (userIndex < 0) return
    const priorMessages = current.slice(0, userIndex + 1)
    const prompt = current[userIndex].content
    commitMessages(conversationIdRef.current, priorMessages)
    sendMessage(prompt, { baseMessages: priorMessages, addUser: false })
  }

  const handleKeyDown = event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  const handleFileUpload = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setAttachMenuOpen(false)
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'docx', 'txt'].includes(extension)) {
      addToast('Choose a PDF, DOCX, or TXT document.', 'error')
      return
    }

    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const response = await fetch(apiUrl('/api/rag/upload'), { method: 'POST', body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Upload failed (${response.status}).`)

      const storedDocs = JSON.parse(localStorage.getItem('gyan-ai-documents') || '[]')
      const nextDocs = [
        { name: file.name, size: file.size, status: 'indexed', uploadedAt: Date.now() },
        ...storedDocs.filter(item => item.name !== file.name),
      ]
      localStorage.setItem('gyan-ai-documents', JSON.stringify(nextDocs))
      addToast(`${file.name} added to your knowledge base`)
      onNavigate('rag')
    } catch (error) {
      addToast(error.message || 'Document upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const copyMessage = async (message, index) => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedMessage(index)
      window.setTimeout(() => setCopiedMessage(null), 1400)
      addToast('Response copied')
    } catch {
      addToast('Could not copy to clipboard', 'error')
    }
  }

  return (
    <section className="chat-workspace workspace-view">
      {messages.length === 0 ? (
        <div className="chat-welcome">
          <p className="eyebrow welcome-eyebrow">A thoughtful space for your work</p>
          <h1>What would you like<br className="welcome-break" /> to work on?</h1>
          <p className="welcome-copy">Ask a question, shape an idea, or get a hand with something you are creating.</p>
          <div className="suggestion-list" aria-label="Suggested prompts">
            {SUGGESTIONS.map(item => (
              <button key={item.label} className="suggestion-button" onClick={() => sendMessage(item.prompt)}>
                <span>{item.label}</span><ChevronRight size={16} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="chat-transcript" aria-live="polite">
          {messages.map((message, index) => (
            <article key={`${index}-${message.role}`} className={`message-row ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}>
              {message.role === 'assistant' && <div className="assistant-mark" aria-hidden="true"><BookIcon /></div>}
              <div className="message-content">
                {message.role === 'user' ? <p className="user-message-text">{message.content}</p> : (
                  <div className="markdown-body">
                    {message.content ? <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex, rehypeHighlight]}
                      components={{
                        pre({ children, ...props }) {
                          const codeElement = Array.isArray(children) ? children[0] : children
                          const codeClass = codeElement?.props?.className || ''
                          const language = /language-(\w+)/.exec(codeClass)?.[1] || 'Code'
                          const codeText = String(codeElement?.props?.children ?? '').replace(/\n$/, '')
                          return <div className="code-block-wrapper">
                            <div className="code-block-header"><span>{language}</span><button onClick={() => { navigator.clipboard.writeText(codeText); addToast('Code copied') }}><Copy size={13} />Copy</button></div>
                            <pre {...props}>{children}</pre>
                          </div>
                        },
                        code({ className, children, ...props }) {
                          const isBlock = /language-|hljs/.test(className || '')
                          return <code className={isBlock ? className : `inline-code ${className || ''}`} {...props}>{children}</code>
                        },
                      }}
                    >{message.content}</ReactMarkdown> : <span className="streaming-dots"><i /><i /><i /></span>}
                  </div>
                )}
                {message.role === 'assistant' && message.content && !loading && (
                  <div className="message-actions">
                    <button className="text-action" onClick={() => copyMessage(message, index)} aria-label="Copy response">
                      {copiedMessage === index ? <Check size={14} /> : <Copy size={14} />}{copiedMessage === index ? 'Copied' : 'Copy'}
                    </button>
                    {index === messages.length - 1 && <button className="text-action" onClick={regenerate} aria-label="Regenerate response"><RotateCcw size={14} />Regenerate</button>}
                  </div>
                )}
              </div>
            </article>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="composer-wrap">
        <div className={`chat-composer ${loading ? 'is-generating' : ''}`}>
          <textarea
            ref={textareaRef}
            className="composer-input"
            aria-label="Message Gyan AI"
            placeholder="Message Gyan AI…"
            value={input}
            rows={1}
            onChange={event => {
              setInput(event.target.value)
              event.target.style.height = 'auto'
              event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`
            }}
            onKeyDown={handleKeyDown}
            disabled={uploading}
          />
          <div className="composer-toolbar">
            <div className="composer-tools">
              <div className="attach-wrap">
                <button className="composer-tool-button" onClick={() => setAttachMenuOpen(open => !open)} aria-label="Add a file or choose a workspace" aria-expanded={attachMenuOpen}>
                  {uploading ? <LoaderCircle size={17} className="spin-icon" /> : <Paperclip size={17} />}<span>{uploading ? 'Uploading PDF' : 'Add'}</span>
                </button>
                {attachMenuOpen && <>
                  <button className="menu-dismiss" aria-label="Close add menu" onClick={() => setAttachMenuOpen(false)} />
                  <div className="composer-menu">
                    <button onClick={() => fileRef.current?.click()}><FileText size={17} /><span><b>Upload a document</b><small>PDF, DOCX, or TXT · index it for questions</small></span></button>
                    {WORKSPACES.slice(1).map(({ id, label, detail, icon: Icon }) => <button key={id} onClick={() => { setAttachMenuOpen(false); onNavigate(id) }}><Icon size={17} /><span><b>{label}</b><small>{detail}</small></span></button>)}
                  </div>
                </>}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" hidden onChange={handleFileUpload} />
              <span className="composer-divider" />
              <span className="model-indicator">OpenRouter</span>
            </div>
            <button
              className={`send-button ${loading ? 'stop-button' : ''}`}
              aria-label={loading ? 'Stop response' : 'Send message'}
              title={loading ? 'Stop generating' : 'Send message'}
              disabled={!loading && !input.trim()}
              onClick={() => loading ? abortCtrlRef.current?.abort() : sendMessage()}
            >
              {loading ? <Square size={15} fill="currentColor" /> : <ArrowUp size={18} strokeWidth={2.2} />}
            </button>
          </div>
        </div>
        <p className="composer-hint">Enter to send <span>·</span> Shift + Enter for a new line</p>
      </div>
    </section>
  )
}

function BookIcon() {
  return <BookOpen size={16} strokeWidth={1.9} />
}
