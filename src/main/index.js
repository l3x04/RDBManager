import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { createRequire } from 'module'
import { openDb, loadAllTracksWithCues, decryptLocalDb, writeToRekordbox, reencryptToMaster } from './db.js'
import { readSession, writeSession, DEFAULT_SESSION } from './session.js'
import { generateCueWrites } from '../renderer/utils/cueCalc.js'
import { fixBarAlignment, fixBarAlignmentByPosition, resolveAnlzPath } from './anlz.js'

const require_ = createRequire(import.meta.url)
const ffmpegPath = require_('ffmpeg-static')

// Module-level state
let currentDb = null
let tracks = []
let anlzPaths = new Map()          // trackId → ANLZ relative path (for writing)
let mainWindow = null
let currentDecryptedDbPath = null  // temp .db path used for output generation
let tempDbPath = null              // temp file to clean up on next load

let pendingConversions = {}       // trackId → { oldRbPath, newRbPath, deleteOriginal, ... }

// Session file path — set after app is ready
let SESSION_PATH = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Dev: load from Vite dev server; Prod: load built file
  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function loadLocalDb(onProgress) {
  if (currentDb) {
    try { currentDb.close() } catch {}
    currentDb = null
  }
  if (tempDbPath) {
    try { fs.unlinkSync(tempDbPath) } catch {}
    tempDbPath = null
  }

  const dbPath = await decryptLocalDb(onProgress)
  tempDbPath = dbPath
  currentDb = openDb(dbPath, false)  // read-write so we can reuse for saves
  const result = await loadAllTracksWithCues(currentDb, onProgress)
  tracks = result.tracks
  anlzPaths = result.anlzPaths
  currentDecryptedDbPath = dbPath
  return tracks.length
}

