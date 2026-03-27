import Database from 'better-sqlite3'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { loadBeatsForTracks, updateAnlzBpm } from './anlz.js'
import { applyWritesToDb, applyBpmOverrides } from './dbWrite.js'

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
 * Decrypt the local rekordbox master.db (SQLCipher 4).
 * Returns the path to a temporary plain-SQLite file.
 */
export function decryptLocalDb() {
  const localDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Pioneer', 'rekordbox', 'master.db')
  if (!fs.existsSync(localDbPath))
    throw new Error('rekordbox database not found. Is rekordbox installed?')
  const enc = fs.readFileSync(localDbPath)
  const dec = decryptSqlCipher4(enc)
  const tmpPath = path.join(os.tmpdir(), `rb_local_${Date.now()}.db`)
  fs.writeFileSync(tmpPath, dec)
  return tmpPath
}

function decryptSqlCipher4(encData) {
  const keySalt = encData.slice(0, 16)
  const encKey = crypto.pbkdf2Sync(DB_PASSPHRASE, keySalt, DB_KDF_ITER, DB_KEY_SIZE, 'sha512')
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

function encryptSqlCipher4(plainData, salt) {
  const encKey = crypto.pbkdf2Sync(DB_PASSPHRASE, salt, DB_KDF_ITER, DB_KEY_SIZE, 'sha512')

  // HMAC key: PBKDF2(encKey, salt ^ 0x3a, 2 iterations, 32 bytes)
  const hmacSalt = Buffer.from(salt)
  for (let i = 0; i < hmacSalt.length; i++) hmacSalt[i] ^= 0x3a
  const hmacKey = crypto.pbkdf2Sync(encKey, hmacSalt, 2, DB_KEY_SIZE, 'sha512')

  const pageCount = Math.floor(plainData.length / DB_PAGE_SIZE)
  const outPages  = []

  for (let i = 0; i < pageCount; i++) {
    const page    = plainData.slice(i * DB_PAGE_SIZE, (i + 1) * DB_PAGE_SIZE)
    const outPage = Buffer.alloc(DB_PAGE_SIZE, 0)
    const iv      = crypto.randomBytes(DB_IV_SIZE)

    // Plaintext: page content before the reserve area
    const ptData = i === 0
      ? Buffer.from(page.slice(16, DB_PAGE_SIZE - DB_RESERVE_SIZE))   // skip SQLite header (4000 bytes)
      : Buffer.from(page.slice(0, DB_PAGE_SIZE - DB_RESERVE_SIZE))    // 4016 bytes

    // Page 0: restore the reserved-space byte (cleared during decryption)
    if (i === 0) ptData[4] = DB_RESERVE_SIZE

    // Encrypt
    const cipher = crypto.createCipheriv('aes-256-cbc', encKey, iv)
    cipher.setAutoPadding(false)
    const ct = Buffer.concat([cipher.update(ptData), cipher.final()])

    // Assemble page
    if (i === 0) { salt.copy(outPage, 0); ct.copy(outPage, 16) }
    else         { ct.copy(outPage, 0) }
    iv.copy(outPage, DB_PAGE_SIZE - DB_RESERVE_SIZE)

    // HMAC-SHA512: page 0 skips salt (bytes 16:4032), others use full (0:4032)
    const hmacStart = i === 0 ? 16 : 0
    const pgnoBytes = Buffer.alloc(4)
    pgnoBytes.writeUInt32LE(i + 1)
    const hmac = crypto.createHmac('sha512', hmacKey)
      .update(outPage.slice(hmacStart, DB_PAGE_SIZE - DB_RESERVE_SIZE + DB_IV_SIZE))
      .update(pgnoBytes)
      .digest()
    hmac.copy(outPage, DB_PAGE_SIZE - DB_RESERVE_SIZE + DB_IV_SIZE, 0, DB_RESERVE_SIZE - DB_IV_SIZE)

    outPages.push(outPage)
  }
  return Buffer.concat(outPages)
}

const RB_MASTER_DB = path.join(os.homedir(), 'AppData', 'Roaming', 'Pioneer', 'rekordbox', 'master.db')

/**
 * Apply cue writes directly to the rekordbox master.db.
 * Creates a .bak backup before overwriting.
 */
export function writeToRekordbox(decryptedDbPath, writes, trackAdjustments, anlzPathMap) {
  // 1. Apply writes to the decrypted DB
  console.log('[save] Opening decrypted DB for writing:', decryptedDbPath)
  const db = new Database(decryptedDbPath)
  try {
    if (writes.length > 0) {
      applyWritesToDb(db, writes)
      console.log('[save] Applied', writes.length, 'cue writes')
    }
    if (trackAdjustments) {
      applyBpmOverrides(db, trackAdjustments)
      const bpmCount = Object.values(trackAdjustments).filter(a => a.bpmOverride != null).length
      console.log('[save] Applied', bpmCount, 'BPM overrides')
    }
  } finally { db.close() }

  // 1b. Update ANLZ files for BPM changes (jogwheel/deck tempo)
  if (trackAdjustments && anlzPathMap) {
    for (const [trackId, adj] of Object.entries(trackAdjustments)) {
      if (adj.bpmOverride != null && adj.bpmOverride > 0) {
        const anlzPath = anlzPathMap.get(trackId) ?? anlzPathMap.get(Number(trackId))
        if (anlzPath) updateAnlzBpm(anlzPath, adj.bpmOverride)
      }
    }
  }

  // 2. Read modified plain DB
  const plainData = fs.readFileSync(decryptedDbPath)
  console.log('[save] Plain DB size:', plainData.length, 'bytes')

  // 3. Read original encrypted DB to get the salt
  console.log('[save] Reading original:', RB_MASTER_DB)
  const origEnc = fs.readFileSync(RB_MASTER_DB)
  const salt = origEnc.slice(0, 16)

  // 4. Re-encrypt
  const encData = encryptSqlCipher4(plainData, salt)
  console.log('[save] Re-encrypted:', encData.length, 'bytes')

  // 5. Backup original
  const bakPath = RB_MASTER_DB + '.bak'
  fs.copyFileSync(RB_MASTER_DB, bakPath)
  console.log('[save] Backup created:', bakPath)

  // 6. Write re-encrypted DB (also remove WAL/SHM to avoid conflicts)
  fs.writeFileSync(RB_MASTER_DB, encData)
  try { fs.unlinkSync(RB_MASTER_DB + '-wal') } catch {}
  try { fs.unlinkSync(RB_MASTER_DB + '-shm') } catch {}
  console.log('[save] Written to', RB_MASTER_DB)

  return bakPath
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
  // Load exact beat positions from ANLZ files (paths come from the same DB)
  const beatsMap = loadBeatsForTracks(tracks)
  // Build ANLZ path map before clearing _anlzPath (needed for ANLZ writes)
  const anlzPaths = new Map(tracks.map(t => [t.id, t._anlzPath]).filter(([, p]) => p))
  for (const track of tracks) {
    track.beats    = beatsMap.get(track.id) ?? null
    track._anlzPath = undefined // don't send internal path to renderer
  }
  return { tracks, anlzPaths }
}

// Waveform data lives in external ANLZ files, not in the backup DB.
export function loadWaveform(_db, _trackId) {
  return null
}
