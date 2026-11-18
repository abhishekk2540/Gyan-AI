import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Check, Image as ImageIcon, LoaderCircle, ScanEye, Sparkles, Upload, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { apiUrl } from '../lib/api'

const MODEL_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js',
]
const DETECTION_COLORS = ['#C66A45', '#43866B', '#AA803D', '#6B836A', '#A76858', '#718173']

export default function VisionTab({ addToast }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const modelRef = useRef(null)
  const animRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)
  const fpsRef = useRef({ count: 0, last: Date.now() })
  const [mode, setMode] = useState('upload')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [prompt, setPrompt] = useState('Describe the important details in this image.')
  const [analysis, setAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [isOn, setIsOn] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const [detections, setDetections] = useState([])
  const [fps, setFps] = useState(0)

  const stopCamera = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setIsOn(false)
    setDetections([])
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  useEffect(() => {
    if (!preview.startsWith('blob:')) return undefined
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const loadModel = async () => {
    if (modelRef.current) return true
    setModelLoading(true)
    try {
      for (const src of MODEL_SCRIPTS) await loadScript(src)
      modelRef.current = await window.cocoSsd.load()
      setModelReady(true)
      return true
    } catch (error) {
      addToast('Could not load the object detection model', 'error')
      return false
    } finally {
      setModelLoading(false)
    }
  }

  const runDetection = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !modelRef.current) return
    const context = canvas.getContext('2d')

    const detect = async () => {
      if (!modelRef.current || !streamRef.current?.active) return
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth || canvas.width || 640
        canvas.height = video.videoHeight || canvas.height || 480
        try {
          const predictions = await modelRef.current.detect(video)
          fpsRef.current.count += 1
          const now = Date.now()
          if (now - fpsRef.current.last >= 1000) {
            setFps(fpsRef.current.count)
            fpsRef.current = { count: 0, last: now }
          }
          context.clearRect(0, 0, canvas.width, canvas.height)
          predictions.forEach((prediction, index) => {
            const [x, y, width, height] = prediction.bbox
            const color = DETECTION_COLORS[index % DETECTION_COLORS.length]
            context.strokeStyle = color
            context.lineWidth = Math.max(2, canvas.width / 640)
            context.strokeRect(x, y, width, height)
            context.font = '600 13px system-ui, sans-serif'
            const label = `${prediction.class} · ${(prediction.score * 100).toFixed(0)}%`
            const labelWidth = context.measureText(label).width + 16
            const labelY = Math.max(0, y - 27)
            context.fillStyle = color
            context.fillRect(x, labelY, labelWidth, 26)
            context.fillStyle = '#fff'
            context.fillText(label, x + 8, labelY + 17)
          })
          setDetections(predictions.slice(0, 10).map(item => ({ label: item.class, score: (item.score * 100).toFixed(0) })))
        } catch {
          // A dropped frame is normal while the camera or model is warming up.
        }
      }
      animRef.current = requestAnimationFrame(detect)
    }
    detect()
  }

  const startCamera = async () => {
    const ready = await loadModel()
    if (!ready) return
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })
      streamRef.current = media
      if (videoRef.current) {
        videoRef.current.srcObject = media
        await videoRef.current.play()
      }
      setIsOn(true)
      window.setTimeout(runDetection, 150)
    } catch (error) {
      addToast(error.name === 'NotAllowedError' ? 'Camera access was not allowed' : 'Could not start the camera', 'error')
    }
  }

  const chooseFile = event => {
    const nextFile = event.target.files?.[0]
    event.target.value = ''
    if (!nextFile) return
    if (!nextFile.type.startsWith('image/')) {
      addToast('Choose an image file to analyze', 'error')
      return
    }
    if (nextFile.size > 6 * 1024 * 1024) {
      addToast('Choose an image smaller than 6 MB', 'error')
      return
    }
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    setFile(nextFile)
    setPreview(URL.createObjectURL(nextFile))
    setAnalysis('')
  }

  const analyzeImage = async () => {
    if (analyzing) return
    setAnalyzing(true)
    setAnalysis('')
    try {
      const base64Image = mode === 'camera' ? await captureCameraFrame() : await imageFileToBase64(file)
      if (!base64Image) throw new Error('Choose an image or start the camera first.')
      const response = await fetch(apiUrl('/api/vision/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, prompt: prompt.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Image analysis failed (${response.status}).`)
      setAnalysis(data.description || 'No description was returned.')
      addToast('Image analysis complete')
    } catch (error) {
      setAnalysis(error.message || 'Could not analyze this image.')
      addToast(error.message || 'Image analysis failed', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const clearImage = () => {
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview('')
    setAnalysis('')
    setDetections([])
  }

  return (
    <section className="vision-workspace workspace-view page-frame">
      <div className="page-heading">
        <div><p className="eyebrow">Image Analysis</p><h1>Look closer</h1><p className="page-description">Upload an image for a focused description, or open your camera for live object detection.</p></div>
        <span className="capability-tag"><ScanEye size={15} />Vision</span>
      </div>

      <div className="vision-mode-switch" role="tablist" aria-label="Image source">
        <button role="tab" aria-selected={mode === 'upload'} className={mode === 'upload' ? 'active' : ''} onClick={() => { stopCamera(); setMode('upload') }}><ImageIcon size={16} />Upload image</button>
        <button role="tab" aria-selected={mode === 'camera'} className={mode === 'camera' ? 'active' : ''} onClick={() => { setMode('camera'); setAnalysis('') }}><Camera size={16} />Live camera</button>
      </div>

      <div className="vision-layout">
        <div className="vision-input-column">
          {mode === 'upload' ? (
            <div className={`image-preview-area ${preview ? 'has-image' : ''}`} onClick={() => !preview && fileInputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const next = event.dataTransfer.files?.[0]; if (next) chooseFile({ target: { files: [next], value: '' } }) }}>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={chooseFile} />
              {preview ? <><img src={preview} alt="Selected image for analysis" />{!analyzing && <button className="preview-remove" onClick={event => { event.stopPropagation(); clearImage() }} aria-label="Remove image"><X size={16} /></button>}</> : <div className="image-upload-prompt"><span className="large-upload-icon"><Upload size={20} /></span><strong>Choose an image to analyze</strong><span>Browse files or drag an image here</span><small>PNG, JPG, WebP · up to 6 MB</small><button onClick={event => { event.stopPropagation(); fileInputRef.current?.click() }}>Select image</button></div>}
            </div>
          ) : (
            <div className={`camera-stage ${isOn ? 'camera-active' : ''}`}>
              <video ref={videoRef} muted playsInline />
              <canvas ref={canvasRef} />
              {!isOn && <div className="camera-placeholder"><Camera size={23} /><strong>Camera is off</strong><span>Start the camera to see live object detection.</span>{modelReady && <small>Detection model ready</small>}</div>}
              {isOn && <div className="camera-live-indicator"><span />Live{fps > 0 ? ` · ${fps} fps` : ''}</div>}
            </div>
          )}

          <label className="vision-prompt-label" htmlFor="vision-prompt">What should I look for?</label>
          <textarea id="vision-prompt" className="vision-prompt" value={prompt} rows={2} onChange={event => setPrompt(event.target.value)} placeholder="Ask for a focused description…" />
          <div className="vision-actions">
            {mode === 'camera' ? <button className={`secondary-button ${isOn ? 'stop-camera-button' : ''}`} onClick={isOn ? stopCamera : startCamera} disabled={modelLoading}>{modelLoading ? <LoaderCircle size={16} className="spin-icon" /> : <Camera size={16} />}{modelLoading ? 'Loading model…' : isOn ? 'Stop camera' : 'Start camera'}</button> : <span className="supported-format"><Check size={14} />Image stays in this session</span>}
            <button className="primary-button" onClick={analyzeImage} disabled={analyzing || (mode === 'upload' ? !file : !isOn)}>{analyzing ? <LoaderCircle size={16} className="spin-icon" /> : <Sparkles size={16} />}{analyzing ? 'Analyzing…' : 'Analyze image'}</button>
          </div>
        </div>

        <div className="vision-result-column">
          <div className="vision-result-panel">
            <div className="result-panel-heading"><span className="result-heading-icon"><Sparkles size={15} /></span><div><h2>Analysis</h2><p>Image understanding</p></div></div>
            <div className="vision-result-body">
              {analyzing ? <div className="analysis-loading"><LoaderCircle size={17} className="spin-icon" /><span>Looking at the image…</span></div> : analysis ? <div className="markdown-body analysis-copy"><ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown></div> : <div className="analysis-empty"><span>Analysis will appear here</span><small>Choose an image and tell Gyan what details matter.</small></div>}
            </div>
          </div>

          {mode === 'camera' && <div className="vision-result-panel detected-panel">
            <div className="result-panel-heading"><span className="result-heading-icon"><ScanEye size={15} /></span><div><h2>Detected objects</h2><p>{detections.length ? `${detections.length} visible` : 'Live camera detection'}</p></div></div>
            {detections.length ? <div className="detection-list">{detections.map((item, index) => <div className="detection-row" key={`${item.label}-${index}`}><span className="detection-dot" style={{ background: DETECTION_COLORS[index % DETECTION_COLORS.length] }} /><span>{item.label}</span><span className="detection-score">{item.score}%</span></div>)}</div> : <p className="detection-empty">Detected objects and confidence scores will show here.</p>}
          </div>}

          <p className="vision-disclaimer">Image descriptions may miss context. Review details that matter.</p>
        </div>
      </div>
    </section>
  )
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing?.dataset.loaded === 'true') { resolve(); return }
    if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); return }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => { script.dataset.loaded = 'true'; resolve() }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function imageFileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(''); return }
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.naturalWidth * scale)
        canvas.height = Math.round(image.naturalHeight * scale)
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1])
      }
      image.onerror = reject
      image.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function captureCameraFrame() {
  return new Promise((resolve, reject) => {
    const video = document.querySelector('.camera-stage video')
    if (!video?.videoWidth) { resolve(''); return }
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    try { resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1]) } catch (error) { reject(error) }
  })
}
