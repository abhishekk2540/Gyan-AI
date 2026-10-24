import { useState, useRef, useEffect } from 'react'
import AnimatedTitle from './AnimatedTitle'
import TypingText from './TypingText'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const SUGGESTIONS = [
  'Explain what is a neural network',
  'Write a Python bubble sort',
  'What is RAG in AI?',
  'How does Ollama work locally?',
]

export default function ChatTab({ addToast }) {
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const bottomRef = useRef(null)
  const abortCtrlRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const content = text || input.trim()
    if (!content || loading) return
    setInput('')

    const userMsg = { role: 'user', content }
    const history = [...messages, userMsg]
    setMessages(history)
    setLoading(true)

    abortCtrlRef.current = new AbortController()

    const attemptFetch = async (attempt) => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: abortCtrlRef.current.signal
      })
      if (!res.ok) throw new Error('Backend error')

      // Streaming via ReadableStream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let aiContent = ''

      if (attempt === 1) {
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const json = JSON.parse(data)
            const delta = json.delta || json.content || ''
            aiContent += delta
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: aiContent }
              return updated
            })
          } catch { /* non-json chunk */ }
        }
      }
    }

    try {
      try {
        await attemptFetch(1)
      } catch (firstErr) {
        if (firstErr.name === 'AbortError') throw firstErr
        // Silent retry — proxy may have needed a warm-up
        console.warn('[Chat] First attempt failed, retrying…', firstErr.message)
        await new Promise(r => setTimeout(r, 600))
        await attemptFetch(2)
      }
    } catch (err) {
      if (err.name === 'AbortError') return // Silent exit if stopped manually

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Could not reach the backend. Make sure your Express server is running on port 3001 and OpenRouter is reachable.'
      }])
      addToast('Backend not connected', 'error')
    } finally {
      setLoading(false)
    }
  }


  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <AnimatedTitle title="AI Chat" accentWord="Chat" />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="model-badge">🌐 OpenRouter</div>
          <button className="clear-btn" onClick={() => setMessages([])}>🗑️ Clear</button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="chat-empty-hero">
            <div className="hero-line from-left">
              <span className="hero-accent">Gyan AI</span> — Your intelligent companion
            </div>
            <div className="hero-line from-right">
              Ask anything. Learn everything.
            </div>
            <div className="hero-line from-left">
              Powered by <span className="hero-accent">OpenRouter</span> &amp; local models
            </div>
            <div className="hero-line from-right">
              Summarize · Generate · Analyze · Create
            </div>
            <div className="hero-line from-left">
              Type below to begin your <span className="hero-accent">conversation</span>
            </div>
          </div>

        ) : (
          messages.map((m, i) => (
            <div key={i} className={`message ${m.role === 'user' ? 'user' : ''}`}>
              <div className={`avatar ${m.role === 'user' ? 'user' : 'ai'}`}>
                {m.role === 'user' ? '👤' : '🧠'}
              </div>
              <div className={`bubble ${m.role === 'user' ? 'user' : 'ai'}`}>
                {m.role === 'user' ? (
                  m.content
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      // Custom code block rendering with copy button
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        if (!inline && match) {
                          return (
                            <div className="code-block-wrapper">
                              <div className="code-block-header">
                                <span className="code-lang">{match[1]}</span>
                                <button
                                  className="code-copy-btn"
                                  onClick={() => {
                                    navigator.clipboard.writeText(String(children).replace(/\n$/, ''))
                                    addToast('Copied to clipboard!', 'success')
                                  }}
                                >
                                  📋 Copy
                                </button>
                              </div>
                              <pre className={className} {...props}>
                                <code>{children}</code>
                              </pre>
                            </div>
                          )
                        }
                        return (
                          <code className={`inline-code ${className || ''}`} {...props}>
                            {children}
                          </code>
                        )
                      },
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="message">
            <div className="avatar ai">🧠</div>
            <div className="bubble ai">
              <div className="typing-indicator">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          id="chat-input"
          className="chat-input"
          placeholder="Send a message… (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
        />
        {loading ? (
          <button
            id="stop-btn"
            className="send-btn"
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--error)' }}
            onClick={() => abortCtrlRef.current?.abort()}
            title="Stop generating"
          >
            ■
          </button>
        ) : (
          <button
            id="send-btn"
            className="send-btn"
            disabled={!input.trim()}
            onClick={() => sendMessage()}
          >
            ➤
          </button>
        )}
      </div>
    </div>
  )
}
