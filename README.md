# RDBManager

**rekordbox database manager for DJs — automate cue points, fix beat grids, convert formats**

---

## BACK UP BEFORE YOU DO ANYTHING

**This software directly modifies your rekordbox database and, if you use format conversion, your actual music files. If something goes wrong, your library data (cues, playlists, ratings, grid positions) could be lost or corrupted — and if you use the "delete originals" option during conversion, your original audio files will be permanently gone.**

### Back up your database

Before using RDBManager for the first time — and ideally before each session — **make a copy of your rekordbox database:**

1. Close rekordbox completely
2. Navigate to `%APPDATA%\Pioneer\rekordbox\`
3. Copy `master.db` to a safe location (e.g. a "backups" folder on your desktop)

If anything ever goes wrong, you can restore by copying that file back.

### Back up your music files (if using conversion)

Format conversion is a **beta feature**. If you plan to convert files (e.g. FLAC to WAV) and especially if you plan to use the "delete originals" option, **back up your music library first.** Copy your music folders to an external drive or a separate location on disk. Conversion creates new files alongside the originals, but if something goes wrong mid-conversion or with the database path update, you want to be able to recover.

### General safety notes

- Always close rekordbox before clicking "Save to rekordbox" in RDBManager
- Changes are preview-only until you explicitly save — you can experiment freely
- The app creates a `.bak` file each time it saves, but don't rely on this as your only backup
- Beat grid fixes (Bar Position Fixer) write to ANLZ files immediately and cannot be undone without a backup
- Format conversion creates new audio files on disk immediately, but the database path update waits for save

**If rekordbox won't open after saving:** restore your backed-up `master.db` file to `%APPDATA%\Pioneer\rekordbox\` and delete any `.wal` and `.shm` files in that folder.

---

## Features

- **Direct read/write** to the rekordbox 6.x encrypted database (SQLCipher 4)
- **Waveform display** with beat grid overlay from ANLZ analysis files
- **Audio playback** with click-to-seek
- **Rule-based cue generation** — build hotcue and memory cue sets from templates
- **Manual cue editing** with all 16 rekordbox colours
- **BPM tools** — override, double, or halve BPM (single or bulk)
- **Beat grid bar alignment** — snap bar 1 to any hotcue, memory cue, or arbitrary position
- **Audio format conversion** (WAV, FLAC, MP3, AIFF) via FFmpeg
- **Save changes back** to rekordbox with one click
- **Update checker** — get notified when a new version is available
- **Dark UI** matching the rekordbox aesthetic

---

## How It Works

1. **Read** — RDBManager locates and decrypts your local rekordbox `master.db` file, then reads the associated ANLZ files for beat grids and waveform data.
2. **Edit** — Make changes in the app: add or move cues, adjust BPM, fix bar alignment, queue format conversions.
3. **Save** — Click **Save to rekordbox** to write all changes back to the database.
4. **Restart rekordbox** — Reopen rekordbox and your changes will be there.

> Changes stay in the app as a preview until you explicitly save. Nothing touches your database until you say so (except beat grid fixes and file conversion — see notes above).

---

## Getting Started

1. Download the latest release from **Releases**.
2. Extract the archive and run **RDBManager.exe**.
3. The app will auto-detect your rekordbox database location.
4. **Close rekordbox** before saving any changes.
5. **Back up your database first** — seriously, do it.

---

## Using Each Feature

### Cue Generator

The cue generator lets you define **rule sets** — templates that place hotcues and memory cues at bar offsets relative to a base cue.

**How rule sets work:**
- Pick a **base hotcue** (e.g. Hotcue D) that already exists on your tracks.
- Define **offsets** in bars from that base position.
- Each offset creates a new hotcue or memory cue with the colour and label you specify.
- If a track doesn't have the base hotcue, it's skipped.
- If a generated cue falls outside the track, it's skipped.
- If a generated cue targets a slot that already exists, it replaces the existing one.

**Example:**
1. Set the base to **Hotcue D**.
2. Add a rule: **Hotcue H** at **+4 bars**.
3. Add another rule: **Memory Cue** at **-8 bars**.
4. Click **Generate** — the app calculates positions for every selected track.

Generated cues appear as a **preview**. They are not written to rekordbox until you click **Save to rekordbox**.

### Bar Position Fixer

Fixes the bar alignment of the beat grid without changing the BPM or beat positions.

**What it does:** Moves the "bar 1" marker so that your reference point lands on a downbeat (beat 1 of a bar). Every other bar in the track shifts accordingly.

**When to use it:** The beat grid is correct (beats land on transients), but the bar numbering is off — e.g. the drop starts on beat 3 instead of beat 1.

**Example:**
1. Select all tracks you want to fix.
2. Choose a reference point — e.g. **Hotcue D**.
3. Click **Fix Bars**.
4. Bar 1 snaps to the position of Hotcue D on every selected track.

You can also align to a memory cue, song start, or song end.

**Note:** Bar fixes write to ANLZ files immediately — they don't wait for "Save to rekordbox". Make sure you have a backup.

### Format Conversion (Beta)

Convert audio files between formats without leaving the app. Powered by FFmpeg.

**This feature is in beta.** It has worked reliably in testing, but given that it creates/deletes files on disk and modifies database paths, **always have a backup before using it.** If something goes wrong with the database path, you can use rekordbox's "relocate" feature to manually point tracks to the correct files.

**Supported formats:** WAV, FLAC, MP3, AIFF

**Two modes:**
- **By Selection** — convert only the tracks you have selected.
- **By Format** — convert all tracks of a given format (e.g. all FLACs to WAV).

**Details:**
- Metadata (tags, artwork) is preserved during conversion.
- New files are created alongside the originals with the new extension.
- You can optionally delete the originals (a warning will appear).
- After converting, you must **Save to rekordbox** so the database points to the new files.
- If rekordbox says "file not found" after conversion, use rekordbox's relocate feature to point to the new file — it should pick up all cues and metadata automatically.

### BPM Tools

- **Double BPM** — doubles the BPM value for all selected tracks (e.g. 85 becomes 170).
- **Halve BPM** — halves the BPM value for all selected tracks (e.g. 170 becomes 85).
- **Manual override** — set an exact BPM value on a per-track basis.

All BPM changes are saved when you click **Save to rekordbox**.

### Waveform & Playback

- **Click** on the waveform to seek to that position.
- **Drag** to scroll through the track.
- **Scroll wheel** to zoom in and out (up to 128x).
- The **green playhead** shows the current playback position.
- **Beat grid overlay** — grey lines mark individual beats, red lines mark bar downbeats.
- **Hotcue markers** appear as coloured flags at the top of the waveform.
- **Memory cue markers** appear as yellow triangles at the bottom.

---

## Compatibility

- **rekordbox 6.x** — tested and working
- **rekordbox 7.x** — may work (same encryption key is used), but not yet verified
- **Windows 10/11 (x64)** — the only supported platform currently

---

## Building from Source

```bash
npm install
npm run dev          # development with hot reload
npm run build        # production build (compile only)
npm run build:win    # build Windows distributable
```

Requires Node.js and npm. Native dependencies (`better-sqlite3`) are compiled automatically via `electron-builder install-app-deps` during `postinstall`.

---

## Credits

Built by **L£X**
