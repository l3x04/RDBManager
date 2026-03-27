import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { SLOT_TO_KIND } from './db.js'

const CUE_TABLE = 'djmdCue'

// Map app hex colours to rekordbox ColorTableIndex (0–7)
const COLOUR_TO_INDEX = {
  '#ff375f': 0, '#ff453a': 1, '#ff9f0a': 2, '#ffd60a': 3,
  '#30d158': 4, '#64d2ff': 5, '#0a84ff': 6, '#bf5af2': 7,
}

export function applyWritesToDb(db, writes) {
  // Get max existing ID to generate new unique numeric IDs
  const maxRow = db.prepare(`SELECT MAX(CAST(ID AS INTEGER)) AS maxId FROM ${CUE_TABLE}`).get()
  let nextId = (maxRow?.maxId ?? 0) + 1

  const deleteByKind = db.prepare(
    `DELETE FROM ${CUE_TABLE} WHERE ContentID = ? AND Kind = ?`
  )
  const insertCue = db.prepare(
    `INSERT INTO ${CUE_TABLE} (ID, ContentID, InMsec, InFrame, OutMsec, Kind, Color, ColorTableIndex, created_at, updated_at)
     VALUES (?, ?, ?, ?, -1, ?, -1, ?, datetime('now'), datetime('now'))`
  )

  const run = db.transaction(() => {
    for (const w of writes) {
      if (w.type === 'hotcue') {
        const kind = SLOT_TO_KIND[w.slot]
        if (!kind) continue
        deleteByKind.run(w.trackId, kind)
        insertCue.run(
          String(nextId++),
          w.trackId,
          w.positionMs,
          Math.round(w.positionMs / 1000 * 150), // InFrame at 150fps
          kind,
          COLOUR_TO_INDEX[w.colour?.toLowerCase()] ?? null
        )
      } else {
        // Memory cue: Kind=0, no slot
        insertCue.run(
          String(nextId++),
          w.trackId,
          w.positionMs,
          Math.round(w.positionMs / 1000 * 150),
          0,
          COLOUR_TO_INDEX[w.colour?.toLowerCase()] ?? null
        )
      }
    }
  })
  run()
}

export function generateOutputDb(sourceDbPath, outputDir, writes) {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 19).replace(/:/g, '')
  const timestamp = `${date}_${time}`
  const outName = `rekordbox_${timestamp}.db`
  const outPath = path.join(outputDir, outName)

  fs.copyFileSync(sourceDbPath, outPath)

  const db = new Database(outPath)
  try {
    applyWritesToDb(db, writes)
  } finally {
    db.close()
  }

  return outPath
}
