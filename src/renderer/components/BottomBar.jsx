// src/renderer/components/BottomBar.jsx
import { useState } from 'react'
import { useAppStore } from '../store/appStore.js'
import BarFixerModal from './modals/BarFixerModal.jsx'
import FormatConversionModal from './modals/FormatConversionModal.jsx'
import CueGeneratorModal from './modals/CueGeneratorModal.jsx'

export default function BottomBar({ onGenerate, onSaveToRb }) {
  const tracks   = useAppStore(s => s.tracks)
  const selected = useAppStore(s => s.selectedTrackIds)
  const adjs     = useAppStore(s => s.trackAdjustments)
  const setAdj   = useAppStore(s => s.setTrackAdjustment)

  const [showBarFixer, setShowBarFixer] = useState(false)
  const [showConversion, setShowConversion] = useState(false)
  const [showCueGenerator, setShowCueGenerator] = useState(false)

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
    cursor: 'pointer',
  }

  const disabledSmallBtn = {
    ...smallBtn,
    cursor: 'not-allowed',
    opacity: 0.4,
  }

  const toolBtn = {
    background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600,
    padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    cursor: 'pointer', transition: 'background 0.1s',
  }

  return (
    <>
      <div style={{ height: 52, background: 'var(--bg-panel)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0 }}>
        {/* Track count — left side */}
        <div style={{ flex: 1, fontSize: 11 }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            <b style={{ color: 'var(--text-primary)' }}>{selected.size}</b> of {tracks.length} tracks selected
          </span>
        </div>

        {/* BPM buttons */}
        <button
          onClick={() => bulkBpm(0.5)}
          disabled={selected.size === 0}
          style={selected.size === 0 ? disabledSmallBtn : smallBtn}
          title="Halve BPM of selected tracks"
        >
          {'\u00f72'} BPM
        </button>
        <button
          onClick={() => bulkBpm(2)}
          disabled={selected.size === 0}
          style={selected.size === 0 ? disabledSmallBtn : smallBtn}
          title="Double BPM of selected tracks"
        >
          {'\u00d72'} BPM
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* Tool buttons that open modals */}
        <button onClick={() => setShowBarFixer(true)} style={toolBtn} title="Open bar position fixer">
          Bar Position Fixer
        </button>
        <button onClick={() => setShowConversion(true)} style={toolBtn} title="Open format conversion">
          Format Conversion
        </button>
        <button onClick={() => setShowCueGenerator(true)} style={toolBtn} title="Open cue generator">
          Cue Generator
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* Save — always rightmost */}
        <button
          onClick={onSaveToRb}
          style={{
            background: '#30d158', color: '#fff', fontSize: 12, fontWeight: 600,
            padding: '8px 20px', borderRadius: 'var(--radius-md)', border: 'none',
            cursor: 'pointer',
          }}
        >
          Save to rekordbox
        </button>
      </div>

      {/* Modals */}
      {showBarFixer && (
        <BarFixerModal onClose={() => setShowBarFixer(false)} />
      )}
      {showConversion && (
        <FormatConversionModal onClose={() => setShowConversion(false)} />
      )}
      {showCueGenerator && (
        <CueGeneratorModal
          onClose={() => setShowCueGenerator(false)}
          onGenerate={() => { setShowCueGenerator(false); onGenerate() }}
        />
      )}
    </>
  )
}
