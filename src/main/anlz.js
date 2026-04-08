// src/main/anlz.js
// Read rekordbox ANLZ DAT files to get exact beat grid positions
import fs   from 'fs'
import path from 'path'
import os   from 'os'

const RB_SHARE = path.join(os.homedir(), 'AppData', 'Roaming', 'Pioneer', 'rekordbox', 'share')

// ── ANLZ parsing ─────────────────────────────────────────────────────────────

function parseAnlzBeats(buf) {
  if (buf.length < 28 || buf.slice(0, 4).toString('ascii') !== 'PMAI') return null
  const fileHeaderLen = buf.readUInt32BE(4)
  let pos = fileHeaderLen
  while (pos + 12 <= buf.length) {
    const tag      = buf.slice(pos, pos + 4).toString('ascii')
    const hdrLen   = buf.readUInt32BE(pos + 4)
    const totalLen = buf.readUInt32BE(pos + 8)
    if (tag === 'PQTZ' && hdrLen >= 24) {
      const count = buf.readUInt32BE(pos + 20)
      const beats = []
      for (let i = 0; i < count; i++) {
        const eo = pos + 24 + i * 8
        if (eo + 8 > buf.length) break
        beats.push({
          beatNumber: buf.readUInt16BE(eo),
          tempo:      buf.readUInt16BE(eo + 2),
          timeMs:     buf.readUInt32BE(eo + 4),
        })
      }
      return beats
    }
    if (totalLen < 12) break
    pos += totalLen
  }
  return null
}

