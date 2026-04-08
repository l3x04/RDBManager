// src/renderer/components/modals/BarFixerModal.jsx
import { useState } from 'react'
import { useAppStore } from '../../store/appStore.js'
import Modal from './Modal.jsx'

export default function BarFixerModal({ onClose }) {
  const tracks    = useAppStore(s => s.tracks)
  const selected  = useAppStore(s => s.selectedTrackIds)
  const setTracks = useAppStore(s => s.setTracks)

  const [fixBarSlot, setFixBarSlot] = useState('hc:D')
  const [busy, setBusy] = useState(false)

  const handleFixBars = async () => {
    const ids = [...selected]
    if (ids.length === 0 || busy) return
    setBusy(true)
    try {
      const res = await window.api.fixBarByHotcue({ trackIds: ids, reference: fixBarSlot })
      if (res.ok) {
        const freshTracks = await window.api.getTracks()
        setTracks(freshTracks)
        const label = fixBarSlot.startsWith('hc:') ? `Hotcue ${fixBarSlot.slice(3)}`
          : fixBarSlot === 'mem:first' ? 'First Memory Cue'
          : fixBarSlot === 'mem:last' ? 'Last Memory Cue'
          : fixBarSlot === 'pos:start' ? 'Song Start'
          : 'Song End'
        alert(`Fixed bar alignment on ${res.fixedCount} track(s) using ${label}. Press "Save to rekordbox" to persist.`)
      } else {
        alert(`Fix bars error: ${res.error}`)
      }
    } catch (err) {
      alert(`Fix bars error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const selectStyle = {
    background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
    padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    cursor: 'pointer', outline: 'none', width: '100%',
  }

  return (
    <Modal
      width={500}
      onClose={onClose}
      buttons={[
        { label: 'Cancel', onClick: onClose, variant: 'ghost' },
        { label: busy ? 'Fixing...' : 'Fix Bars', onClick: handleFixBars, disabled: selected.size === 0 || busy },
      ]}
    >
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Bar Position Fixer</div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 6 }}>
        Aligns the first beat of a bar (the red line in rekordbox) to a reference point.
        Select a hotcue, memory cue, or track position — the closest beat becomes beat 1 (the bar line).
        Useful when the beat grid is correct but the bar marker is in the wrong position.
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 16 }}>
        Example: If hotcue D marks every drop, selecting "Hotcue D" will ensure bar 1 aligns to the drop on all selected tracks.
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
          Reference Point
        </label>
        <select value={fixBarSlot} onChange={e => setFixBarSlot(e.target.value)} style={selectStyle}>
          <optgroup label="Hotcues">
            {['A','B','C','D','E','F','G','H'].map(s => <option key={`hc-${s}`} value={`hc:${s}`}>Hotcue {s}</option>)}
          </optgroup>
          <optgroup label="Memory Cues">
            <option value="mem:first">First Memory Cue</option>
            <option value="mem:last">Last Memory Cue</option>
          </optgroup>
          <optgroup label="Track">
            <option value="pos:start">Song Start</option>
            <option value="pos:end">Song End</option>
          </optgroup>
        </select>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        {selected.size} track{selected.size !== 1 ? 's' : ''} selected
      </div>
    </Modal>
  )
}
