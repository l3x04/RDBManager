// src/renderer/components/TrackList/TrackList.jsx
import { useRef, useMemo, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAppStore } from '../../store/appStore.js'
import TrackRow from './TrackRow.jsx'
import TrackListHeader from './TrackListHeader.jsx'

export default function TrackList() {
  const allTracks     = useAppStore(s => s.tracks)
  const searchQuery   = useAppStore(s => s.searchQuery)
  const [sortField, setSortField] = useState('title')
  const [sortDir, setSortDir]     = useState('asc')
  const tracks        = useMemo(() => {
    let result = allTracks
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t =>
        (t.title ?? '').toLowerCase().includes(q) ||
        (t.artist ?? '').toLowerCase().includes(q)
      )
    }
    return [...result].sort((a, b) => {
      let av = a[sortField] ?? ''
      let bv = b[sortField] ?? ''
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv ?? '').toLowerCase() }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [allTracks, searchQuery, sortField, sortDir])
  const selected      = useAppStore(s => s.selectedTrackIds)
  const adjs          = useAppStore(s => s.trackAdjustments)
  const focusedId     = useAppStore(s => s.focusedTrackId)
  const toggleTrack   = useAppStore(s => s.toggleTrack)
  const selectAll     = useAppStore(s => s.selectAll)
  const selectNone    = useAppStore(s => s.selectNone)
  const setSearch     = useAppStore(s => s.setSearchQuery)
  const setFocused    = useAppStore(s => s.setFocusedTrackId)

  const lastClickedIdx = useRef(null)

  const handleRowClick = useCallback((trackId, e) => {
    const idx = tracks.findIndex(t => t.id === trackId)
    setFocused(trackId)

    if (e.shiftKey && lastClickedIdx.current != null) {
      // Shift+click: select/tick range
      const from = Math.min(lastClickedIdx.current, idx)
      const to   = Math.max(lastClickedIdx.current, idx)
      const rangeIds = tracks.slice(from, to + 1).map(t => t.id)
      useAppStore.setState(s => {
        const next = new Set(s.selectedTrackIds)
        for (const id of rangeIds) next.add(id)
        return { selectedTrackIds: next }
      })
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+click: toggle checkbox without losing others
      toggleTrack(trackId)
    } else {
      // Plain click: just focus (no selection change)
    }
    lastClickedIdx.current = idx
  }, [tracks, toggleTrack, setFocused])

  const parentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 10,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TrackListHeader
        total={allTracks.length}
        filteredCount={tracks.length}
        selectedCount={selected.size}
        searchQuery={searchQuery}
        onSearchChange={setSearch}
        onSelectAll={selectAll}
        onSelectNone={selectNone}
        sortField={sortField}
        sortDir={sortDir}
        onSortChange={setSortField}
        onSortDirToggle={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
      />
      <div ref={parentRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(item => {
            const track = tracks[item.index]
            return (
              <div
                key={item.key}
                style={{ position: 'absolute', top: item.start, left: 0, right: 0 }}
              >
                <TrackRow
                  track={track}
                  selected={selected.has(track.id)}
                  focused={focusedId === track.id}
                  onSelect={toggleTrack}
                  onFocus={setFocused}
                  onRowClick={handleRowClick}
                  bpmOverride={adjs[track.id]?.bpmOverride}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
