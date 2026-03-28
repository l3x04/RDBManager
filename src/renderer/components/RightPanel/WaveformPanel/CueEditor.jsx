// src/renderer/components/RightPanel/WaveformPanel/CueEditor.jsx
import { useAppStore } from '../../../store/appStore.js'
// eslint-disable-next-line no-unused-vars
import { RB_COLOURS } from '../../../utils/colours.js'
import { formatDuration } from '../../../utils/colours.js'

const SLOTS = ['A','B','C','D','E','F','G','H']

const btnStyle = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
  fontSize: 11, padding: '3px 7px', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
}

function ColourSwatch({ colour, onClick }) {
  return (
    <div
      onClick={onClick}
      title="Click to cycle colour"
      style={{
        width: 14, height: 14, borderRadius: 3, background: colour,
        cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0,
      }}
    />
  )
}

function formatMs(ms) {
  const s = ms / 1000
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

export default function CueEditor({ track, playheadMs }) {
  const setCueOverrides = useAppStore(s => s.setCueOverrides)
  const ensureCueOverrides = useAppStore(s => s.ensureCueOverrides)
  const getCuesForTrack = useAppStore(s => s.getCuesForTrack)

  if (!track) return null

  const cues = getCuesForTrack(track.id)
  const hotcues = cues.hotcues ?? []
  const memoryCues = cues.memoryCues ?? []

  const cycleColour = (currentColour) => {
    const idx = RB_COLOURS.indexOf(currentColour)
    return RB_COLOURS[(idx + 1) % RB_COLOURS.length]
  }

  const updateHotcue = (index, patch) => {
    const current = { ...ensureCueOverrides(track.id) }
    const updated = current.hotcues.map((h, i) => i === index ? { ...h, ...patch } : h)
    setCueOverrides(track.id, { ...current, hotcues: updated })
  }

  const updateMemoryCue = (index, patch) => {
    const current = { ...ensureCueOverrides(track.id) }
    const updated = current.memoryCues.map((m, i) => i === index ? { ...m, ...patch } : m)
    setCueOverrides(track.id, { ...current, memoryCues: updated })
  }

  const deleteHotcue = (index) => {
    const current = { ...ensureCueOverrides(track.id) }
    setCueOverrides(track.id, { ...current, hotcues: current.hotcues.filter((_, i) => i !== index) })
  }

  const deleteMemoryCue = (index) => {
    const current = { ...ensureCueOverrides(track.id) }
    setCueOverrides(track.id, { ...current, memoryCues: current.memoryCues.filter((_, i) => i !== index) })
  }

  const addHotcue = () => {
    const current = { ...ensureCueOverrides(track.id) }
    const usedSlots = new Set(current.hotcues.map(h => h.slot))
    const freeSlot = SLOTS.find(s => !usedSlots.has(s)) ?? 'A'
    const updated = { ...current, hotcues: [...current.hotcues, {
      slot: freeSlot, positionMs: playheadMs ?? 0, colour: RB_COLOURS[0],
    }]}
    console.log('[cue] addHotcue trackId:', track.id, 'type:', typeof track.id, 'hotcues:', updated.hotcues.length)
    setCueOverrides(track.id, updated)
    console.log('[cue] store after set:', Object.keys(useAppStore.getState().cueOverrides))
  }

  const addMemoryCue = () => {
    const current = { ...ensureCueOverrides(track.id) }
    setCueOverrides(track.id, { ...current, memoryCues: [...current.memoryCues, {
      positionMs: playheadMs ?? 0, colour: '#ffd60a',
    }]})
  }

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 8px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cues</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button style={btnStyle} onClick={addHotcue} disabled={hotcues.length >= 8}>+ Hotcue</button>
          <button style={btnStyle} onClick={addMemoryCue}>+ Memory</button>
        </div>
      </div>

      <div style={{ maxHeight: 168, overflowY: 'auto', overflowX: 'hidden' }}>
        {hotcues.map((hc, i) => (
          <div key={`hc-${i}`} style={rowStyle}>
            <ColourSwatch colour={hc.colour ?? RB_COLOURS[0]} onClick={() => updateHotcue(i, { colour: cycleColour(hc.colour ?? RB_COLOURS[0]) })} />
            <select
              value={hc.slot}
              onChange={e => updateHotcue(i, { slot: e.target.value })}
              style={{
                background: '#1c1c1e', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: '#f5f5f7',
                fontSize: 11, padding: '1px 2px', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', width: 32,
              }}
            >
              {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 52, fontVariantNumeric: 'tabular-nums' }}>
              {formatMs(hc.positionMs)}
            </span>
            <button
              style={{ ...btnStyle, padding: '1px 6px', fontSize: 10 }}
              onClick={() => updateHotcue(i, { positionMs: Math.round(playheadMs ?? 0) })}
              title="Set to current playhead position"
            >Set</button>
            <button
              style={{ ...btnStyle, padding: '1px 5px', fontSize: 10, marginLeft: 'auto', color: '#ff453a' }}
              onClick={() => deleteHotcue(i)}
              title="Delete"
            >✕</button>
          </div>
        ))}

        {memoryCues.map((mc, i) => (
          <div key={`mc-${i}`} style={rowStyle}>
            <ColourSwatch colour={mc.colour ?? '#ffd60a'} onClick={() => updateMemoryCue(i, { colour: cycleColour(mc.colour ?? '#ffd60a') })} />
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 28 }}>Mem</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 52, fontVariantNumeric: 'tabular-nums' }}>
              {formatMs(mc.positionMs)}
            </span>
            <button
              style={{ ...btnStyle, padding: '1px 6px', fontSize: 10 }}
              onClick={() => updateMemoryCue(i, { positionMs: Math.round(playheadMs ?? 0) })}
              title="Set to current playhead position"
            >Set</button>
            <button
              style={{ ...btnStyle, padding: '1px 5px', fontSize: 10, marginLeft: 'auto', color: '#ff453a' }}
              onClick={() => deleteMemoryCue(i)}
              title="Delete"
            >✕</button>
          </div>
        ))}

        {hotcues.length === 0 && memoryCues.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            No cues — use the buttons above to add
          </div>
        )}
      </div>
    </div>
  )
}