function registerIpc() {
  ipcMain.handle('db:loadLocal', async () => {
    try {
      const count = await loadLocalDb()
      return { ok: true, count }
    } catch (err) {
      const msg = err.message.includes('not found')
        ? 'rekordbox database not found. Is rekordbox installed?'
        : 'Failed to read rekordbox database — unsupported version?'
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle('db:reload', async () => {
    try {
      const count = await loadLocalDb()
      return { ok: true, count }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('db:getTracks', () => tracks)

  ipcMain.handle('session:get', () => {
    return SESSION_PATH ? readSession(SESSION_PATH) : { ...DEFAULT_SESSION }
  })

  ipcMain.handle('session:save', (_e, state) => {
    if (!SESSION_PATH) return { ok: false, error: 'Session path not initialized' }
    try {
      writeSession(SESSION_PATH, state)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('generate', async (_e, { selectedTrackIds, ruleSets, trackAdjustments }) => {
    try {
      const writes = generateCueWrites({
        tracks,
        selectedTrackIds: new Set(selectedTrackIds),
        ruleSets,
        trackAdjustments,
      })
      if (writes.length === 0) return { ok: false, error: 'No cue writes generated' }

      // Preview only — return the writes without saving to DB
      const tracksProcessed = new Set(writes.map(w => w.trackId)).size
      return {
        ok: true,
        tracksProcessed,
        cuesWritten: writes.length,
        tracksSkipped: selectedTrackIds.length - tracksProcessed,
        writes,
      }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('db:saveToRb', async (_e, { selectedTrackIds, ruleSets, trackAdjustments, cueOverrides }) => {
    console.log('[save] cueOverrides keys:', Object.keys(cueOverrides || {}))
    for (const [id, c] of Object.entries(cueOverrides || {})) {
      console.log(`[save]   track ${id}: ${c.hotcues?.length ?? 0} hotcues, ${c.memoryCues?.length ?? 0} memory`)
    }
    try {
      const writes = (ruleSets && ruleSets.length > 0 && selectedTrackIds && selectedTrackIds.length > 0)
        ? generateCueWrites({
            tracks,
            selectedTrackIds: new Set(selectedTrackIds),
            ruleSets,
            trackAdjustments,
          })
        : []

      // Apply pending format conversions to DB (path + metadata updates)
      let conversionsApplied = 0
      if (pendingConversions && Object.keys(pendingConversions).length > 0) {
        const updateTrack = currentDb.prepare(
          'UPDATE djmdContent SET FolderPath = ?, FileNameL = ?, FileNameS = ?, FileType = ?, FileSize = ?, updated_at = datetime(\'now\') WHERE ID = ?'
        )
        for (const [trackId, conv] of Object.entries(pendingConversions)) {
          updateTrack.run(conv.newRbPath, conv.newFileName, conv.newFileName, conv.newFileType, conv.newFileSize, trackId)
          console.log('[save] Applied conversion:', conv.oldRbPath, '→', conv.newRbPath, `(type=${conv.newFileType}, size=${conv.newFileSize})`)
          // Delete original if requested
          if (conv.deleteOriginal && fs.existsSync(conv.oldWinPath)) {
            try { fs.unlinkSync(conv.oldWinPath); console.log('[save] Deleted original:', conv.oldWinPath) }
            catch (e) { console.warn('[save] Could not delete original:', e.message) }
          }
          conversionsApplied++
        }
        pendingConversions = {}
      }

      // Use existing read-write connection directly
      writeToRekordbox(currentDb, currentDecryptedDbPath, writes, trackAdjustments, anlzPaths, cueOverrides)

      // Reload tracks with updated data (same connection)
      const result = await loadAllTracksWithCues(currentDb)
      tracks = result.tracks
      anlzPaths = result.anlzPaths

      const bpmChanges = Object.values(trackAdjustments || {}).filter(a => a.bpmOverride != null).length
      const cueOverrideCount = Object.keys(cueOverrides || {}).length
      return {
        ok: true,
        cuesWritten: writes.length,
        bpmChanges,
        cueOverrideCount,
        conversionsApplied,
      }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('db:bulkDeleteCues', async (_e, { keepKinds }) => {
    try {
      const db = currentDb  // reuse existing read-write connection
      db.pragma('journal_mode = DELETE')

      const allKinds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      const deleteKinds = allKinds.filter(k => !keepKinds.includes(k))
      const placeholders = deleteKinds.map(() => '?').join(',')

      const before = db.prepare(`SELECT COUNT(*) as c FROM djmdCue WHERE Kind IN (${placeholders})`).get(...deleteKinds)
      db.prepare(`DELETE FROM djmdCue WHERE Kind IN (${placeholders})`).run(...deleteKinds)
      const after = db.prepare('SELECT COUNT(*) as c FROM djmdCue').get()

      reencryptToMaster(currentDecryptedDbPath)

      // Reload (same connection)
      const result = await loadAllTracksWithCues(db)
      tracks = result.tracks
      anlzPaths = result.anlzPaths

      console.log(`[bulk] Deleted ${before.c} cues, ${after.c} remaining`)
      return { ok: true, deleted: before.c, remaining: after.c }
    } catch (err) {
      console.error('[bulk] Error:', err)
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('db:fixBarAlignment', async (_e, { trackId }) => {
    try {
      const relPath = anlzPaths.get(trackId) ?? anlzPaths.get(Number(trackId))
      if (!relPath) return { ok: false, error: 'No ANLZ path for this track' }

      const fullPath = resolveAnlzPath(relPath)
      const fixed = fixBarAlignment(fullPath)

      // Update in-memory beats for the track so the UI reflects the change
      if (fixed) {
        const track = tracks.find(t => t.id === trackId || t.id === Number(trackId))
        if (track && track.beats) {
          const firstBn = track.beats[0].beatNumber
          for (const b of track.beats) {
            b.beatNumber = ((b.beatNumber - firstBn + 4) % 4) + 1
          }
        }
      }

      return { ok: true, fixed }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('db:fixBarByHotcue', async (_e, { trackIds, reference }) => {
    try {
      let fixedCount = 0
      for (const trackId of trackIds) {
        const track = tracks.find(t => t.id === trackId || t.id === Number(trackId))
        if (!track) continue

        // Resolve reference to a position in ms
        let posMs = null
        if (reference.startsWith('hc:')) {
          const slot = reference.slice(3)
          const hc = (track.hotcues ?? []).find(h => h.slot === slot)
          if (!hc) continue
          posMs = hc.positionMs
        } else if (reference === 'mem:first') {
          const sorted = (track.memoryCues ?? []).sort((a, b) => a.positionMs - b.positionMs)
          if (!sorted.length) continue
          posMs = sorted[0].positionMs
        } else if (reference === 'mem:last') {
          const sorted = (track.memoryCues ?? []).sort((a, b) => a.positionMs - b.positionMs)
          if (!sorted.length) continue
          posMs = sorted[sorted.length - 1].positionMs
        } else if (reference === 'pos:start') {
          posMs = 0
        } else if (reference === 'pos:end') {
          posMs = (track.duration ?? 0) * 1000
        } else {
          continue
        }

        const relPath = anlzPaths.get(trackId) ?? anlzPaths.get(Number(trackId))
        if (!relPath) continue

        const fullPath = resolveAnlzPath(relPath)
        const fixed = fixBarAlignmentByPosition(fullPath, posMs)
        if (fixed) {
          // Update in-memory beats so UI reflects the change
          if (track.beats && track.beats.length > 0) {
            // Find closest beat to the reference position
            let closestIdx = 0
            let closestDist = Infinity
            for (let i = 0; i < track.beats.length; i++) {
              const dist = Math.abs(track.beats[i].timeMs - posMs)
              if (dist < closestDist) { closestDist = dist; closestIdx = i }
            }
            const targetBn = track.beats[closestIdx].beatNumber
            for (const b of track.beats) {
              b.beatNumber = ((b.beatNumber - targetBn + 4) % 4) + 1
            }
          }
          fixedCount++
        }
      }
      return { ok: true, fixedCount }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ── Audio format conversion ──────────────────────────────────────────

  /** Convert rekordbox FolderPath (/F/Music/...) to a real Windows path (F:/Music/...) */
  function rbPathToWin(rbPath) {
    let p = rbPath ?? ''
    const m = p.match(/^\/([A-Za-z])\/(.+)$/)
    if (m) p = `${m[1]}:/${m[2]}`
    return p.split('/').join(path.sep)
  }

  /** Convert a Windows path to rekordbox FolderPath format (D:/path/file.ext) */
  function winPathToRb(winPath) {
    return winPath.split(path.sep).join('/')
  }

  /** Get ffmpeg codec args for a target format */
  function codecArgs(fmt) {
    switch (fmt.toLowerCase()) {
      case 'wav':  return ['-c:a', 'pcm_s24le']
      case 'flac': return ['-c:a', 'flac']
      case 'mp3':  return ['-c:a', 'libmp3lame', '-q:a', '0']
      case 'aiff': return ['-c:a', 'pcm_s24be']
      default: throw new Error(`Unsupported format: ${fmt}`)
    }
  }

  /** Convert a single track. Returns { ok, newPath } or { ok, error }. */
  async function convertSingleTrack({ trackId, targetFormat, deleteOriginal }) {
    const db = currentDb
    if (!db) throw new Error('Database not loaded')

    const row = db.prepare('SELECT FolderPath FROM djmdContent WHERE ID = ?').get(trackId)
    if (!row) return { ok: false, error: `Track ${trackId} not found in database` }

    const oldRbPath = row.FolderPath
    const oldWinPath = rbPathToWin(oldRbPath)

    if (!fs.existsSync(oldWinPath))
      return { ok: false, error: `Source file not found: ${oldWinPath}` }

    // Build new path with target extension
    const ext = targetFormat.toLowerCase()
    const parsed = path.parse(oldWinPath)
    if (parsed.ext.toLowerCase() === `.${ext}`)
      return { ok: false, error: `Track is already in ${targetFormat} format` }

    const newWinPath = path.join(parsed.dir, `${parsed.name}.${ext}`)
    const newRbPath = winPathToRb(newWinPath)

    // Run ffmpeg — copy all metadata from source
    const args = ['-i', oldWinPath, ...codecArgs(ext), '-map_metadata', '0', '-y', newWinPath]
    console.log('[convert] ffmpeg', args.join(' '))

    await new Promise((resolve, reject) => {
      execFile(ffmpegPath, args, { timeout: 600_000 }, (err, _stdout, stderr) => {
        if (err) {
          console.error('[convert] ffmpeg error:', stderr)
          reject(new Error(`ffmpeg failed: ${err.message}`))
        } else {
          resolve()
        }
      })
    })

    if (!fs.existsSync(newWinPath))
      return { ok: false, error: 'Conversion completed but output file not found' }

    // Get new file size
    const newFileSize = fs.statSync(newWinPath).size

    // Determine rekordbox FileType code
    const FILE_TYPE_MAP = { wav: 11, flac: 5, mp3: 1, aiff: 4, aif: 4, m4a: 12, aac: 12 }
    const newFileType = FILE_TYPE_MAP[ext] ?? 0

    // Build new filename
    const newFileName = `${parsed.name}.${ext}`

    // Stage the changes — NOT saved to DB until user clicks "Save to rekordbox"
    if (!pendingConversions) pendingConversions = {}
    pendingConversions[trackId] = {
      oldRbPath,
      newRbPath,
      oldWinPath,
      newWinPath,
      newFileName,
      newFileType,
      newFileSize,
      deleteOriginal: !!deleteOriginal,
    }
    console.log('[convert] Staged:', oldRbPath, '→', newRbPath, '(not saved to DB yet)')

    // Update in-memory track data for UI display
    const track = tracks.find(t => t.id === trackId || t.id === String(trackId))
    if (track) track.filePath = newRbPath

    return { ok: true, newPath: newRbPath }
  }

  ipcMain.handle('audio:convert', async (_e, opts) => {
    try {
      return await convertSingleTrack(opts)
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('audio:convertBulk', async (_e, { trackIds, sourceFormat, targetFormat, deleteOriginal }) => {
    try {
      const db = currentDb
      if (!db) return { ok: false, error: 'Database not loaded' }

      // Resolve which tracks to convert
      let ids = trackIds ?? []
      if ((!ids || ids.length === 0) && sourceFormat) {
        // Find all tracks matching the source format
        const srcExt = `.${sourceFormat.toLowerCase()}`
        ids = tracks
          .filter(t => (t.filePath ?? '').toLowerCase().endsWith(srcExt))
          .map(t => t.id)
      }
      if (ids.length === 0) return { ok: false, error: 'No tracks to convert' }

      const results = []
      for (let i = 0; i < ids.length; i++) {
        const result = await convertSingleTrack({ trackId: ids[i], targetFormat, deleteOriginal })
        results.push({ trackId: ids[i], ...result })
        // Send progress to renderer
        mainWindow?.webContents.send('audio:convertProgress', {
          current: i + 1,
          total: ids.length,
          trackId: ids[i],
          ok: result.ok,
        })
      }

      const succeeded = results.filter(r => r.ok).length
      const failed = results.filter(r => !r.ok).length
      return { ok: true, succeeded, failed, results }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('file:readAudio', async (_e, filePath) => {
    try {
      let p = filePath ?? ''
      const driveMatch = p.match(/^\/([A-Za-z])\/(.+)$/)
      if (driveMatch) p = `${driveMatch[1]}:/${driveMatch[2]}`
      p = p.split('/').join(path.sep)
      if (!fs.existsSync(p)) return { ok: false, error: `File not found: ${p}` }
      const stat = fs.statSync(p)
      if (stat.size > 150 * 1024 * 1024) return { ok: false, error: 'File too large (>150 MB)' }
      const buf = fs.readFileSync(p)
      return { ok: true, data: buf }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })
}

app.whenReady().then(async () => {
  SESSION_PATH = join(app.getPath('userData'), 'session.json')
  registerIpc()
  createWindow()

  // Wait for renderer to be ready, then start loading with progress
  mainWindow?.webContents.once('did-finish-load', async () => {
    const sendProgress = (data) => mainWindow?.webContents.send('db:progress', data)
    try {
      await loadLocalDb(sendProgress)
      mainWindow?.webContents.send('db:loaded', { trackCount: tracks.length })
    } catch (err) {
      console.error('Auto-load failed:', err.message)
      mainWindow?.webContents.send('db:error', { error: err.message })
    }
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
