import { useState } from 'react'
import { ArrowDownToLine, ArrowUp, ArrowUpRight, Image as ImageIcon, LoaderCircle, RotateCcw, Sparkles, WandSparkles } from 'lucide-react'
import { apiUrl } from '../lib/api'

const PROMPT_IDEAS = [
  { label: 'Travel print', prompt: 'A vintage travel poster for a quiet coastal town, hand-painted lettering, sun-faded colors, editorial composition' },
  { label: 'Botanical study', prompt: 'A botanical illustration of a wildflower meadow, fine ink outlines, soft natural pigments, archival paper' },
  { label: 'Modern abstract', prompt: 'An abstract composition inspired by folded paper and warm afternoon light, restrained palette, tactile texture' },
]

export default function PosterTab({ addToast }) {
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generatePoster = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError('')
    setImageUrl('')
    try {
      const response = await fetch(apiUrl('/api/poster/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Poster generation failed (${response.status}).`)
      if (!data.image) throw new Error('The image service returned no poster.')
      setImageUrl(data.image)
      addToast('Your poster is ready')
    } catch (generationError) {
      setError(generationError.message || 'Could not generate the poster. Please try again.')
      addToast(generationError.message || 'Poster generation failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const downloadPoster = () => {
    if (!imageUrl) return
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `gyan-poster-${Date.now()}.jpg`
    link.target = '_blank'
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <section className="poster-workspace workspace-view page-frame">
      <div className="page-heading">
        <div><p className="eyebrow">Poster Studio</p><h1>Make something visual</h1><p className="page-description">Describe the image you have in mind. Refine your prompt and generate another variation whenever you like.</p></div>
      </div>

      <div className="poster-workspace-grid">
        <div className="poster-prompt-column">
          <div className="poster-prompt-panel">
            <label htmlFor="poster-prompt" className="field-label">Your prompt</label>
            <textarea id="poster-prompt" className="poster-prompt-input" value={prompt} rows={6} maxLength={1200} placeholder="A quiet seaside bookshop at dusk, drawn as a vintage travel print…" onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') generatePoster() }} />
            <div className="prompt-footer"><span>{prompt.length}/1200</span><span>Describe subject, mood, style, and composition.</span></div>
            <button className="primary-button poster-generate-button" onClick={generatePoster} disabled={!prompt.trim() || loading}>{loading ? <LoaderCircle size={16} className="spin-icon" /> : <WandSparkles size={16} />}{loading ? 'Creating poster…' : 'Generate poster'}<ArrowUp size={15} className="generate-arrow" /></button>
            {error && <div className="poster-error"><span>{error}</span><button onClick={generatePoster} disabled={loading}><RotateCcw size={14} />Try again</button></div>}
          </div>
          <div className="prompt-ideas">
            <div className="ideas-heading"><Sparkles size={15} /><span>Prompt ideas</span></div>
            {PROMPT_IDEAS.map(idea => <button key={idea.label} onClick={() => { setPrompt(idea.prompt); setError('') }}><span>{idea.label}</span><ArrowUpRight size={14} className="idea-arrow" /></button>)}
          </div>
        </div>

        <div className="poster-preview-column">
          <div className="poster-preview-heading"><span>Preview</span>{imageUrl && <button className="quiet-button" onClick={downloadPoster}><ArrowDownToLine size={15} />Download</button>}</div>
          <div className={`poster-canvas ${imageUrl ? 'has-poster' : ''}`}>
            {imageUrl ? <img src={imageUrl} alt="AI generated poster" /> : loading ? <div className="poster-loading"><span className="poster-loading-art"><ImageIcon size={24} /></span><LoaderCircle size={19} className="spin-icon" /><span>Creating your image</span><small>This can take a moment.</small></div> : <div className="poster-empty"><span className="poster-empty-icon"><ImageIcon size={22} /></span><h2>Your poster will appear here</h2><p>Start with a prompt, then shape another variation to explore a different direction.</p></div>}
          </div>
          {imageUrl && <div className="poster-result-footer"><span><ImageIcon size={14} />Generated image</span><button className="text-action" onClick={generatePoster} disabled={loading}><RotateCcw size={14} />Generate another</button></div>}
        </div>
      </div>
    </section>
  )
}
