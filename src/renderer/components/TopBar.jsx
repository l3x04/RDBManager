// src/renderer/components/TopBar.jsx
export default function TopBar({ onReload }) {
  return (
    <div style={{ height: 48, background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
      <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>RDBManager <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>by L£X</span></span>
      <button onClick={onReload} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: 11, padding: '5px 12px', cursor: 'pointer', fontWeight: 500 }}>
        Refresh from rekordbox
      </button>
    </div>
  )
}
