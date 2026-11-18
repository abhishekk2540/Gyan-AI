import { useRef, useState } from 'react'
import { Calculator, Check, Globe2, LoaderCircle, ArrowUp, RotateCcw, Search } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { apiUrl } from '../lib/api'

const EXAMPLES = [
  'Compare two approaches to learning a new language',
  'What are the latest developments in renewable energy?',
  'Calculate the monthly payment on a $24,000 loan at 6% for 5 years',
]

export default function AgentTab({ addToast }) {
  const [query, setQuery] = useState('')
  const [steps, setSteps] = useState([])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const answerRef = useRef(null)

  const runAgent = async text => {
    const task = (text ?? query).trim()
    if (!task || loading) return
    setQuery(task)
    setSteps([])
    setAnswer('')
    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/agent/run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: task }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Research failed (${response.status}).`)

      const returnedSteps = data.steps || []
      for (let index = 0; index < returnedSteps.length; index += 1) {
        await new Promise(resolve => window.setTimeout(resolve, 320))
        setSteps(previous => [...previous, returnedSteps[index]])
      }
      setAnswer(data.answer || 'The agent did not return a final answer.')
      window.setTimeout(() => answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
    } catch (error) {
      setSteps([{ type: 'result', content: error.message || 'The research service could not be reached.' }])
      addToast(error.message || 'Web research failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { if (!loading) { setQuery(''); setSteps([]); setAnswer('') } }

  return (
    <section className="agent-workspace workspace-view page-frame">
      <div className="page-heading agent-heading">
        <div><p className="eyebrow">Web Research</p><h1>Give a question some room</h1><p className="page-description">The research agent can search the web, use a calculator, and bring its findings together.</p></div>
        {(steps.length > 0 || answer) && <button className="quiet-button" onClick={reset} disabled={loading}><RotateCcw size={15} />New task</button>}
      </div>

      <div className="agent-tool-row">
        <span className="tool-row-label">Available tools</span>
        <span className="tool-chip"><Globe2 size={15} />Web search</span>
        <span className="tool-chip"><Calculator size={15} />Calculator</span>
        <span className="tool-row-note">The agent decides when a tool is useful.</span>
      </div>

      <div className="agent-request-card">
        <textarea className="agent-input" value={query} rows={2} placeholder="Describe what you would like to research…" onChange={event => { setQuery(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px` }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); runAgent() } }} disabled={loading} />
        <div className="agent-request-footer"><span>Clear, specific tasks tend to produce the best results.</span><button className="send-button" onClick={() => runAgent()} disabled={!query.trim() || loading} aria-label="Run research task">{loading ? <LoaderCircle size={17} className="spin-icon" /> : <ArrowUp size={18} />}</button></div>
      </div>

      <div className="agent-results">
        {!steps.length && !answer && !loading ? (
          <div className="research-start"><div className="research-start-heading"><Search size={16} /><span>Ideas to get started</span></div><div className="research-examples">{EXAMPLES.map(example => <button key={example} onClick={() => runAgent(example)}>{example}<ArrowUp size={14} /></button>)}</div></div>
        ) : (
          <div className="research-report">
            {(steps.length > 0 || loading) && <div className="report-section-heading"><span>Research activity</span>{loading && <span className="running-label"><LoaderCircle size={13} className="spin-icon" />Working</span>}</div>}
            <div className="research-timeline">
              {steps.map((step, index) => {
                const StepIcon = step.type === 'tool' ? Globe2 : step.type === 'result' ? Check : Search
                const title = step.type === 'tool' ? (step.tool || 'Tool call') : step.type === 'result' ? 'Result' : 'Reasoning'
                return <article key={index} className={`timeline-step ${step.type}`}>
                  <div className="timeline-marker"><StepIcon size={15} /></div>
                  <div className={`timeline-content ${step.type === 'result' ? 'timeline-output-box' : ''}`}><div className="timeline-title">{title}</div><div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{step.content}</ReactMarkdown></div>{step.code && <pre className="timeline-code">{step.code}</pre>}</div>
                </article>
              })}
              {loading && <div className="timeline-step pending"><div className="timeline-marker"><LoaderCircle size={15} className="spin-icon" /></div><div className="timeline-content"><div className="timeline-title">Working through the task</div><div className="pending-line" /></div></div>}
            </div>
            {answer && <article className="research-answer" ref={answerRef}><div className="answer-label">Summary</div><div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown></div></article>}
          </div>
        )}
      </div>
    </section>
  )
}
