import { useState, useRef, useEffect, useCallback } from 'react'
import AnimatedTitle from './AnimatedTitle'

export default function VisionTab({ addToast }) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const modelRef   = useRef(null)
  const animRef    = useRef(null)
  const streamRef  = useRef(null)

  const [isOn,       setIsOn]       = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [detections, setDetections] = useState([])
  const [fps,        setFps]        = useState(0)
  const fpsRef = useRef({ count: 0, last: Date.now() })

  const [analysis,  setAnalysis]  = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

  // Lazy-load TensorFlow.js + COCO-SSD from CDN
  const loadModel = useCallback(async () => {
    if (modelRef.current) return true
    setLoading(true)
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js')
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js')
      modelRef.current = await window.cocoSsd.load()
      setModelReady(true)
      addToast('COCO-SSD model loaded ✅')
      return true
    } catch (err) {
      addToast('Failed to load model', 'error')
      return false
    } finally {
      setLoading(false)
    }
  }, [addToast])

  const startCamera = async () => {
    const ok = await loadModel()
    if (!ok) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setIsOn(true)
      runDetection()
    } catch {
      addToast('Camera access denied', 'error')
    }
  }

  const stopCamera = () => {
    cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    setIsOn(false)
    setDetections([])
    setAnalysis(null)
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const analyzeFrame = async () => {
    if (!videoRef.current || analyzing) return
    setAnalyzing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(videoRef.current, 0, 0)
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]

      const res = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAnalysis(data.description)
      addToast('Analysis complete!')
    } catch {
      addToast('Failed to analyze frame', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const runDetection = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !modelRef.current) return

    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')

    const detect = async () => {
      if (!modelRef.current || video.paused || video.ended) return
      const preds = await modelRef.current.detect(video)

      // FPS counter
      fpsRef.current.count++
      const now = Date.now()
      if (now - fpsRef.current.last >= 1000) {
        setFps(fpsRef.current.count)
        fpsRef.current = { count: 0, last: now }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      preds.forEach(p => {
        const [x, y, w, h] = p.bbox
        const conf = (p.score * 100).toFixed(0)
        const color = COLORS[p.class] || '#8b5cf6'

        ctx.strokeStyle = color
        ctx.lineWidth   = 2
        ctx.strokeRect(x, y, w, h)

        ctx.fillStyle = color + 'cc'
        ctx.fillRect(x, y - 28, Math.max(w, 120), 28)

        ctx.fillStyle = '#fff'
        ctx.font      = 'bold 13px Inter, sans-serif'
        ctx.fillText(`${p.class}  ${conf}%`, x + 8, y - 10)
      })

      setDetections(preds.slice(0, 10).map(p => ({
        label: p.class,
        conf: (p.score * 100).toFixed(1),
      })))

      animRef.current = requestAnimationFrame(detect)
    }

    detect()
  }

  useEffect(() => () => stopCamera(), [])

  return (
    <div className="vision-container">
      {/* Header */}
      <div className="vision-header">
        <AnimatedTitle title="Vision Detection" accentWord="Detection" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isOn && <div className="model-badge">⚡ {fps} FPS</div>}
          <div className="model-badge">🧠 Multimodal AI</div>
          <button className="clear-btn" onClick={() => { setAnalysis(null); setDetections([]) }}>🗑️ Clear</button>
        </div>
      </div>

      {/* ── 2-Column Layout ─────────────────────────────────── */}
      <div className="vision-layout">

        {/* LEFT — Camera */}
        <div className="vision-left">
          <div className="camera-wrapper">
            <video ref={videoRef} muted playsInline style={{ display: isOn ? 'block' : 'none' }} />
            <canvas ref={canvasRef} style={{ display: isOn ? 'block' : 'none' }} />

            {!isOn && (
              <div className="camera-overlay-off">
                <div className="cam-icon">📷</div>
                <p>Camera is off</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI Visual Analysis · Real-time detection</p>
              </div>
            )}
          </div>

          {/* Controls below camera */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {!isOn ? (
              <button id="start-camera-btn" className="camera-btn start" onClick={startCamera} disabled={loading}>
                {loading ? <><span className="spinner" style={{ marginRight: 8 }} />Loading Model…</> : '▶ Start Camera'}
              </button>
            ) : (
              <>
                <button id="stop-camera-btn" className="camera-btn stop" onClick={stopCamera}>
                  ■ Stop Camera
                </button>
                <button className="btn-primary" onClick={analyzeFrame} disabled={analyzing}>
                  {analyzing ? <><span className="spinner" style={{ marginRight: 8 }} />Analyzing…</> : '📸 Analyze Frame'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* RIGHT — Analysis & Detections */}
        <div className="vision-right">

          {/* AI Analysis Result */}
          <div className="vision-panel">
            <div className="section-label">AI Frame Analysis</div>
            {analyzing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
                <span className="spinner" />Analyzing scene with GPT-4o…
              </div>
            ) : analysis ? (
              <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-primary)', animation: 'fadeUp 0.3s ease' }}>
                {analysis}
              </p>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
                {isOn
                  ? 'Press "Analyze Frame" to get an AI description of the current scene.'
                  : 'Start the camera, then press "Analyze Frame".'}
              </div>
            )}
          </div>

          {/* Detected Objects */}
          <div className="vision-panel" style={{ flex: 1 }}>
            <div className="section-label">
              Detected Objects {detections.length > 0 && `(${detections.length})`}
            </div>
            {detections.length > 0 ? (
              <div className="detections-grid">
                {detections.map((d, i) => (
                  <div key={i} className="detection-tag">
                    <span>{getEmoji(d.label)}</span>
                    <span>{d.label}</span>
                    <span className="detection-conf">{d.conf}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
                {isOn
                  ? 'Point your camera at objects to detect them…'
                  : 'Objects will appear here once camera is active.'}
              </div>
            )}
          </div>

          {/* Stats */}
          {isOn && (
            <div className="vision-panel vision-stats">
              <div className="stat-row">
                <span className="stat-label">FPS</span>
                <span className="stat-value" style={{ color: fps >= 15 ? 'var(--success)' : 'var(--accent3)' }}>{fps}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Objects</span>
                <span className="stat-value">{detections.length}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Model</span>
                <span className="stat-value" style={{ color: 'var(--accent)' }}>COCO-SSD</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Engine</span>
                <span className="stat-value" style={{ color: 'var(--accent2)' }}>TF.js</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper: load a script dynamically
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.async = true
    s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

const COLORS = {
  person: '#8b5cf6', car: '#06b6d4', dog: '#f59e0b', cat: '#10b981',
  chair: '#ec4899', laptop: '#3b82f6', phone: '#f97316', book: '#84cc16',
  bottle: '#a855f7', cup: '#14b8a6',
}

function getEmoji(label) {
  const map = {
    person: '🧑', car: '🚗', dog: '🐕', cat: '🐈', chair: '🪑',
    laptop: '💻', 'cell phone': '📱', book: '📖', bottle: '🍶',
    cup: '☕', bicycle: '🚲', bird: '🐦', horse: '🐴', tv: '📺',
  }
  return map[label] || '📦'
}
