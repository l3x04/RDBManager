// src/renderer/components/RightPanel/WaveformPanel/BeatgridControls.jsx
import { useAppStore } from '../../../store/appStore.js'

const DEFAULT_ADJ = { bpmOverride: null, gridOffsetMs: 0 }

const btnStyle = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
  fontSize: 11, padding: '3px 7px', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
}

export default function BeatgridControls({ track, zoom, onZoomIn, onZoomOut, scrollMs, durationMs, visibleMs, onScroll }) {
  const adj    = useAppStore(s => s.trackAdjustments[track?.id] ?? DEFAULT_ADJ)
  const setAdj = useAppStore(s => s.setTrackAdjustment)

  if (!track) return null

  const bpm    = adj.bpmOverride ?? track.bpm
  const nudge  = (deltaMs) => setAdj(track.id, { gridOffsetMs: (adj.gridOffsetMs ?? 0) + deltaMs })
  const setBpm = (v) => setAdj(track.id, { bpmOverride: isNaN(v) || v <= 0 ? null : Math.round(v * 10) / 10 })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
        {/* BPM */}
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>BPM</span>
        <button style={btnStyle} onClick={() => setBpm(Math.round((bpm - 0.1) * 10) / 10)}>−</button>
        <input
          type="text"
          value={bpm.toFixed(1)}
          onChange={e => { const v = parseFloat(e.target.value); setBpm(v) }}
          style={{
            width: 52, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '3px 6px', fontSize: 12,
            color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button style={btnStyle} onClick={() => setBpm(Math.round((bpm + 0.1) * 10) / 10)}>+</button>

        {/* Grid nudge */}
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Grid</span>
        {[[-10,'−10ms'], [-1,'−1ms'], [1,'+1ms'], [10,'+10ms']].map(([delta, label]) => (
          <button key={delta} style={btnStyle} onClick={() => nudge(delta)}>{label}</button>
        ))}

        {/* Zoom */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Zoom</span>
          <button style={btnStyle} onClick={onZoomOut} disabled={zoom <= 1}>−</button>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 36, textAlign: 'center' }}>{zoom >= 10 ? zoom.toFixed(0) : zoom.toFixed(1)}×</span>
          <button style={btnStyle} onClick={onZoomIn} disabled={zoom >= 64}>+</button>
        </div>
      </div>

      {/* Scroll slider — only when zoomed in */}
      {zoom > 1 && durationMs > 0 && (
        <div style={{ padding: '0 12px 6px', background: 'var(--bg-panel)' }}>
          <input
            type="range"
            min={0}
            max={Math.max(0, durationMs - visibleMs)}
            step={100}
            value={scrollMs}
            onChange={e => onScroll(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
        </div>
      )}
    </div>
  )
}
