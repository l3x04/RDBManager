// src/renderer/components/RightPanel/WaveformPanel/BeatgridControls.jsx
import { useState, useEffect } from 'react'
import { useAppStore } from '../../../store/appStore.js'

const DEFAULT_ADJ = { bpmOverride: null, gridOffsetMs: 0 }

const btnStyle = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
  fontSize: 11, padding: '3px 7px', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
}

function PositionBar({ scrollMs, durationMs, visibleMs, onScroll }) {
  if (!durationMs) return null
  const frac   = scrollMs / durationMs
  const thumbW = Math.max(0.03, visibleMs / durationMs)

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    seek(e)
  }
  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const f    = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onScroll(Math.max(0, Math.min(f * durationMs - visibleMs / 2, durationMs - visibleMs)))
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={e => { if (e.buttons === 1) seek(e) }}
      style={{
        height: 4, background: 'rgba(255,255,255,0.07)', cursor: 'pointer',
        margin: '0 12px 7px', borderRadius: 2, position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute',
        left: `${frac * 100}%`,
        width: `${thumbW * 100}%`,
        top: 0, bottom: 0,
        background: 'rgba(10,132,255,0.75)',
        borderRadius: 2,
      }} />
    </div>
  )
}

export default function BeatgridControls({
  track, zoom, onZoomIn, onZoomOut,
  scrollMs, durationMs, visibleMs, onScroll,
  isPlaying, onPlayPause, hasAudio,
}) {
  const adj    = useAppStore(s => s.trackAdjustments[track?.id] ?? DEFAULT_ADJ)
  const setAdj = useAppStore(s => s.setTrackAdjustment)

  const bpm = adj.bpmOverride ?? (track?.bpm ?? 0)
  const [bpmText, setBpmText] = useState(bpm.toFixed(1))
  useEffect(() => { setBpmText(bpm.toFixed(1)) }, [bpm])

  if (!track) return null

  const nudge  = (deltaMs) => setAdj(track.id, { gridOffsetMs: (adj.gridOffsetMs ?? 0) + deltaMs })
  const commitBpm = (v) => setAdj(track.id, { bpmOverride: isNaN(v) || v <= 0 ? null : Math.round(v * 10) / 10 })
  const setBpmFromButtons = (v) => { commitBpm(v); setBpmText(v.toFixed(1)) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg-panel)' }}>

        {/* Play / Pause */}
        <button
          style={{ ...btnStyle, fontSize: 13, padding: '2px 9px', opacity: hasAudio ? 1 : 0.35 }}
          onClick={onPlayPause}
          disabled={!hasAudio}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* BPM */}
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginLeft: 4 }}>BPM</span>
        <button style={btnStyle} onClick={() => setBpmFromButtons(Math.round((bpm - 0.1) * 10) / 10)}>−</button>
        <input
          type="text"
          value={bpmText}
          onChange={e => setBpmText(e.target.value)}
          onBlur={() => commitBpm(parseFloat(bpmText))}
          onKeyDown={e => { if (e.key === 'Enter') { commitBpm(parseFloat(bpmText)); e.target.blur() } }}
          style={{
            width: 52, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '3px 6px', fontSize: 12,
            color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button style={btnStyle} onClick={() => setBpmFromButtons(Math.round((bpm + 0.1) * 10) / 10)}>+</button>
        <button style={btnStyle} onClick={() => setBpmFromButtons(Math.round(bpm / 2 * 10) / 10)} title="Halve BPM">÷2</button>
        <button style={btnStyle} onClick={() => setBpmFromButtons(Math.round(bpm * 2 * 10) / 10)} title="Double BPM">×2</button>

        {/* Grid nudge */}
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Grid</span>
        {[[-10,'−10ms'], [-1,'−1ms'], [1,'+1ms'], [10,'+10ms']].map(([delta, label]) => (
          <button key={delta} style={btnStyle} onClick={() => nudge(delta)}>{label}</button>
        ))}

        {/* Zoom */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Zoom</span>
          <button style={btnStyle} onClick={onZoomOut} disabled={zoom <= 1}>−</button>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 36, textAlign: 'center' }}>
            {zoom >= 10 ? zoom.toFixed(0) : zoom.toFixed(1)}×
          </span>
          <button style={btnStyle} onClick={onZoomIn} disabled={zoom >= 128}>+</button>
        </div>
      </div>

      {/* Position bar — always visible, thin clean track indicator */}
      <div style={{ background: 'var(--bg-panel)', paddingTop: 2 }}>
        <PositionBar scrollMs={scrollMs} durationMs={durationMs} visibleMs={visibleMs} onScroll={onScroll} />
      </div>
    </div>
  )
}
