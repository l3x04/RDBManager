// tests/main/dbWrite.test.js
// @vitest-environment node
import Database from 'better-sqlite3'
import { applyWritesToDb } from '../../src/main/dbWrite.js'

function makeOutputDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE djmdContent (ID VARCHAR(255) PRIMARY KEY, Title TEXT, BPM INTEGER, Length INTEGER);
    CREATE TABLE djmdCue (
      ID VARCHAR(255) PRIMARY KEY,
      ContentID VARCHAR(255),
      InMsec INTEGER,
      InFrame INTEGER,
      OutMsec INTEGER DEFAULT -1,
      Kind INTEGER,
      Color INTEGER DEFAULT -1,
      ColorTableIndex INTEGER,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    );
    INSERT INTO djmdContent VALUES ('1', 'Test Track', 12800, 240);
  `)
  return db
}

describe('applyWritesToDb', () => {
  it('inserts a hotcue row with correct Kind for slot A', () => {
    const db = makeOutputDb()
    applyWritesToDb(db, [
      { trackId: '1', type: 'hotcue', slot: 'A', positionMs: 10000, colour: '#ff453a' }
    ])
    const rows = db.prepare('SELECT * FROM djmdCue WHERE ContentID = ?').all('1')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ ContentID: '1', InMsec: 10000, Kind: 1 })
  })

  it('inserts hotcue with correct Kind for slot D (Kind=5)', () => {
    const db = makeOutputDb()
    applyWritesToDb(db, [
      { trackId: '1', type: 'hotcue', slot: 'D', positionMs: 32000, colour: '#30d158' }
    ])
    const rows = db.prepare('SELECT * FROM djmdCue WHERE ContentID = ?').all('1')
    expect(rows[0]).toMatchObject({ Kind: 5, InMsec: 32000 })
  })

  it('inserts memory cue with Kind=0', () => {
    const db = makeOutputDb()
    applyWritesToDb(db, [
      { trackId: '1', type: 'memory', slot: null, positionMs: 5000, colour: '#ffd60a' }
    ])
    const rows = db.prepare('SELECT * FROM djmdCue WHERE ContentID = ?').all('1')
    expect(rows[0]).toMatchObject({ Kind: 0, InMsec: 5000 })
  })

  it('replaces existing hotcue at same slot by deleting prior row', () => {
    const db = makeOutputDb()
    // Pre-insert a Kind=1 (slot A) cue
    db.exec(`INSERT INTO djmdCue VALUES ('existing', '1', 1000, 150, -1, 1, -1, null, datetime('now'), datetime('now'))`)
    applyWritesToDb(db, [
      { trackId: '1', type: 'hotcue', slot: 'A', positionMs: 20000, colour: '#ff453a' }
    ])
    const rows = db.prepare('SELECT * FROM djmdCue WHERE ContentID = ? AND Kind = 1').all('1')
    expect(rows).toHaveLength(1)
    expect(rows[0].InMsec).toBe(20000)
  })
})
