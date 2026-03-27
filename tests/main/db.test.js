// @vitest-environment node
import Database from 'better-sqlite3'
import { loadTracks, loadCues, loadAllTracksWithCues, loadWaveform } from '../../src/main/db.js'

function makeTestDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE djmdContent (
      ID VARCHAR(255) PRIMARY KEY,
      Title TEXT,
      ArtistID VARCHAR(255),
      KeyID VARCHAR(255),
      BPM INTEGER,
      Length INTEGER,
      FolderPath TEXT
    );
    CREATE TABLE djmdArtist (ID VARCHAR(255) PRIMARY KEY, Name TEXT);
    CREATE TABLE djmdKey (ID VARCHAR(255) PRIMARY KEY, ScaleName TEXT);
    INSERT INTO djmdArtist VALUES ('a1', 'Test Artist');
    INSERT INTO djmdArtist VALUES ('a2', 'DJ Test');
    INSERT INTO djmdKey VALUES ('k1', '8A');
    INSERT INTO djmdKey VALUES ('k2', '11B');
    INSERT INTO djmdContent VALUES ('1', 'Test Track', 'a1', 'k1', 12800, 240, '/music/track.mp3');
    INSERT INTO djmdContent VALUES ('2', 'Another Track', 'a2', 'k2', 13250, 360, '/music/other.mp3');
  `)
  return db
}

describe('loadTracks', () => {
  it('returns tracks with correct fields', () => {
    const db = makeTestDb()
    const tracks = loadTracks(db)
    expect(tracks).toHaveLength(2)
    expect(tracks[0]).toMatchObject({
      id: '1',
      title: 'Test Track',
      artist: 'Test Artist',
      bpm: 128.0,
      key: '8A',
      duration: 240,
      filePath: '/music/track.mp3',
      hotcues: [],
      memoryCues: [],
      waveformData: null,
    })
  })

  it('converts BPM from integer×100 to float', () => {
    const db = makeTestDb()
    const tracks = loadTracks(db)
    expect(tracks[1].bpm).toBe(132.5)
  })
})

function makeTestDbWithCues() {
  const db = makeTestDb()
  db.exec(`
    CREATE TABLE djmdCue (
      ID VARCHAR(255) PRIMARY KEY,
      ContentID VARCHAR(255),
      InMsec INTEGER,
      Kind INTEGER,
      Color INTEGER DEFAULT -1,
      ColorTableIndex INTEGER,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    );
    -- Kind=5 = slot D, Kind=1 = slot A, Kind=0 = memory cue
    INSERT INTO djmdCue VALUES ('c1', '1', 32000, 5,  -1, 4,   datetime('now'), datetime('now'));
    INSERT INTO djmdCue VALUES ('c2', '1', 5000,  0,  -1, null, datetime('now'), datetime('now'));
    INSERT INTO djmdCue VALUES ('c3', '1', 16000, 1,  -1, 1,   datetime('now'), datetime('now'));
  `)
  return db
}

describe('loadCues', () => {
  it('separates hotcues and memory cues by Kind', () => {
    const db = makeTestDbWithCues()
    const cues = loadCues(db, '1')
    expect(cues.hotcues).toHaveLength(2)
    expect(cues.memoryCues).toHaveLength(1)
  })

  it('maps hotcue slot from Kind value', () => {
    const db = makeTestDbWithCues()
    const { hotcues } = loadCues(db, '1')
    const d = hotcues.find(h => h.slot === 'D')
    expect(d).toMatchObject({ slot: 'D', positionMs: 32000 })
    const a = hotcues.find(h => h.slot === 'A')
    expect(a).toMatchObject({ slot: 'A', positionMs: 16000 })
  })

  it('maps memory cue fields correctly', () => {
    const db = makeTestDbWithCues()
    const { memoryCues } = loadCues(db, '1')
    expect(memoryCues[0]).toMatchObject({ positionMs: 5000 })
  })
})

describe('loadAllTracksWithCues', () => {
  it('loads tracks with cues populated', () => {
    const db = makeTestDbWithCues()
    const tracks = loadAllTracksWithCues(db)
    expect(tracks).toHaveLength(2)
    expect(tracks[0].hotcues).toHaveLength(2)
    expect(tracks[0].memoryCues).toHaveLength(1)
  })
})

describe('loadWaveform', () => {
  it('returns null (waveform data is not stored in the backup DB)', () => {
    const db = makeTestDb()
    const data = loadWaveform(db, '1')
    expect(data).toBeNull()
  })
})
