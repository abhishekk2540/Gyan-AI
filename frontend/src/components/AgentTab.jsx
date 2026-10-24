import { useState, useRef, useEffect } from 'react'
import AnimatedTitle from './AnimatedTitle'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const TOOLS = [
  { id: 'calculator', icon: '🧮', label: 'Calculator' },
  { id: 'web_search', icon: '🌐', label: 'Web Search' },
]

const EXAMPLES = [
  'What is 2847 × 963?',
  'Search: Who is the CEO of OpenAI?',
  'Calculate the square root of 144',
  'Search: Latest AI news 2025',
]

export default function AgentTab({ addToast }) {
  const [query, setQuery]   = useState('')
  const [steps, setSteps]   = useState([])
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)

  // Ref to auto-scroll to the answer when it appears
  const answerRef  = useRef(null)
  const scrollArea = useRef(null)

  // Scroll to bottom whenever steps grow or answer arrives
  useEffect(() => {
    if (scrollArea.current) {
      scrollArea.current.scrollTop = scrollArea.current.scrollHeight
    }
  }, [steps, answer])

  const runAgent = async (text) => {
    const q = text || query.trim()
    if (!q || loading) return
    setQuery(text ? text : query)
    setSteps([]); setAnswer(null); setLoading(true)

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      // Animate steps in one by one
      for (let i = 0; i < (data.steps || []).length; i++) {
        await new Promise(r => setTimeout(r, 400))
        setSteps(prev => [...prev, data.steps[i]])
      }
      setAnswer(data.answer)
    } catch {
      setSteps([{ type: 'result', content: '⚠️ Backend not connected. Start your Express server.' }])
      addToast('Backend not connected', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="agent-container">
      {/* Header */}
      <div className="chat-header" style={{ flexShrink: 0 }}>
        <AnimatedTitle title="AI Agent" accentWord="Agent" />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="model-badge">⚡ ReAct Lite</div>
          <button className="clear-btn" onClick={() => { setSteps([]); setAnswer(null); setQuery('') }}>🗑️ Clear</button>
        </div>
      </div>

      {/* Tool pills */}
      <div style={{ flexShrink: 0 }}>
        <div className="section-label">Available Tools</div>
        <div className="tool-pills">
          {TOOLS.map(t => (
            <div key={t.id} className="tool-pill active">
              {t.icon} {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* Input — always visible, pinned above scroll area */}
      <div className="chat-input-area" style={{ flexShrink: 0 }}>
        <textarea
          id="agent-query-input"
          className="chat-input"
          placeholder="Ask the agent something… e.g. What is 42 × 58?"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAgent() } }}
          rows={1}
        />
        <button id="agent-run-btn" className="send-btn" disabled={!query.trim() || loading} onClick={() => runAgent()}>
          {loading ? <span className="spinner" /> : '▶'}
        </button>
      </div>

      {/* ── Scrollable results area ───────────────────────────── */}
      <div className="agent-scroll-area" ref={scrollArea}>

        {/* Examples — only when idle */}
        {steps.length === 0 && !loading && (
          <div>
            <div className="section-label">Try these</div>
            <div className="suggestions">
              {EXAMPLES.map(e => (
                <button key={e} className="suggestion-chip" onClick={() => runAgent(e)}>{e}</button>
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        {(steps.length > 0 || loading) && (
          <div>
            <div className="section-label">Agent Thinking</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {steps.map((s, i) => (
                <div key={i} className="step-card">
                  <div className="step-header">
                    <span className={`step-type ${s.type}`}>
                      {s.type === 'thought' ? '💭 Thought' : s.type === 'tool' ? '🔧 Tool Call' : '✅ Result'}
                    </span>
                    {s.tool && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.tool}</span>}
                  </div>
                  <div className="step-content agent-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                  </div>
                  {s.code && <div className="step-code">{s.code}</div>}
                </div>
              ))}

              {loading && (
                <div className="step-card">
                  <div className="step-header">
                    <span className="step-type thought">💭 Thinking…</span>
                  </div>
                  <div className="typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Final answer — auto-scrolls into view */}
        {answer && (
          <div
            ref={answerRef}
            className="card"
            style={{
              borderColor: 'rgba(16,185,129,0.3)',
              background: 'rgba(16,185,129,0.05)',
              animation: 'fadeUp 0.3s ease'
            }}
          >
            <div className="section-label">Final Answer</div>
            <div className="agent-markdown" style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.7 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
