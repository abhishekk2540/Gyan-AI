import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen, ChevronDown, FileText, Globe2, Image as ImageIcon, Menu,
  MessageSquare, Moon, PanelLeftClose, Plus, ScanEye, Search, Settings,
  Sun, UserRound, X,
} from 'lucide-react'
import ChatTab from './components/ChatTab'
import RagTab from './components/RagTab'
import AgentTab from './components/AgentTab'
import VisionTab from './components/VisionTab'
import PosterTab from './components/PosterTab'
import Toast from './components/Toast'

const NAV_ITEMS = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'rag', label: 'Knowledge Base', icon: FileText },
  { id: 'agent', label: 'Web Research', icon: Globe2 },
  { id: 'vision', label: 'Image Analysis', icon: ScanEye },
  { id: 'poster', label: 'Poster Studio', icon: ImageIcon },
]

const CONVERSATIONS_KEY = 'gyan-ai-conversations'
const THEME_KEY = 'gyan-ai-theme'

function readConversations() {
  try {
    const value = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function titleFromMessage(text) {
  const firstLine = text.trim().split('\n')[0]
  return firstLine.length > 42 ? `${firstLine.slice(0, 42).trimEnd()}…` : firstLine || 'New conversation'
}

export default function App() {
  const [active, setActive] = useState('chat')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [conversations, setConversations] = useState(readConversations)
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
  }, [conversations])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  const currentConversation = conversations.find(item => item.id === activeConversationId) || null
  const visibleConversations = useMemo(() => conversations
    .filter(item => item.title.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12), [conversations, search])

  const addToast = (msg, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(items => [...items, { id, msg, type }])
    window.setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 3600)
  }

  const createConversation = (firstMessage, messages) => {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}`
    const conversation = {
      id,
      title: titleFromMessage(firstMessage),
      updatedAt: Date.now(),
      messages,
    }
    setConversations(items => [conversation, ...items])
    setActiveConversationId(id)
    return id
  }

  const updateConversation = (id, messages) => {
    setConversations(items => items.map(item => item.id === id
      ? { ...item, messages, updatedAt: Date.now() }
      : item))
  }

  const startNewChat = () => {
    setActive('chat')
    setActiveConversationId(null)
    setMobileMenuOpen(false)
  }

  const selectWorkspace = id => {
    setActive(id)
    setMobileMenuOpen(false)
  }

  const activeItem = NAV_ITEMS.find(item => item.id === active)

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      {mobileMenuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />}

      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand-row">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><BookOpen size={19} strokeWidth={1.8} /></div>
            <div className="brand-copy"><span className="brand-name">Gyan</span><span className="brand-caption">AI workspace</span></div>
          </div>
          <button className="icon-button sidebar-collapse" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <PanelLeftClose size={17} />
          </button>
          <button className="icon-button mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <button className="new-chat-button" onClick={startNewChat} title="Start a new conversation">
          <Plus size={17} strokeWidth={2} /><span>New chat</span>
        </button>

        <label className="sidebar-search">
          <Search size={16} />
          <input aria-label="Search conversations" placeholder="Search conversations" value={search} onChange={event => setSearch(event.target.value)} />
          {search && <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Clear search"><X size={13} /></button>}
        </label>

        <div className="sidebar-scroll">
          <div className="sidebar-section-label">Workspace</div>
          <nav className="workspace-nav">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => selectWorkspace(id)} title={collapsed ? label : undefined}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="recent-heading"><span className="sidebar-section-label">Recent</span><ChevronDown size={14} /></div>
          <div className="recent-list">
            {visibleConversations.length ? visibleConversations.map(item => (
              <button key={item.id} className={`recent-item ${active === 'chat' && activeConversationId === item.id ? 'active' : ''}`} onClick={() => { setActive('chat'); setActiveConversationId(item.id); setMobileMenuOpen(false) }} title={collapsed ? item.title : undefined}>
                <MessageSquare size={15} strokeWidth={1.8} /><span>{item.title}</span>
              </button>
            )) : <p className="recent-empty">{search ? 'No matching conversations' : 'Your conversations will appear here'}</p>}
          </div>
        </div>

        <div className="sidebar-bottom">
          <button className={`nav-item settings-item ${active === 'settings' ? 'active' : ''}`} onClick={() => selectWorkspace('settings')} title={collapsed ? 'Settings' : undefined}>
            <Settings size={18} strokeWidth={1.8} /><span>Settings</span>
          </button>
          <div className="profile-row">
            <div className="profile-avatar"><UserRound size={17} /></div>
            <div className="profile-copy"><span>Local workspace</span><small>Personal</small></div>
            <ChevronDown size={15} className="profile-chevron" />
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button desktop-menu-toggle" onClick={() => setCollapsed(value => !value)} aria-label="Toggle sidebar"><PanelLeftClose size={18} /></button>
          <button className="icon-button mobile-menu-toggle" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="topbar-context"><span className="topbar-kicker">Gyan AI</span><span className="topbar-divider">/</span><span className="topbar-current">{activeItem?.label || 'Settings'}</span></div>
          <div className="topbar-right">
            <span className="connection-state"><Globe2 size={14} />OpenRouter</span>
            <button className="icon-button topbar-theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title="Toggle theme">
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </header>

        <div className="workspace-content" key={active}>
          {active === 'chat' && <ChatTab
            conversation={currentConversation}
            onCreateConversation={createConversation}
            onConversationUpdate={updateConversation}
            onNavigate={selectWorkspace}
            addToast={addToast}
          />}
          {active === 'rag' && <RagTab addToast={addToast} />}
          {active === 'agent' && <AgentTab addToast={addToast} />}
          {active === 'vision' && <VisionTab addToast={addToast} />}
          {active === 'poster' && <PosterTab addToast={addToast} />}
          {active === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} />}
        </div>
      </main>

      <div className="toast-container" aria-live="polite">
        {toasts.map(item => <Toast key={item.id} msg={item.msg} type={item.type} onDismiss={() => setToasts(items => items.filter(toast => toast.id !== item.id))} />)}
      </div>
    </div>
  )
}

function SettingsPage({ theme, setTheme }) {
  return (
    <section className="settings-page page-frame">
      <div className="page-heading">
        <div><p className="eyebrow">Preferences</p><h1>Settings</h1><p className="page-description">Adjust the appearance of your Gyan AI workspace.</p></div>
      </div>
      <div className="settings-group">
        <div className="settings-group-heading"><div><h2>Appearance</h2><p>Choose a theme that feels comfortable to work in.</p></div></div>
        <div className="theme-options">
          <button className={`theme-option ${theme === 'light' ? 'selected' : ''}`} onClick={() => setTheme('light')}>
            <div className="theme-preview light-preview"><div /><span /><span /></div><span className="theme-option-label"><Sun size={16} />Light</span>
          </button>
          <button className={`theme-option ${theme === 'dark' ? 'selected' : ''}`} onClick={() => setTheme('dark')}>
            <div className="theme-preview dark-preview"><div /><span /><span /></div><span className="theme-option-label"><Moon size={16} />Dark</span>
          </button>
        </div>
      </div>
      <div className="settings-note"><UserRound size={17} /><span>This workspace stores conversation history in this browser.</span></div>
    </section>
  )
}
