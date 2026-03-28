import Database from 'better-sqlite3'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { SLOT_TO_KIND } from './db.js'

const CUE_TABLE = 'djmdCue'

// App hex colours → rekordbox ColorTableIndex (confirmed from actual rb cues)
const COLOUR_TO_INDEX = {
  '#305aff': 1,
  '#50b4ff': 5,
  '#00e0ff': 9,
  '#10b176': 18,
  '#28e214': 22,
  '#a5e116': 26,
  '#b4be04': 30,
  '#c3af04': 32,
  '#e0641b': 38,
  '#e62828': 42,
  '#ff127b': 45,
  '#de44cf': 49,
  '#b432ff': 56,
  '#aa72ff': 60,
  '#6473ff': 62,
}

export function applyBpmOverrides(db, trackAdjustments) {
  const updateBpm = db.prepare(`UPDATE djmdContent SET BPM = ?, updated_at = datetime('now') WHERE ID = ?`)
  const run = db.transaction(() => {
    for (const [trackId, adj] of Object.entries(trackAdjustments)) {
      if (adj.bpmOverride != null && adj.bpmOverride > 0) {
        updateBpm.run(Math.round(adj.bpmOverride * 100), trackId)
      }
    }
  })
  run()
}

// Look up ContentUUID from djmdContent for a given track ID
function getContentUUID(db, trackId) {
  const row = db.prepare(`SELECT UUID FROM djmdContent WHERE ID = ?`).get(trackId)
  return row?.UUID ?? null
}

function newUUID() {
  return crypto.randomUUID()
}

export function applyWritesToDb(db, writes) {
  const maxRow = db.prepare(`SELECT MAX(CAST(ID AS INTEGER)) AS maxId FROM ${CUE_TABLE}`).get()
  let nextId = (maxRow?.maxId ?? 0) + 1

  const deleteByKind = db.prepare(
    `DELETE FROM ${CUE_TABLE} WHERE ContentID = ? AND Kind = ?`
  )
  const insertCue = db.prepare(
    `INSERT INTO ${CUE_TABLE} (ID, ContentID, InMsec, InFrame, InMpegFrame, InMpegAbs, OutMsec, OutFrame, OutMpegFrame, OutMpegAbs, Kind, Color, ColorTableIndex, ContentUUID, UUID, rb_data_status, rb_local_data_status, rb_local_deleted, rb_local_synced, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 0, -1, 0, 0, 0, ?, -1, ?, ?, ?, 0, 0, 0, 0, datetime('now'), datetime('now'))`
  )

  // Cache ContentUUIDs
  const uuidCache = new Map()
  const getUUID = (trackId) => {
    if (!uuidCache.has(trackId)) uuidCache.set(trackId, getContentUUID(db, trackId))
    return uuidCache.get(trackId)
  }

  const run = db.transaction(() => {
    for (const w of writes) {
      const contentUUID = getUUID(w.trackId)
      if (w.type === 'hotcue') {
        const kind = SLOT_TO_KIND[w.slot]
        if (!kind) continue
        deleteByKind.run(w.trackId, kind)
        insertCue.run(
          String(nextId++), w.trackId, w.positionMs,
          Math.round(w.positionMs / 1000 * 150),
          kind, COLOUR_TO_INDEX[w.colour?.toLowerCase()] ?? null,
          contentUUID, newUUID()
        )
      } else {
        insertCue.run(
          String(nextId++), w.trackId, w.positionMs,
          Math.round(w.positionMs / 1000 * 150),
          0, COLOUR_TO_INDEX[w.colour?.toLowerCase()] ?? null,
          contentUUID, newUUID()
        )
      }
    }
  })
  run()
}

export function applyCueOverrides(db, cueOverrides) {
  const deleteAll = db.prepare(`DELETE FROM ${CUE_TABLE} WHERE ContentID = ?`)
  const insertCue = db.prepare(
    `INSERT INTO ${CUE_TABLE} (ID, ContentID, InMsec, InFrame, InMpegFrame, InMpegAbs, OutMsec, OutFrame, OutMpegFrame, OutMpegAbs, Kind, Color, ColorTableIndex, ContentUUID, UUID, rb_data_status, rb_local_data_status, rb_local_deleted, rb_local_synced, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 0, -1, 0, 0, 0, ?, -1, ?, ?, ?, 0, 0, 0, 0, datetime('now'), datetime('now'))`
  )

  const maxRow = db.prepare(`SELECT MAX(CAST(ID AS INTEGER)) AS maxId FROM ${CUE_TABLE}`).get()
  let nextId = (maxRow?.maxId ?? 0) + 1

  const run = db.transaction(() => {
    for (const [trackId, cues] of Object.entries(cueOverrides)) {
      const contentUUID = getContentUUID(db, trackId)
      deleteAll.run(trackId)

      for (const hc of (cues.hotcues ?? [])) {
        const kind = SLOT_TO_KIND[hc.slot]
        if (!kind) continue
        insertCue.run(
          String(nextId++), trackId, hc.positionMs,
          Math.round(hc.positionMs / 1000 * 150),
          kind, COLOUR_TO_INDEX[hc.colour?.toLowerCase()] ?? null,
          contentUUID, newUUID()
        )
      }

      for (const mc of (cues.memoryCues ?? [])) {
        insertCue.run(
          String(nextId++), trackId, mc.positionMs,
          Math.round(mc.positionMs / 1000 * 150),
          0, COLOUR_TO_INDEX[mc.colour?.toLowerCase()] ?? null,
          contentUUID, newUUID()
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
