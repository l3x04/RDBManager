// src/renderer/utils/colours.js
export const HOTCUE_COLOURS = {
  A: '#ff453a', B: '#ff9f0a', C: '#ffd60a', D: '#30d158',
  E: '#0a84ff', F: '#bf5af2', G: '#ff375f', H: '#64d2ff',
}

// Rekordbox 6.x supported cue colours (ColorTableIndex 0–7)
export const RB_COLOURS = [
  '#ff375f', // 0 Pink
  '#ff453a', // 1 Red
  '#ff9f0a', // 2 Orange
  '#ffd60a', // 3 Yellow
  '#30d158', // 4 Green
  '#64d2ff', // 5 Aqua
  '#0a84ff', // 6 Blue
  '#bf5af2', // 7 Purple
]

export function formatBpm(bpm) {
  if (bpm == null) return '--'
  return Number(bpm).toFixed(1)
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = String(Math.floor(seconds) % 60).padStart(2, '0')
  return `${m}:${s}`
}
