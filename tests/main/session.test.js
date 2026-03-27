// @vitest-environment node
import { readSession, writeSession, DEFAULT_SESSION } from '../../src/main/session.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('session', () => {
  let tmpPath

  beforeEach(() => {
    tmpPath = path.join(os.tmpdir(), `session-test-${Date.now()}.json`)
  })

  it('returns DEFAULT_SESSION when file does not exist', () => {
    const result = readSession('/nonexistent/path.json')
    expect(result).toEqual(DEFAULT_SESSION)
  })

  it('writes and reads back session data', () => {
    const data = { ...DEFAULT_SESSION, lastDbPath: '/some/db.db' }
    writeSession(tmpPath, data)
    const result = readSession(tmpPath)
    expect(result.lastDbPath).toBe('/some/db.db')
  })
})
