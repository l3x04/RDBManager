import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'
import { openDb, loadAllTracksWithCues, loadWaveform, extractAndDecryptZip } from './db.js'
import { readSession, writeSession, DEFAULT_SESSION } from './session.js'
import { watchInputFolder } from './watcher.js'
import { generateOutputDb } from './dbWrite.js'
import { generateCueWrites } from '../renderer/utils/cueCalc.js'

// Module-level state
let currentDb = null
let tracks = []
let currentDbPath = null
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

async function loadDbFromPath(filePath) {
  if (currentDb) {
    try { currentDb.close() } catch { /* ignore */ }
    currentDb = null
  }
  // Clean up previous temp decrypted file
  if (tempDbPath) {
    try { fs.unlinkSync(tempDbPath) } catch { /* ignore */ }
    tempDbPath = null
  }

  let dbPath = filePath
  if (filePath.endsWith('.zip')) {
    dbPath = await extractAndDecryptZip(filePath)
    tempDbPath = dbPath
  }

  currentDb = openDb(dbPath)
  tracks = loadAllTracksWithCues(currentDb)
  currentDbPath = filePath
  currentDecryptedDbPath = dbPath
  return tracks.length
}

function registerIpc() {
  ipcMain.handle('db:load', async (_e, filePath) => {
    try {
      const count = await loadDbFromPath(filePath)
      return { ok: true, count }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('db:reload', async (_e, filePath) => {
    try {
      const count = await loadDbFromPath(filePath ?? currentDbPath)
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

  ipcMain.handle('generate', async (_e, { selectedTrackIds, ruleSets, trackAdjustments, sourceDbPath }) => {
    try {
      const writes = generateCueWrites({
        tracks,
        selectedTrackIds: new Set(selectedTrackIds),
        ruleSets,
        trackAdjustments,
      })
      const outputDir = app.isPackaged
        ? path.join(path.dirname(app.getPath('exe')), "Lex's Cue Editor", 'Backup_Output')
        : path.join(app.getAppPath(), "Lex's Cue Editor", 'Backup_Output')
      fs.mkdirSync(outputDir, { recursive: true })
      const outPath = generateOutputDb(currentDecryptedDbPath, outputDir, writes)

      const tracksProcessed = new Set(writes.map(w => w.trackId)).size
      return { ok: true, tracksProcessed, cuesWritten: writes.length, tracksSkipped: selectedTrackIds.length - tracksProcessed, outPath }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('file:readAudio', async (_e, filePath) => {
    try {
      // Normalise path — rekordbox may use forward slashes or /Drive/... notation
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

app.whenReady().then(() => {
  SESSION_PATH = join(app.getPath('userData'), 'session.json')
  registerIpc()
  createWindow()

  // Watch Backup_Input for .zip files
  // In dev: app.getAppPath() = CUEEDITOR root, which contains "Lex's Cue Editor/"
  // In production (packaged): this path will need to be updated to point to the
  // directory alongside the .exe (e.g. path.dirname(app.getPath('exe')))
  const inputDir = join(app.getAppPath(), "Lex's Cue Editor", 'Backup_Input')
  watchInputFolder(inputDir, async (dbPath) => {
    try {
      await loadDbFromPath(dbPath)
      mainWindow?.webContents.send('db:loaded', { dbPath, trackCount: tracks.length })
    } catch (err) {
      console.error('Failed to load DB from watcher:', err.message)
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
