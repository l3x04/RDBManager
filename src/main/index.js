import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'
import { openDb, loadAllTracksWithCues, decryptLocalDb, writeToRekordbox } from './db.js'
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

function loadLocalDb() {
  if (currentDb) {
    try { currentDb.close() } catch {}
    currentDb = null
  }
  if (tempDbPath) {
    try { fs.unlinkSync(tempDbPath) } catch {}
    tempDbPath = null
  }

  const dbPath = decryptLocalDb()  // throws if not found or decryption fails
  tempDbPath = dbPath
  currentDb = openDb(dbPath)
  const result = loadAllTracksWithCues(currentDb)
  tracks = result.tracks
  anlzPaths = result.anlzPaths
  currentDecryptedDbPath = dbPath
  return tracks.length
}

function registerIpc() {
  ipcMain.handle('db:loadLocal', async () => {
    try {
      const count = loadLocalDb()
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
      const count = loadLocalDb()
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

      writeToRekordbox(currentDecryptedDbPath, writes, null, null)

      const tracksProcessed = new Set(writes.map(w => w.trackId)).size
      return {
        ok: true,
        tracksProcessed,
        cuesWritten: writes.length,
        tracksSkipped: selectedTrackIds.length - tracksProcessed,
      }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('db:saveToRb', async (_e, { selectedTrackIds, ruleSets, trackAdjustments }) => {
    try {
      const writes = (ruleSets && ruleSets.length > 0 && selectedTrackIds && selectedTrackIds.length > 0)
        ? generateCueWrites({
            tracks,
            selectedTrackIds: new Set(selectedTrackIds),
            ruleSets,
            trackAdjustments,
          })
        : []

      // Close readonly DB so the write can proceed without lock conflicts
      if (currentDb) { try { currentDb.close() } catch {} currentDb = null }

      writeToRekordbox(currentDecryptedDbPath, writes, trackAdjustments, anlzPaths)

      // Reopen and reload tracks with updated data
      currentDb = openDb(currentDecryptedDbPath)
      const result = loadAllTracksWithCues(currentDb)
      tracks = result.tracks
      anlzPaths = result.anlzPaths

      const bpmChanges = Object.values(trackAdjustments || {}).filter(a => a.bpmOverride != null).length
      return {
        ok: true,
        cuesWritten: writes.length,
        bpmChanges,
      }
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

  // Auto-load local rekordbox database
  try {
    loadLocalDb()
    mainWindow?.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('db:loaded', { trackCount: tracks.length })
    })
  } catch (err) {
    console.error('Auto-load failed:', err.message)
    mainWindow?.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('db:error', { error: err.message })
    })
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
