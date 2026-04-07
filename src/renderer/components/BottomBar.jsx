// src/renderer/components/BottomBar.jsx
import { useAppStore } from '../store/appStore.js'
import { buildPreflightWarnings } from '../utils/cueCalc.js'

export default function BottomBar({ onGenerate, onSaveToRb }) {
  const tracks   = useAppStore(s => s.tracks)
  const selected = useAppStore(s => s.selectedTrackIds)
  const ruleSets = useAppStore(s => s.ruleSets)
  const adjs     = useAppStore(s => s.trackAdjustments)
  const setAdj   = useAppStore(s => s.setTrackAdjustment)

  const warnings = buildPreflightWarnings({ selectedTrackIds: selected, tracks, ruleSets })
  const warnMsg = warnings.map(w => `${w.missingCount} missing hotcue ${w.baseHotcue}`).join(', ')

  const hasChanges = Object.keys(adjs).length > 0 || (selected.size > 0 && ruleSets.length > 0)

  const bulkBpm = (factor) => {
    for (const track of tracks) {
      if (!selected.has(track.id)) continue
      const cur = adjs[track.id]?.bpmOverride ?? track.bpm
      setAdj(track.id, { bpmOverride: Math.round(cur * factor * 10) / 10 })
    }
  }

  const smallBtn = {
    background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600,
    padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
    opacity: selected.size === 0 ? 0.4 : 1,
  }

  return (
    <div style={{ height: 52, background: 'var(--bg-panel)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
      <div style={{ flex: 1, fontSize: 11 }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          <b style={{ color: 'var(--text-primary)' }}>{selected.size}</b> of {tracks.length} tracks selected
        </span>
        {warnMsg && <span style={{ marginLeft: 12, color: '#ff9f0a' }}>⚠ {warnMsg}</span>}
      </div>
      <button onClick={() => bulkBpm(0.5)} disabled={selected.size === 0} style={smallBtn} title="Halve BPM of selected">÷2 BPM</button>
      <button onClick={() => bulkBpm(2)} disabled={selected.size === 0} style={smallBtn} title="Double BPM of selected">×2 BPM</button>
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
        Generate Cues
      </button>
      <button
        onClick={onSaveToRb}
        disabled={!hasChanges}
        style={{
          background: '#30d158', color: '#fff', fontSize: 12, fontWeight: 600,
          padding: '8px 20px', borderRadius: 'var(--radius-md)', border: 'none',
          cursor: hasChanges ? 'pointer' : 'not-allowed',
          opacity: hasChanges ? 1 : 0.4,
        }}
      >
        Save to rekordbox
      </button>
    </div>
  )
}
