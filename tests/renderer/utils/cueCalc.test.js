import { calcTargetMs, buildPreflightWarnings, generateCueWrites } from '../../../src/renderer/utils/cueCalc.js'

describe('calcTargetMs', () => {
  it('calculates position for negative bar offset', () => {
    // 128 BPM, bar = (60/128)*4*1000 = 1875ms, -8 bars from 32000ms
    const result = calcTargetMs({ baseCueMs: 32000, barOffset: -8, bpm: 128, gridOffsetMs: 0 })
    expect(result).toBe(32000 - 8 * 1875)
  })

  it('calculates position for positive bar offset', () => {
    const result = calcTargetMs({ baseCueMs: 32000, barOffset: 16, bpm: 128, gridOffsetMs: 0 })
    expect(result).toBe(32000 + 16 * 1875)
  })

  it('applies gridOffsetMs', () => {
    const result = calcTargetMs({ baseCueMs: 32000, barOffset: 0, bpm: 128, gridOffsetMs: 50 })
    expect(result).toBe(32050)
  })

  it('clamps result to >= 0', () => {
    const result = calcTargetMs({ baseCueMs: 1000, barOffset: -100, bpm: 128, gridOffsetMs: 0 })
    expect(result).toBe(0)
  })

  it('clamps result to <= trackDurationMs', () => {
    const result = calcTargetMs({ baseCueMs: 200000, barOffset: 100, bpm: 128, gridOffsetMs: 0, trackDurationMs: 240000 })
    expect(result).toBe(240000)
  })
})

describe('buildPreflightWarnings', () => {
  const tracks = [
    { id: 1, title: 'A', artist: '', bpm: 128, hotcues: [{ slot: 'D', positionMs: 32000 }], memoryCues: [] },
    { id: 2, title: 'B', artist: '', bpm: 128, hotcues: [], memoryCues: [] },
    { id: 3, title: 'C', artist: '', bpm: 128, hotcues: [{ slot: 'D', positionMs: 16000 }], memoryCues: [] },
  ]
  const ruleSets = [{ id: 'r1', baseHotcue: 'D', name: 'Drop', generatedCues: [] }]

  it('returns a warning for tracks missing the base hotcue', () => {
    const warnings = buildPreflightWarnings({ selectedTrackIds: new Set([1, 2, 3]), tracks, ruleSets })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ baseHotcue: 'D', missingCount: 1 })
  })

  it('returns empty array when all selected tracks have the base hotcue', () => {
    const warnings = buildPreflightWarnings({ selectedTrackIds: new Set([1, 3]), tracks, ruleSets })
    expect(warnings).toHaveLength(0)
  })
})

describe('generateCueWrites', () => {
  const tracks = [
    {
      id: 1, title: 'A', artist: '', bpm: 128, duration: 300,
      hotcues: [{ slot: 'D', positionMs: 32000 }], memoryCues: [],
    },
    {
      id: 2, title: 'B', artist: '', bpm: 128, duration: 300,
      hotcues: [], memoryCues: [],
    },
  ]
  const ruleSets = [{
    id: 'r1', baseHotcue: 'D', name: 'Drop',
    generatedCues: [{ id: 'g1', type: 'hotcue', slot: 'A', barOffset: -8, colour: '#ff453a' }],
  }]
  const trackAdjustments = {}

  it('generates a cue write for a track with the base hotcue', () => {
    const writes = generateCueWrites({ tracks, selectedTrackIds: new Set([1]), ruleSets, trackAdjustments })
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({
      trackId: 1,
      type: 'hotcue',
      slot: 'A',
      colour: '#ff453a',
      positionMs: 32000 - 8 * 1875, // 128 BPM, bar = 1875ms
    })
  })

  it('skips tracks missing the base hotcue', () => {
    const writes = generateCueWrites({ tracks, selectedTrackIds: new Set([1, 2]), ruleSets, trackAdjustments })
    expect(writes.every(w => w.trackId === 1)).toBe(true)
    expect(writes.filter(w => w.trackId === 2)).toHaveLength(0)
  })

  it('applies bpmOverride from trackAdjustments', () => {
    const adj = { 1: { bpmOverride: 140, gridOffsetMs: 0 } }
    const writes = generateCueWrites({ tracks, selectedTrackIds: new Set([1]), ruleSets, trackAdjustments: adj })
    const barMs = (60 / 140) * 4 * 1000
    expect(writes[0].positionMs).toBe(32000 - 8 * barMs)
  })
})
