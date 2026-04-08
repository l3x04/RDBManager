// src/renderer/components/BottomBar.jsx
import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../store/appStore.js'
import { buildPreflightWarnings } from '../utils/cueCalc.js'

const FORMATS = ['WAV', 'FLAC', 'MP3', 'AIFF']
const SOURCE_FORMATS = ['FLAC', 'WAV', 'MP3', 'AIFF', 'AAC', 'M4A', 'OGG', 'WMA']
const CONVERT_MODES = [
  { value: 'selection', label: 'By Selection' },
  { value: 'format',    label: 'By Format' },
]

function getFileFormat(filePath) {
  if (!filePath) return null
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return null
  return filePath.slice(dot + 1).toUpperCase()
}

export default function BottomBar({ onGenerate, onSaveToRb }) {
  const tracks   = useAppStore(s => s.tracks)
  const selected = useAppStore(s => s.selectedTrackIds)
  const ruleSets = useAppStore(s => s.ruleSets)
  const adjs     = useAppStore(s => s.trackAdjustments)
  const setAdj   = useAppStore(s => s.setTrackAdjustment)
  const setTracks = useAppStore(s => s.setTracks)

  const [targetFormat, setTargetFormat] = useState('WAV')
  const [deleteOriginals, setDeleteOriginals] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertStatus, setConvertStatus] = useState(null) // { current, total } or null
  const [convertMode, setConvertMode] = useState('selection') // 'selection' | 'format'
  const [sourceFormat, setSourceFormat] = useState('FLAC')
  const [pendingConversions, setPendingConversions] = useState(0)
  const [fixBarSlot, setFixBarSlot] = useState('hc:D')
  const [pendingBarFixes, setPendingBarFixes] = useState(0)
  const [fixBarBusy, setFixBarBusy] = useState(false)

  const warnings = buildPreflightWarnings({ selectedTrackIds: selected, tracks, ruleSets })
  const warnMsg = warnings.map(w => `${w.missingCount} missing hotcue ${w.baseHotcue}`).join(', ')

  const hasChanges = Object.keys(adjs).length > 0 || (selected.size > 0 && ruleSets.length > 0) || pendingConversions > 0 || pendingBarFixes > 0

  // Count tracks matching source format (for "By Format" mode)
  const formatMatchIds = useMemo(() => {
    if (convertMode !== 'format') return []
    return tracks
      .filter(t => getFileFormat(t.filePath) === sourceFormat)
      .map(t => t.id)
  }, [tracks, sourceFormat, convertMode])

  // Listen for conversion progress events
  useEffect(() => {
    const unsub = window.api.onConvertProgress((data) => {
      setConvertStatus({ current: data.current, total: data.total })
    })
    return unsub
  }, [])

  const bulkBpm = (factor) => {
    for (const track of tracks) {
      if (!selected.has(track.id)) continue
      const cur = adjs[track.id]?.bpmOverride ?? track.bpm
      setAdj(track.id, { bpmOverride: Math.round(cur * factor * 10) / 10 })
    }
  }

  const handleDeleteOriginalsChange = (e) => {
    const wantChecked = e.target.checked
    if (wantChecked) {
      const confirmed = window.confirm(
        'WARNING: Enabling "Delete originals" will permanently delete the original audio files after conversion.\n\n' +
        'This cannot be undone. Are you sure?'
      )
      if (!confirmed) return
    }
    setDeleteOriginals(wantChecked)
  }

  const handleFixBars = async () => {
    const ids = [...selected]
    if (ids.length === 0 || fixBarBusy) return
    setFixBarBusy(true)
    try {
      const res = await window.api.fixBarByHotcue({ trackIds: ids, reference: fixBarSlot })
      if (res.ok) {
        const freshTracks = await window.api.getTracks()
        setTracks(freshTracks)
        setPendingBarFixes(prev => prev + (res.fixedCount ?? 0))
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
      setFixBarBusy(false)
    }
  }

  const handleConvert = async () => {
    const ids = convertMode === 'selection' ? [...selected] : formatMatchIds
    if (ids.length === 0 || converting) return
    setConverting(true)
    setConvertStatus({ current: 0, total: ids.length })
    try {
      const result = await window.api.convertAudioBulk({
        trackIds: ids,
        targetFormat: targetFormat.toLowerCase(),
        deleteOriginal: deleteOriginals,
      })
      if (result.ok) {
        // Refresh tracks from DB to pick up updated FolderPaths
        const freshTracks = await window.api.getTracks()
        setTracks(freshTracks)
        setConvertStatus(null)
        setPendingConversions(prev => prev + (result.succeeded ?? 0))
        alert(`Converted ${result.succeeded} track(s) to ${targetFormat}. Press "Save to rekordbox" to update the database.` +
          (result.failed > 0 ? ` ${result.failed} failed.` : ''))
      } else {
        alert(`Conversion error: ${result.error}`)
      }
    } catch (err) {
      alert(`Conversion error: ${err.message}`)
    } finally {
      setConverting(false)
      setConvertStatus(null)
    }
  }

  const smallBtn = {
    background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600,
    padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
    opacity: selected.size === 0 ? 0.4 : 1,
  }

  const selectStyle = {
    background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600,
    padding: '5px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    cursor: 'pointer', outline: 'none',
  }

  const convertCount = convertMode === 'selection' ? selected.size : formatMatchIds.length
  const convertDisabled = convertCount === 0 || converting
  const convertBtnText = converting
    ? 'Converting...'
    : convertMode === 'selection'
      ? 'Convert Selected'
      : `Convert All ${sourceFormat}`

  return (
    <div style={{ height: 52, background: 'var(--bg-panel)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
      <div style={{ flex: 1, fontSize: 11 }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          <b style={{ color: 'var(--text-primary)' }}>{selected.size}</b> of {tracks.length} tracks selected
        </span>
        {warnMsg && <span style={{ marginLeft: 12, color: '#ff9f0a' }}>! {warnMsg}</span>}
        {convertStatus && (
          <span style={{ marginLeft: 12, color: 'var(--accent)' }}>
            Converting {convertStatus.current}/{convertStatus.total}...
          </span>
        )}
      </div>

      {/* BPM buttons */}
      <button onClick={() => bulkBpm(0.5)} disabled={selected.size === 0} style={smallBtn} title="Halve BPM of selected">/2 BPM</button>
      <button onClick={() => bulkBpm(2)} disabled={selected.size === 0} style={smallBtn} title="Double BPM of selected">x2 BPM</button>

      {/* Fix Bars — align bar 1 to a reference point */}
      <select
        value={fixBarSlot}
        onChange={(e) => setFixBarSlot(e.target.value)}
        style={{ ...selectStyle, minWidth: 110 }}
        title="Reference point — bar 1 will snap to the closest beat to this position"
      >
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
      <button
        onClick={handleFixBars}
        disabled={selected.size === 0 || fixBarBusy}
        style={{
          ...smallBtn,
          cursor: selected.size === 0 || fixBarBusy ? 'not-allowed' : 'pointer',
          opacity: selected.size === 0 || fixBarBusy ? 0.4 : 1,
        }}
        title="Fix bar alignment on selected tracks — bar 1 snaps to the closest beat to the chosen reference"
      >
        {fixBarBusy ? '...' : 'Fix Bars'}
      </button>

      {/* Separator */}
      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

      {/* Convert section */}
      <select
        value={convertMode}
        onChange={(e) => setConvertMode(e.target.value)}
        style={selectStyle}
        title="Conversion mode"
      >
        {CONVERT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>

      {convertMode === 'format' && (
        <select
          value={sourceFormat}
          onChange={(e) => setSourceFormat(e.target.value)}
          style={selectStyle}
          title="Source format to convert from"
        >
          {SOURCE_FORMATS.map(f => (
            <option key={f} value={f}>
              {f} ({tracks.filter(t => getFileFormat(t.filePath) === f).length})
            </option>
          ))}
        </select>
      )}

      <select
        value={targetFormat}
        onChange={(e) => setTargetFormat(e.target.value)}
        style={selectStyle}
        title="Target audio format"
      >
        {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={deleteOriginals}
          onChange={handleDeleteOriginalsChange}
          style={{ margin: 0, accentColor: 'var(--accent)' }}
        />
        Del orig
      </label>
      <button
        onClick={handleConvert}
        disabled={convertDisabled}
        style={{
          ...smallBtn,
          cursor: convertDisabled ? 'not-allowed' : 'pointer',
          opacity: convertDisabled ? 0.4 : 1,
          background: converting ? 'rgba(255,149,0,0.25)' : 'rgba(255,149,0,0.15)',
          borderColor: '#ff950080',
          color: '#ff9500',
        }}
        title={convertMode === 'selection' ? 'Convert selected tracks' : `Convert all ${sourceFormat} tracks (${formatMatchIds.length})`}
      >
        {convertBtnText}
      </button>

      {/* Separator */}
      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

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
        style={{
          background: '#30d158', color: '#fff', fontSize: 12, fontWeight: 600,
          padding: '8px 20px', borderRadius: 'var(--radius-md)', border: 'none',
          cursor: 'pointer',
        }}
      >
        Save to rekordbox
      </button>
    </div>
  )
}
