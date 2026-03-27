// src/renderer/components/modals/PreflightModal.jsx
export default function PreflightModal({ warnings, onProceed, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#1c1c1e', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 400, maxWidth: '90vw' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Some tracks will be skipped</div>
        <div style={{ marginBottom: 16 }}>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <b style={{ color: '#ff9f0a' }}>{w.missingCount} tracks</b> missing hotcue <b>{w.baseHotcue}</b> ({w.ruleSetName})
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 20 }}>These tracks will be skipped for affected rule sets. All other selected tracks will be processed.</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 12, padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onProceed} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer' }}>Proceed Anyway</button>
        </div>
      </div>
    </div>
  )
}
