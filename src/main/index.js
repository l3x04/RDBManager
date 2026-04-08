import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'
import { openDb, loadAllTracksWithCues, decryptLocalDb, writeToRekordbox, reencryptToMaster } from './db.js'
import { readSession, writeSession, DEFAULT_SESSION } from './session.js'
import { generateCueWrites } from '../renderer/utils/cueCalc.js'

// Module-level state
let currentDb = null
let tracks = []
let anlzPaths = new Map()          // trackId → ANLZ relative path (for writing)
let mainWindow = null
let currentDecryptedDbPath = null  // temp .db path used for output generation
let tempDbPath = null              // temp file to clean up on next load

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
