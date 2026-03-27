// src/renderer/components/BottomBar.jsx
import { useAppStore } from '../store/appStore.js'
import { buildPreflightWarnings } from '../utils/cueCalc.js'

export default function BottomBar({ onGenerate }) {
  const tracks   = useAppStore(s => s.tracks)
  const selected = useAppStore(s => s.selectedTrackIds)
  const ruleSets = useAppStore(s => s.ruleSets)

  const warnings = buildPreflightWarnings({ selectedTrackIds: selected, tracks, ruleSets })
  const warnMsg = warnings.map(w => `${w.missingCount} missing hotcue ${w.baseHotcue}`).join(', ')

  return (
    <div style={{ height: 52, background: 'var(--bg-panel)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
      <div style={{ flex: 1, fontSize: 11 }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          <b style={{ color: 'var(--text-primary)' }}>{selected.size}</b> of {tracks.length} tracks selected
        </span>
        {warnMsg && <span style={{ marginLeft: 12, color: '#ff9f0a' }}>⚠ {warnMsg}</span>}
      </div>
      <button
        onClick={onGenerate}
        disabled={selected.size === 0 || ruleSets.length === 0}
        style={{
          background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600,
          padding: '8px 20px', borderRadius: 'var(--radius-md)', border: 'none',
          cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
          opacity: selected.size === 0 || ruleSets.length === 0 ? 0.4 : 1,
        }}
      >
        Generate →
      </button>
    </div>
  )
}
