// src/main/session.js
import fs from 'fs'

export const DEFAULT_SESSION = {
  ruleSets: [],
  selectedTrackIds: [],
  trackAdjustments: {},
  lastDbPath: null,
}

export function readSession(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return { ...DEFAULT_SESSION, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SESSION }
  }
}

export function writeSession(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    throw new Error(`Failed to write session: ${err.message}`)
  }
}
