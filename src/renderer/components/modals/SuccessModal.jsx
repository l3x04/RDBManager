// src/renderer/components/modals/SuccessModal.jsx
export default function SuccessModal({ result, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#1c1c1e', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#30d158' }}>✓ Generation Complete</div>
        {[
          ['Tracks processed', result.tracksProcessed],
          ['Cues written', result.cuesWritten],
          ['Tracks skipped', result.tracksSkipped],
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontWeight: 600 }}>{val}</span>
          </div>
        ))}
        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>Output saved to <b>Backup_Output/</b></div>
        <button onClick={onClose} style={{ marginTop: 16, width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '9px', cursor: 'pointer' }}>Done</button>
      </div>
    </div>
  )
}