function readAnlzBeats(anlzRelPath) {
  const rel  = anlzRelPath.replace(/^\//, '').split('/').join(path.sep)
  const full = path.join(RB_SHARE, rel)
  if (!fs.existsSync(full)) return null
  try { return parseAnlzBeats(fs.readFileSync(full)) } catch { return null }
}

// ── ANLZ writing ────────────────────────────────────────────────────────────

export function resolveAnlzPath(anlzRelPath) {
  const rel = anlzRelPath.replace(/^\//, '').split('/').join(path.sep)
  return path.join(RB_SHARE, rel)
}

/**
 * Update beat grid in an ANLZ .DAT file.
 * @param {string} anlzRelPath - relative ANLZ path from DB
 * @param {number|null} newBpm - new BPM (null = keep original)
 * @param {number} gridOffsetMs - shift all beats by this many ms (0 = no shift)
 */
export function updateAnlzBeats(anlzRelPath, newBpm, gridOffsetMs) {
  const full = resolveAnlzPath(anlzRelPath)
  if (!fs.existsSync(full)) return false

  const buf = Buffer.from(fs.readFileSync(full))
  if (buf.length < 28 || buf.slice(0, 4).toString('ascii') !== 'PMAI') return false

  const fileHeaderLen = buf.readUInt32BE(4)
  let pos = fileHeaderLen
  let found = false

  while (pos + 12 <= buf.length) {
    const tag      = buf.slice(pos, pos + 4).toString('ascii')
    const hdrLen   = buf.readUInt32BE(pos + 4)
    const totalLen = buf.readUInt32BE(pos + 8)

    if (tag === 'PQTZ' && hdrLen >= 24) {
      const count = buf.readUInt32BE(pos + 20)
      if (count === 0) break

      const firstBeatEo = pos + 24
      const firstBeatMs = buf.readUInt32BE(firstBeatEo + 4)
      const origTempo = buf.readUInt16BE(firstBeatEo + 2)
      const bpm = newBpm ?? (origTempo / 100)
      const tempo = Math.round(bpm * 100)
      const beatMs = 60000 / bpm
      const anchor = firstBeatMs + (gridOffsetMs ?? 0)

      for (let i = 0; i < count; i++) {
        const eo = pos + 24 + i * 8
        if (eo + 8 > buf.length) break

        if (newBpm != null) buf.writeUInt16BE(tempo, eo + 2)

        // Recalculate positions: anchor (first beat + offset) + index × beatMs
        if (newBpm != null || gridOffsetMs) {
          const t = Math.max(0, Math.round(anchor + i * beatMs))
          buf.writeUInt32BE(t, eo + 4)
        }
      }
      found = true
      break
    }
    if (totalLen < 12) break
    pos += totalLen
  }

  if (found) {
    fs.writeFileSync(full, buf)
    const parts = []
    if (newBpm != null) parts.push(`BPM=${newBpm}`)
    if (gridOffsetMs) parts.push(`offset=${gridOffsetMs}ms`)
    console.log(`[anlz] Updated ${parts.join(', ')} in ${anlzRelPath}`)
  }
  return found
}

// ── Bar alignment fix ────────────────────────────────────────────────────────

/**
 * Fix bar alignment so the first beat becomes beat 1 (the downbeat / red bar line).
 * Shifts ALL beatNumber values in the PQTZ section.
 * @param {string} anlzFullPath - absolute path to the ANLZ .DAT file
 * @returns {boolean} true if beats were changed, false if already aligned or not found
 */
export function fixBarAlignment(anlzFullPath) {
  if (!fs.existsSync(anlzFullPath)) return false

  const buf = Buffer.from(fs.readFileSync(anlzFullPath))
  if (buf.length < 28 || buf.slice(0, 4).toString('ascii') !== 'PMAI') return false

  const fileHeaderLen = buf.readUInt32BE(4)
  let pos = fileHeaderLen

  while (pos + 12 <= buf.length) {
    const tag      = buf.slice(pos, pos + 4).toString('ascii')
    const hdrLen   = buf.readUInt32BE(pos + 4)
    const totalLen = buf.readUInt32BE(pos + 8)

    if (tag === 'PQTZ' && hdrLen >= 24) {
      const count = buf.readUInt32BE(pos + 20)
      if (count === 0) return false

      const firstEo = pos + 24
      const firstBn = buf.readUInt16BE(firstEo)
      if (firstBn === 1) return false   // already aligned

      for (let i = 0; i < count; i++) {
        const eo = pos + 24 + i * 8
        if (eo + 8 > buf.length) break
        const orig = buf.readUInt16BE(eo)
        const shifted = ((orig - firstBn + 4) % 4) + 1
        buf.writeUInt16BE(shifted, eo)
      }

      fs.writeFileSync(anlzFullPath, buf)
      console.log(`[anlz] Fixed bar alignment (firstBeat was ${firstBn}) in ${anlzFullPath}`)
      return true
    }
    if (totalLen < 12) break
    pos += totalLen
  }
  return false
}

// ── Fix bar alignment by hotcue position ─────────────────────────────────────

/**
 * Fix bar alignment so the beat closest to a given position (ms) becomes beat 1.
 * Shifts ALL beatNumber values in the PQTZ section.
 * @param {string} anlzFullPath - absolute path to the ANLZ .DAT file
 * @param {number} targetMs - the hotcue position in ms to align beat 1 to
 * @returns {boolean} true if beats were changed, false if not found
 */
export function fixBarAlignmentByPosition(anlzFullPath, targetMs) {
  if (!fs.existsSync(anlzFullPath)) return false

  const buf = Buffer.from(fs.readFileSync(anlzFullPath))
  if (buf.length < 28 || buf.slice(0, 4).toString('ascii') !== 'PMAI') return false

  const fileHeaderLen = buf.readUInt32BE(4)
  let pos = fileHeaderLen

  while (pos + 12 <= buf.length) {
    const tag      = buf.slice(pos, pos + 4).toString('ascii')
    const hdrLen   = buf.readUInt32BE(pos + 4)
    const totalLen = buf.readUInt32BE(pos + 8)

    if (tag === 'PQTZ' && hdrLen >= 24) {
      const count = buf.readUInt32BE(pos + 20)
      if (count === 0) return false

      // Find the closest beat to targetMs
      let closestIdx = 0
      let closestDist = Infinity
      for (let i = 0; i < count; i++) {
        const eo = pos + 24 + i * 8
        if (eo + 8 > buf.length) break
        const t = buf.readUInt32BE(eo + 4)
        const dist = Math.abs(t - targetMs)
        if (dist < closestDist) { closestDist = dist; closestIdx = i }
      }

      // Read the beat number of the closest beat
      const targetEo = pos + 24 + closestIdx * 8
      const targetBn = buf.readUInt16BE(targetEo)
      if (targetBn === 1) return false  // already aligned

      // Shift all beat numbers so the target beat becomes 1
      for (let i = 0; i < count; i++) {
        const eo = pos + 24 + i * 8
        if (eo + 8 > buf.length) break
        const orig = buf.readUInt16BE(eo)
        const shifted = ((orig - targetBn + 4) % 4) + 1
        buf.writeUInt16BE(shifted, eo)
      }

      fs.writeFileSync(anlzFullPath, buf)
      console.log(`[anlz] Fixed bar alignment by hotcue (targetBeat was ${targetBn}, closestMs=${buf.readUInt32BE(targetEo + 4)}) in ${anlzFullPath}`)
      return true
    }
    if (totalLen < 12) break
    pos += totalLen
  }
  return false
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load exact beat positions for all tracks using their AnalysisDataPath.
 * Returns a Map<trackId, beats[]>.
 */
export async function loadBeatsForTracks(tracks, onProgress) {
  const result = new Map()
  const CHUNK = 100
  for (let start = 0; start < tracks.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, tracks.length)
    for (let i = start; i < end; i++) {
      const beats = tracks[i]._anlzPath ? readAnlzBeats(tracks[i]._anlzPath) : null
      if (beats && beats.length > 0) result.set(tracks[i].id, beats)
    }
    if (onProgress) onProgress({ phase: 'beats', progress: end / tracks.length })
    await new Promise(r => setImmediate(r))
  }
  console.log(`[anlz] beats loaded for ${result.size}/${tracks.length} tracks`)
  return result
}
