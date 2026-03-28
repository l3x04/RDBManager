// src/renderer/store/appStore.js
import { create } from 'zustand'

export const useAppStore = create((set, get) => ({
  // Data
  tracks: [],
  dbError: null,
  setDbError: (error) => set({ dbError: error }),
  focusedTrackId: null,
  setFocusedTrackId: (id) => set({ focusedTrackId: id }),

  // Selection
  selectedTrackIds: new Set(),
  toggleTrack: (id) => set(s => {
    const next = new Set(s.selectedTrackIds)
    next.has(id) ? next.delete(id) : next.add(id)
    return { selectedTrackIds: next }
  }),
  selectAll: () => set(s => ({ selectedTrackIds: new Set(s.tracks.map(t => t.id)) })),
  selectNone: () => set({ selectedTrackIds: new Set() }),

  // Search/filter
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  // Rules
  ruleSets: [],
  addRuleSet: () => set(s => ({
    ruleSets: [...s.ruleSets, {
      id: crypto.randomUUID(), baseHotcue: 'A', name: '', generatedCues: []
    }]
  })),
  removeRuleSet: (id) => set(s => ({ ruleSets: s.ruleSets.filter(r => r.id !== id) })),
  updateRuleSet: (id, patch) => set(s => ({
    ruleSets: s.ruleSets.map(r => r.id === id ? { ...r, ...patch } : r)
  })),
  addGeneratedCue: (ruleSetId) => set(s => ({
    ruleSets: s.ruleSets.map(r => r.id !== ruleSetId ? r : {
      ...r,
      generatedCues: [...r.generatedCues, {
        id: crypto.randomUUID(), type: 'hotcue', slot: 'A',
        barOffset: -8, colour: '#ff453a', label: ''
      }]
    })
  })),
  removeGeneratedCue: (ruleSetId, cueId) => set(s => ({
    ruleSets: s.ruleSets.map(r => r.id !== ruleSetId ? r : {
      ...r, generatedCues: r.generatedCues.filter(c => c.id !== cueId)
    })
  })),
  updateGeneratedCue: (ruleSetId, cueId, patch) => set(s => ({
    ruleSets: s.ruleSets.map(r => r.id !== ruleSetId ? r : {
      ...r, generatedCues: r.generatedCues.map(c => c.id === cueId ? { ...c, ...patch } : c)
    })
  })),

  // Track adjustments (BPM override, grid offset)
  trackAdjustments: {},
  setTrackAdjustment: (trackId, patch) => set(s => ({
    trackAdjustments: {
      ...s.trackAdjustments,
      [trackId]: {
        bpmOverride: null,
        gridOffsetMs: 0,
        ...s.trackAdjustments[trackId],
        ...patch
      }
    }
  })),

  // Cue overrides: trackId → { hotcues: [...], memoryCues: [...] }
  cueOverrides: {},
  setCueOverrides: (trackId, cues) => set(s => ({
    cueOverrides: { ...s.cueOverrides, [trackId]: cues }
  })),
  getCuesForTrack: (trackId) => {
    const { cueOverrides, tracks } = get()
    if (cueOverrides[trackId]) return cueOverrides[trackId]
    const track = tracks.find(t => t.id === trackId)
    if (!track) return { hotcues: [], memoryCues: [] }
    return { hotcues: track.hotcues ?? [], memoryCues: track.memoryCues ?? [] }
  },
  ensureCueOverrides: (trackId) => {
    const { cueOverrides, tracks } = get()
    if (cueOverrides[trackId]) return cueOverrides[trackId]
    const track = tracks.find(t => t.id === trackId)
    const copy = {
      hotcues: (track?.hotcues ?? []).map(h => ({ ...h })),
      memoryCues: (track?.memoryCues ?? []).map(m => ({ ...m })),
    }
    set(s => ({ cueOverrides: { ...s.cueOverrides, [trackId]: copy } }))
    return copy
  },

  // Derived: filtered track list
  filteredTracks: () => {
    const { tracks, searchQuery } = get()
    if (!searchQuery.trim()) return tracks
    const q = searchQuery.toLowerCase()
    return tracks.filter(t =>
      (t.title ?? '').toLowerCase().includes(q) || (t.artist ?? '').toLowerCase().includes(q)
    )
  },

  // Hydrate from session
  loadSession: (session) => set({
    ruleSets: session.ruleSets ?? [],
    selectedTrackIds: new Set(session.selectedTrackIds ?? []),
    trackAdjustments: session.trackAdjustments ?? {},
    cueOverrides: session.cueOverrides ?? {},
  }),

  // Set tracks from IPC
  setTracks: (tracks) => set({ tracks }),
}))
