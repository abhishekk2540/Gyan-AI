import { useState } from 'react'
import AnimatedTitle from './AnimatedTitle'
import TypingText from './TypingText'

export default function PosterTab({ addToast }) {
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const generatePoster = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setImageUrl(null)
    
    try {
      const response = await fetch('/api/poster/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Backend error')
      }

      setImageUrl(data.image)
      setLoading(false)
      addToast('Poster ready! ✨')
    } catch (err) {
      console.error('[Poster Error]:', err)
      setLoading(false)
      setError(err.message)
      addToast('Service is busy. Please try again.', 'error')
    }
  }

  const handleDownload = () => {
    if (!imageUrl) return
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `GyanAI_Poster_${Date.now()}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    addToast('Download started! 📥')
  }

  const handleView = () => {
    if (!imageUrl) return
    const newWindow = window.open()
    newWindow.document.write(`
      <html>
        <head><title>Gyan AI - Full View</title></head>
        <body style="margin:0; background:#0a0a0f; display:flex; align-items:center; justify-content:center; height:100vh;">
          <img src="${imageUrl}" style="max-width:95%; max-height:95%; border-radius:12px; box-shadow:0 20px 50px rgba(0,0,0,0.8);">
        </body>
      </html>
    `)
  }

  return (
    <div className="rag-container">
      <div className="chat-header">
        <AnimatedTitle title="Poster Maker" accentWord="Maker" />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="model-badge">🎨 Flux Engine</div>
          <button className="clear-btn" onClick={() => { setPrompt(''); setImageUrl(null); setError(null); }}>🗑️ Clear</button>
        </div>
      </div>
      
      <div className="card" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input 
          type="text" 
          className="chat-input" 
          placeholder="Describe the poster... e.g. 'Cyberpunk samurai in a neon Tokyo street'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') generatePoster() }}
          style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}
        />
        <button className="btn-primary" onClick={generatePoster} disabled={loading || !prompt.trim()} style={{ height: '48px', padding: '0 24px' }}>
          {loading ? <span className="spinner" /> : '🚀 Create'}
        </button>
      </div>

      {error && !loading && (
        <div className="card" style={{ textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', animation: 'fadeUp 0.3s ease' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: 'var(--error)', fontWeight: 600, marginBottom: 8 }}>Service Busy</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{error}</div>
          <button className="btn-primary" onClick={generatePoster} style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}>
            🔁 Retry
          </button>
        </div>
      )}

      {imageUrl && !loading && (
        <div className="card" style={{ textAlign: 'center', animation: 'fadeUp 0.4s ease', background: 'rgba(0,0,0,0.2)' }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Generated Masterpiece</div>
          <img 
            src={imageUrl} 
            alt="Generated Poster" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '300px', 
              borderRadius: '16px', 
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)', 
              border: '1px solid var(--border)'
            }} 
          />
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button onClick={handleView} className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border)' }}>
              🔍 View Full Size
            </button>
            <button className="btn-primary" onClick={handleDownload}>
              📥 Download
            </button>
          </div>
        </div>
      )}

      {!imageUrl && !loading && !error && (
        <div className="empty-state" style={{ marginTop: '40px' }}>
          <div className="big-icon">🎨</div>
          <TypingText
            text="AI Poster Generator"
            className="welcome-title"
            speed={80}
          />
          <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 320, textAlign: 'center', lineHeight: 1.6 }}>
            Enter a detailed prompt above to generate high-quality posters using the <b>Flux.1</b> model.
          </p>
          <div className="suggestions" style={{ marginTop: '20px' }}>
            <button className="suggestion-chip" onClick={() => { setPrompt('Vintage travel poster of Mars with 1950s aesthetic'); }}>🚀 Mars Travel</button>
            <button className="suggestion-chip" onClick={() => { setPrompt('Cyberpunk city skyline with purple and cyan neon lights'); }}>🏙️ Cyberpunk City</button>
            <button className="suggestion-chip" onClick={() => { setPrompt('Minimalist abstract oil painting of a lonely mountain'); }}>🏔️ Abstract Mountain</button>
          </div>
        </div>
      )}

      {loading && (
        <div className="empty-state" style={{ marginTop: '40px' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px', marginBottom: '20px' }} />
          <h3>Generating your poster...</h3>
          <p>The AI is currently painting your masterpiece. This usually takes 10-30 seconds.</p>
        </div>
      )}
    </div>
  )
}
