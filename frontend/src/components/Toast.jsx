export default function Toast({ msg, type }) {
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'
  return (
    <div className={`toast ${type}`}>
      <span>{icon}</span>
      <span>{msg}</span>
    </div>
  )
}
