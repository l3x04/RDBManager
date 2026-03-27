// src/renderer/components/TrackList/TrackListHeader.jsx
const SORT_OPTIONS = [
  { value: 'title',    label: 'Title' },
  { value: 'artist',   label: 'Artist' },
  { value: 'bpm',      label: 'BPM' },
  { value: 'key',      label: 'Key' },
  { value: 'duration', label: 'Duration' },
]

export default function TrackListHeader({
  total, selectedCount, searchQuery, onSearchChange,
  onSelectAll, onSelectNone,
  sortField, sortDir, onSortChange, onSortDirToggle,
}) {
  const allSelected = total > 0 && selectedCount === total

  return (
    <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', flexShrink: 0 }}>
      <div style={{ padding: '8px 12px' }}>
        <input
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search tracks..."
          style={{
            width: '100%', background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px 8px', fontSize: 11,
      }}>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => allSelected ? onSelectNone() : onSelectAll()}
          style={{ accentColor: 'var(--accent)' }}
        />
        <span style={{ color: 'var(--text-tertiary)' }}>
          {selectedCount} / {total} selected
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Sort</span>
          <select
            value={sortField}
            onChange={e => onSortChange(e.target.value)}
            style={{
              background: '#1c1c1e', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text-primary)',
              padding: '2px 4px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={onSortDirToggle}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
              fontSize: 11, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit',
              lineHeight: 1.4,
            }}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>
    </div>
  )
}
