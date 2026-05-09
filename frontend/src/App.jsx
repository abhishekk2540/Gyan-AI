import { useState, useEffect } from 'react'
import LandingPage from './components/LandingPage'
import ChatTab from './components/ChatTab'
import RagTab from './components/RagTab'
import AgentTab from './components/AgentTab'
import VisionTab from './components/VisionTab'
import PosterTab from './components/PosterTab'
import Toast from './components/Toast'

const TABS = [
  { id: 'chat',   icon: '💬', label: 'Chat' },
  { id: 'rag',    icon: '📚', label: 'Ask Docs' },
  { id: 'agent',  icon: '🤖', label: 'Agent' },
  { id: 'vision', icon: '👁️',  label: 'Vision' },
  { id: 'poster', icon: '🎨', label: 'Poster' },
]

export default function App() {
  const [showDashboard, setShowDashboard] = useState(false)
  const [active, setActive] = useState('chat')
  const [toasts, setToasts] = useState([])
  const [theme, setTheme] = useState('dark')

  const addToast = (msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }

  // Update root class when theme changes
  useEffect(() => {
    document.documentElement.className = theme === 'light' ? 'light-theme' : ''
  }, [theme])

  if (!showDashboard) {
    return <LandingPage onGetStarted={() => setShowDashboard(true)} />
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Gyan AI" />
        </div>

        <div className="nav-group">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-btn ${active === tab.id ? 'active' : ''}`}
              onClick={() => setActive(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          {/* Theme Toggle */}
          <div className="theme-toggle">
            <button 
              className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} 
              onClick={() => setTheme('dark')}
            >
              🌙
            </button>
            <button 
              className={`theme-btn ${theme === 'light' ? 'active' : ''}`} 
              onClick={() => setTheme('light')}
            >
              ☀️
            </button>
          </div>

          <div className="status-dot">
            <div className="dot" />
            OpenRouter · Nemotron-4
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="main">
        <div className="tab-content">
          {active === 'chat'   && <ChatTab  addToast={addToast} />}
          {active === 'rag'    && <RagTab   addToast={addToast} />}
          {active === 'agent'  && <AgentTab addToast={addToast} />}
          {active === 'vision' && <VisionTab addToast={addToast} />}
          {active === 'poster' && <PosterTab addToast={addToast} />}
        </div>
      </main>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} />)}
      </div>
    </div>
  )
}
