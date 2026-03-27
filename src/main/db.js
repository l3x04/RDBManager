import Database from 'better-sqlite3'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import yauzl from 'yauzl'
import { loadBeatsForTracks } from './anlz.js'

// Rekordbox 6.x confirmed table names
const TRACK_TABLE = 'djmdContent'
const CUE_TABLE = 'djmdCue'

// SQLCipher 4 decryption parameters (rekordbox 6.x fixed passphrase)
const DB_PASSPHRASE = '402fd482c38817c35ffa8ffb8c7d93143b749e7d315df7a81732a1ff43608497'
const DB_PAGE_SIZE = 4096
const DB_RESERVE_SIZE = 80
const DB_IV_SIZE = 16
const DB_KEY_SIZE = 32
const DB_KDF_ITER = 256000

// rekordbox 6.x: hotcue slot A-H encoded as Kind value (Kind=4 is skipped)
export const KIND_TO_SLOT = { 1:'A', 2:'B', 3:'C', 5:'D', 6:'E', 7:'F', 8:'G', 9:'H' }
export const SLOT_TO_KIND = { A:1, B:2, C:3, D:5, E:6, F:7, G:8, H:9 }

// Map between app hex colours and rekordbox ColorTableIndex (0–7: Pink, Red, Orange, Yellow, Green, Aqua, Blue, Purple)
const COLOUR_TO_INDEX = {
  '#ff375f': 0, '#ff453a': 1, '#ff9f0a': 2, '#ffd60a': 3,
  '#30d158': 4, '#64d2ff': 5, '#0a84ff': 6, '#bf5af2': 7,
}
const INDEX_TO_COLOUR = Object.fromEntries(
  Object.entries(COLOUR_TO_INDEX).map(([hex, idx]) => [idx, hex])
)

/**
 * Extract master.db from a rekordbox backup zip and decrypt it (SQLCipher 4).
 * Returns the path to a temporary plain-SQLite file.
 */
export function extractAndDecryptZip(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err)
      zip.readEntry()
      zip.on('entry', entry => {
        if (entry.fileName === 'master.db') {
          zip.openReadStream(entry, (err, stream) => {
            if (err) return reject(err)
            const chunks = []
            stream.on('data', c => chunks.push(c))
            stream.on('end', () => {
              try {
                const decData = decryptSqlCipher4(Buffer.concat(chunks))
                const tmpPath = path.join(os.tmpdir(), `rekordbox_dec_${Date.now()}.db`)
                fs.writeFileSync(tmpPath, decData)
                zip.close()
                resolve(tmpPath)
              } catch (e) {
                reject(e)
              }
            })
            stream.on('error', reject)
          })
        } else {
          zip.readEntry()
        }
      })
      zip.on('error', reject)
    })
  })
}

function decryptSqlCipher4(encData) {
  const keySalt = encData.slice(0, 16)
  const dk = crypto.pbkdf2Sync(DB_PASSPHRASE, keySalt, DB_KDF_ITER, DB_KEY_SIZE * 2, 'sha512')
  const encKey = dk.slice(0, DB_KEY_SIZE)
  const pageCount = Math.floor(encData.length / DB_PAGE_SIZE)
  const outPages = []
  for (let i = 0; i < pageCount; i++) {
    const page = encData.slice(i * DB_PAGE_SIZE, (i + 1) * DB_PAGE_SIZE)
    const iv = page.slice(DB_PAGE_SIZE - DB_RESERVE_SIZE, DB_PAGE_SIZE - DB_RESERVE_SIZE + DB_IV_SIZE)
    const ct = page.slice(i === 0 ? 16 : 0, DB_PAGE_SIZE - DB_RESERVE_SIZE)
    const decipher = crypto.createDecipheriv('aes-256-cbc', encKey, iv)
    decipher.setAutoPadding(false)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])
    const outPage = Buffer.alloc(DB_PAGE_SIZE, 0)
    if (i === 0) {
      Buffer.from('SQLite format 3\x00').copy(outPage, 0)
      pt.copy(outPage, 16)
      outPage[20] = 0 // clear reserved-space field (SQLCipher sets 80, standard SQLite needs 0)
    } else {
      pt.copy(outPage, 0)
    }
    outPages.push(outPage)
  }
  return Buffer.concat(outPages)
}

export function openDb(filePath) {
  return new Database(filePath, { readonly: true })
}

export function inspectSchema(db) {
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all()
  console.log('Tables:', tables.map(t => t.name))
  for (const { name } of tables) {
    const cols = db.prepare(`PRAGMA table_info("${name.replace(/"/g, '""')}")`).all()
    console.log(`\n${name}:`, cols.map(c => `${c.name} (${c.type})`))
  }
}

export function loadTracks(db) {
  const rows = db.prepare(
    `SELECT c.ID, c.Title, a.Name AS Artist, c.BPM, k.ScaleName AS KeyName, c.Length, c.FolderPath, c.AnalysisDataPath
     FROM ${TRACK_TABLE} c
     LEFT JOIN djmdArtist a ON c.ArtistID = a.ID
     LEFT JOIN djmdKey k ON c.KeyID = k.ID`
  ).all()
  return rows.map(row => ({
    id: row.ID,
    title: row.Title ?? '',
    artist: row.Artist ?? '',
    bpm: (row.BPM ?? 0) / 100,
    key: row.KeyName ?? '',
    duration: row.Length ?? 0,
    filePath: row.FolderPath ?? '',
    hotcues: [],
    memoryCues: [],
    beats: null,
    _anlzPath: row.AnalysisDataPath ?? null,
  }))
}

export function loadCues(db, trackId) {
  const rows = db.prepare(
    `SELECT Kind, InMsec, ColorTableIndex FROM ${CUE_TABLE} WHERE ContentID = ? AND Kind != 4`
  ).all(trackId)
  const hotcues = []
  const memoryCues = []
  for (const row of rows) {
    const colour = INDEX_TO_COLOUR[row.ColorTableIndex] ?? null
    if (row.Kind === 0) {
      memoryCues.push({ positionMs: row.InMsec, colour: colour ?? '#ffd60a' })
    } else if (KIND_TO_SLOT[row.Kind]) {
      hotcues.push({ slot: KIND_TO_SLOT[row.Kind], positionMs: row.InMsec, colour })
    }
  }
  return { hotcues, memoryCues }
}

export function loadAllTracksWithCues(db) {
  const tracks = loadTracks(db)
  for (const track of tracks) {
    const { hotcues, memoryCues } = loadCues(db, track.id)
    track.hotcues    = hotcues
    track.memoryCues = memoryCues
  }
  // Load exact beat positions from local ANLZ files
  const beatsMap = loadBeatsForTracks(tracks, decryptSqlCipher4)
  for (const track of tracks) {
    track.beats    = beatsMap.get(track.id) ?? null
    track._anlzPath = undefined // don't send internal path to renderer
  }
  return tracks
}

// Waveform data lives in external ANLZ files, not in the backup DB.
export function loadWaveform(_db, _trackId) {
  return null
}
