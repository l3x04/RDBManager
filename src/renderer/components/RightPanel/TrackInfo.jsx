// src/renderer/components/RightPanel/TrackInfo.jsx
import { useAppStore } from '../../store/appStore.js'
import { formatBpm } from '../../utils/colours.js'

export default function TrackInfo() {
  const focusedId = useAppStore(s => s.focusedTrackId)
  const track     = useAppStore(s => s.tracks.find(t => t.id === focusedId))

  if (!track) return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', height: 48 }} />
  )

  return (
    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{track.artist}</div>
      </div>
      {[['BPM', formatBpm(track.bpm)], ['Key', track.key]].map(([label, val]) => (
        <div key={label} style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{val}</div>
        </div>
      ))}
    </div>
  )
}
