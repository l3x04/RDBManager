// src/renderer/utils/colours.js
export const HOTCUE_COLOURS = {
  A: '#ff453a', B: '#ff9f0a', C: '#ffd60a', D: '#30d158',
  E: '#0a84ff', F: '#bf5af2', G: '#ff375f', H: '#64d2ff',
}

// Rekordbox 6.x all 16 cue colours (confirmed from actual CDJ palette, ordered by hue)
export const RB_COLOURS = [
  '#e62828', // Red
  '#ff127b', // Hot pink
  '#de44cf', // Magenta
  '#b432ff', // Purple
  '#aa72ff', // Light purple
  '#6473ff', // Blue-purple
  '#305aff', // Deep blue
  '#50b4ff', // Sky blue
  '#00e0ff', // Cyan
  '#10b176', // Teal
  '#28e214', // Bright green
  '#a5e116', // Yellow-green
  '#b4be04', // Olive
  '#c3af04', // Dark yellow
  '#e0641b', // Orange
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
