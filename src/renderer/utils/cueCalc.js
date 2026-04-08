// src/renderer/utils/cueCalc.js

export function barDurationMs(bpm) {
  return (60 / bpm) * 4 * 1000
}

export function calcTargetMs({ baseCueMs, barOffset, bpm, gridOffsetMs = 0, trackDurationMs = Infinity }) {
  const offset = barOffset * barDurationMs(bpm)
  const raw = baseCueMs + offset + gridOffsetMs
  // Return null if outside track bounds (caller should skip)
  if (raw < 0 || raw > trackDurationMs) return null
  return raw
}

export function buildPreflightWarnings({ selectedTrackIds, tracks, ruleSets }) {
  const selectedTracks = tracks.filter(t => selectedTrackIds.has(t.id))
  const warnings = []

  for (const ruleSet of ruleSets) {
    const missing = selectedTracks.filter(
      t => !t.hotcues.some(hc => hc.slot === ruleSet.baseHotcue)
    )
    if (missing.length > 0) {
      warnings.push({ baseHotcue: ruleSet.baseHotcue, ruleSetName: ruleSet.name, missingCount: missing.length })
    }
  }

  return warnings
}

export function generateCueWrites({ tracks, selectedTrackIds, ruleSets, trackAdjustments }) {
  const writes = [] // { trackId, type, slot, positionMs, colour }

  for (const track of tracks) {
    if (!selectedTrackIds.has(track.id)) continue
    const adj = trackAdjustments[track.id] ?? { bpmOverride: null, gridOffsetMs: 0 }
    const bpm = adj.bpmOverride ?? track.bpm
    const gridOffsetMs = adj.gridOffsetMs ?? 0
    const trackDurationMs = track.duration * 1000 // track.duration is in seconds

    for (const ruleSet of ruleSets) {
      const baseCue = track.hotcues.find(hc => hc.slot === ruleSet.baseHotcue)
      if (!baseCue) continue

      for (const genCue of ruleSet.generatedCues) {
        const raw = baseCue.positionMs + genCue.barOffset * barDurationMs(bpm) + gridOffsetMs
        // Skip cues that fall before track start or after track end
        if (raw < 0 || raw > trackDurationMs) continue
        writes.push({
          trackId: track.id,
          type: genCue.type,
          slot: genCue.slot,
          positionMs: raw,
          colour: genCue.colour,
        })
      }
    }
  }

  return writes
}
