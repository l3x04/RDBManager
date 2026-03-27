// src/main/anlz.js
// Read rekordbox ANLZ DAT files to get exact beat grid positions
import Database from 'better-sqlite3'
import fs   from 'fs'
import path from 'path'
import os   from 'os'

const RB_APPDATA  = path.join(os.homedir(), 'AppData', 'Roaming', 'Pioneer', 'rekordbox')
const RB_SHARE    = path.join(RB_APPDATA, 'share')
const LOCAL_DB    = path.join(RB_APPDATA, 'master.db')

// ── ANLZ parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a rekordbox ANLZ .DAT buffer.
 * Returns array of { beatNumber:1-4, tempo, timeMs } or null.
 */
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

// ── Local DB cross-reference ──────────────────────────────────────────────────

function normPath(p) {
  return (p || '').replace(/^\/([A-Za-z])\//, '$1:/').replace(/\//g, '\\').toLowerCase()
}

let _localMap = undefined  // lazy-loaded cache

function getLocalMap(decryptFn) {
  if (_localMap !== undefined) return _localMap
  _localMap = null
  if (!fs.existsSync(LOCAL_DB)) return null
  let tmpPath
  try {
    const enc = fs.readFileSync(LOCAL_DB)
    const dec = decryptFn(enc)
    tmpPath = path.join(os.tmpdir(), `rb_local_${Date.now()}.db`)
    fs.writeFileSync(tmpPath, dec)
    const db   = new Database(tmpPath, { readonly: true })
    const rows = db.prepare(
      `SELECT FolderPath, AnalysisDataPath FROM djmdContent WHERE AnalysisDataPath IS NOT NULL`
    ).all()
    db.close()
    _localMap = new Map(rows.map(r => [normPath(r.FolderPath), r.AnalysisDataPath]))
    console.log(`[anlz] local DB loaded: ${_localMap.size} analysis paths`)
  } catch (e) {
    console.warn('[anlz] local DB read failed:', e.message)
  } finally {
    if (tmpPath) try { fs.unlinkSync(tmpPath) } catch {}
  }
  return _localMap
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load exact beat positions for all tracks.
 * Returns a Map<trackId, beats[]>.
 * decryptFn: the same decryptSqlCipher4 from db.js
 */
export function loadBeatsForTracks(tracks, decryptFn) {
  const result  = new Map()
  const localMap = getLocalMap(decryptFn)

  for (const track of tracks) {
    // Try backup DB's own ANLZ path first (works if same install/UUID)
    let beats = track._anlzPath ? readAnlzBeats(track._anlzPath) : null

    // Fall back to local DB lookup by file path
    if (!beats && localMap && track.filePath) {
      const key      = normPath(track.filePath)
      const anlzPath = localMap.get(key)
      if (anlzPath) beats = readAnlzBeats(anlzPath)
    }

    if (beats && beats.length > 0) result.set(track.id, beats)
  }
  console.log(`[anlz] beats loaded for ${result.size}/${tracks.length} tracks`)
  return result
}
