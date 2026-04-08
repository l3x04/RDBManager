// src/renderer/components/modals/FormatConversionModal.jsx
import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../../store/appStore.js'
import Modal from './Modal.jsx'

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

export default function FormatConversionModal({ onClose }) {
  const tracks    = useAppStore(s => s.tracks)
  const selected  = useAppStore(s => s.selectedTrackIds)
  const setTracks = useAppStore(s => s.setTracks)

  const [targetFormat, setTargetFormat] = useState('WAV')
  const [deleteOriginals, setDeleteOriginals] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertStatus, setConvertStatus] = useState(null)
  const [convertMode, setConvertMode] = useState('selection')
  const [sourceFormat, setSourceFormat] = useState('FLAC')
  const [showDeleteWarning, setShowDeleteWarning] = useState(false)

  const formatMatchIds = useMemo(() => {
    if (convertMode !== 'format') return []
    return tracks.filter(t => getFileFormat(t.filePath) === sourceFormat).map(t => t.id)
  }, [tracks, sourceFormat, convertMode])

  useEffect(() => {
    const unsub = window.api.onConvertProgress((data) => {
      setConvertStatus({ current: data.current, total: data.total })
    })
    return unsub
  }, [])

  const handleDeleteOriginalsChange = (e) => {
    if (e.target.checked) setShowDeleteWarning(true)
    else setDeleteOriginals(false)
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
        const freshTracks = await window.api.getTracks()
        setTracks(freshTracks)
        setConvertStatus(null)
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

  const convertCount = convertMode === 'selection' ? selected.size : formatMatchIds.length
  const convertDisabled = convertCount === 0 || converting
  const convertBtnText = converting
    ? `Converting ${convertStatus ? `${convertStatus.current}/${convertStatus.total}` : '...'}`
    : convertMode === 'selection'
      ? `Convert ${selected.size} Selected`
      : `Convert All ${sourceFormat}`

  const selectStyle = {
    background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
    padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    cursor: 'pointer', outline: 'none', width: '100%',
  }

  return (
    <Modal
      width={550}
      onClose={converting ? undefined : onClose}
      buttons={[
        { label: 'Cancel', onClick: onClose, variant: 'ghost', disabled: converting },
        { label: convertBtnText, onClick: handleConvert, disabled: convertDisabled },
      ]}
    >
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Format Conversion</div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 6 }}>
        Converts audio files between formats using FFmpeg. The converted file is saved alongside the original
        with the new extension. All cues, playlists, and metadata are preserved.
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 16 }}>
        Example: Convert all FLAC files to WAV for CDJ compatibility — select "By Format", choose FLAC as source, WAV as target.
      </div>

      {/* Mode selector */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
          Mode
        </label>
        <select value={convertMode} onChange={e => setConvertMode(e.target.value)} style={selectStyle}>
          {CONVERT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* Source format (only when By Format) */}
      {convertMode === 'format' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
            Source Format
          </label>
          <select value={sourceFormat} onChange={e => setSourceFormat(e.target.value)} style={selectStyle}>
            {SOURCE_FORMATS.map(f => (
              <option key={f} value={f}>
                {f} ({tracks.filter(t => getFileFormat(t.filePath) === f).length} tracks)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Target format */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
          Target Format
        </label>
        <select value={targetFormat} onChange={e => setTargetFormat(e.target.value)} style={selectStyle}>
          {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Delete originals */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', marginBottom: 14 }}>
        <input
          type="checkbox"
          checked={deleteOriginals}
          onChange={handleDeleteOriginalsChange}
          style={{ margin: 0, accentColor: 'var(--accent)' }}
        />
        Delete original files after conversion
        {deleteOriginals && <span style={{ color: '#ff453a', fontSize: 11, fontWeight: 600 }}>DESTRUCTIVE</span>}
      </label>

      {/* Progress */}
      {convertStatus && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>
            Converting {convertStatus.current}/{convertStatus.total}...
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 2, width: `${(convertStatus.current / convertStatus.total) * 100}%`, transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        {convertCount} track{convertCount !== 1 ? 's' : ''} will be converted
      </div>

      {/* Themed delete warning */}
      {showDeleteWarning && (
        <Modal
          width={420}
          onClose={() => setShowDeleteWarning(false)}
          buttons={[
            { label: 'Cancel', onClick: () => setShowDeleteWarning(false), variant: 'ghost' },
            { label: 'Yes, delete originals', onClick: () => { setDeleteOriginals(true); setShowDeleteWarning(false) }, variant: 'danger' },
          ]}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: '#ff453a', marginBottom: 10 }}>WARNING</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>
            Enabling <b>"Delete originals"</b> will <b>permanently delete</b> the original audio files after conversion.
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: '#ff453a', marginTop: 8, fontWeight: 600 }}>
            This cannot be undone.
          </div>
        </Modal>
      )}
    </Modal>
  )
}
