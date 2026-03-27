// src/renderer/components/TrackList/TrackRow.jsx
import { formatBpm, formatDuration, HOTCUE_COLOURS } from '../../utils/colours.js'

export default function TrackRow({ track, selected, focused, onSelect, onFocus }) {
  return (
    <div
      onClick={() => onFocus(track.id)}
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
        onChange={() => onSelect(track.id)}
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
      <span style={{
        flex: '0 0 46px', fontSize: 11, color: 'var(--text-secondary)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatBpm(track.bpm)}
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
        {track.hotcues.map(hc => (
          <div
            key={hc.slot}
            title={`Hotcue ${hc.slot}`}
            style={{
              width: 3, height: 16, borderRadius: 2,
              background: hc.colour ?? HOTCUE_COLOURS[hc.slot],
            }}
          />
        ))}
      </div>
    </div>
  )
}
