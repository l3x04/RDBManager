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

function resolveAnlzPath(anlzRelPath) {
  const rel = anlzRelPath.replace(/^\//, '').split('/').join(path.sep)
  return path.join(RB_SHARE, rel)
}

/**
 * Update BPM (tempo) and recalculate beat positions in an ANLZ .DAT file.
 * Keeps the first beat position, recomputes all others from new BPM.
 */
export function updateAnlzBpm(anlzRelPath, newBpm) {
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

      const newTempo = Math.round(newBpm * 100)  // BPM × 100 as uint16
      const firstBeatEo = pos + 24
      const firstBeatMs = buf.readUInt32BE(firstBeatEo + 4)
      const beatMs = 60000 / newBpm  // ms per beat at new BPM

      for (let i = 0; i < count; i++) {
        const eo = pos + 24 + i * 8
        if (eo + 8 > buf.length) break

        // Update tempo
        buf.writeUInt16BE(newTempo, eo + 2)

        // Recalculate beat position from first beat + index × beatMs
        const newTimeMs = Math.round(firstBeatMs + i * beatMs)
        buf.writeUInt32BE(newTimeMs, eo + 4)

        // Beat number cycles 1-4, keep original pattern
      }
      found = true
      break
    }
    if (totalLen < 12) break
    pos += totalLen
  }

  if (found) {
    fs.writeFileSync(full, buf)
    console.log(`[anlz] Updated BPM to ${newBpm} in ${anlzRelPath}`)
  }
  return found
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load exact beat positions for all tracks using their AnalysisDataPath.
 * Returns a Map<trackId, beats[]>.
 */
export function loadBeatsForTracks(tracks) {
  const result = new Map()
  for (const track of tracks) {
    const beats = track._anlzPath ? readAnlzBeats(track._anlzPath) : null
    if (beats && beats.length > 0) result.set(track.id, beats)
  }
  console.log(`[anlz] beats loaded for ${result.size}/${tracks.length} tracks`)
  return result
}
