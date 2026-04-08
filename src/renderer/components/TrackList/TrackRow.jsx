// src/renderer/components/TrackList/TrackRow.jsx
import { formatBpm, formatDuration, HOTCUE_COLOURS } from '../../utils/colours.js'

// rekordbox Kind → slot letter (same mapping as db.js)
const KIND_TO_SLOT = { 1:'A', 2:'B', 3:'C', 5:'D', 6:'E', 7:'F', 8:'G', 9:'H' }

function getFileFormat(filePath) {
  if (!filePath) return null
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return null
  return filePath.slice(dot + 1).toUpperCase()
}

export default function TrackRow({ track, selected, focused, onSelect, onFocus, onRowClick, bpmOverride }) {
  const format = getFileFormat(track.filePath)

  return (
    <div
      onClick={e => onRowClick(track.id, e)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
        height: 34, cursor: 'pointer', userSelect: 'none',
        background: focused
          ? 'rgba(10,132,255,0.1)'
          : selected ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={e => { e.stopPropagation(); onSelect(track.id) }}
        onClick={e => e.stopPropagation()}
      />
      <span style={{
        flex: '0 0 190px', overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-primary)',
      }}>
        {track.title}
      </span>
      <span style={{
        flex: '0 0 120px', overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-secondary)',
      }}>
        {track.artist}
      </span>
      {format && (
        <span style={{
          flex: '0 0 auto', fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 3, padding: '1px 5px', letterSpacing: '0.04em',
          lineHeight: '16px', textAlign: 'center',
        }}>
          {format}
        </span>
      )}
      <span style={{
        flex: '0 0 46px', fontSize: 11, color: 'var(--text-secondary)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatBpm(bpmOverride ?? track.bpm)}
      </span>
      <span style={{ flex: '0 0 34px', fontSize: 11, color: 'var(--text-secondary)' }}>
        {track.key}
      </span>
      <span style={{
        flex: '0 0 38px', fontSize: 11, color: 'var(--text-tertiary)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatDuration(track.duration)}
      </span>
      <div style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
        {track.hotcues
          .map(hc => {
            // Derive the slot letter: use existing slot, fall back to Kind mapping, skip if neither
            const slot = hc.slot || (hc.Kind != null ? KIND_TO_SLOT[hc.Kind] : null)
            if (!slot) return null
            return { ...hc, slot }
          })
          .filter(Boolean)
          .map(hc => (
          <div
            key={hc.slot}
            title={`Hotcue ${hc.slot}`}
            style={{
              minWidth: 14, height: 16, borderRadius: 3, padding: '0 2px',
              background: hc.colour ?? '#28e214',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: '#000', lineHeight: 1,
              letterSpacing: 0,
            }}
          >
            {hc.slot}
          </div>
        ))}
      </div>
    </div>
  )
}
