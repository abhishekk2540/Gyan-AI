import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export default function Toast({ msg, type = 'info', onDismiss }) {
  const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? AlertCircle : Info
  return <div className={`toast toast-${type}`} role={type === 'error' ? 'alert' : 'status'}><Icon size={17} /><span>{msg}</span><button aria-label="Dismiss notification" onClick={onDismiss}><X size={14} /></button></div>
}
