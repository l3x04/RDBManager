# RDBManager

**rekordbox database manager for DJs — automate cue points, fix beat grids, convert formats**

A free, open-source Electron desktop app that reads and writes the rekordbox 6.x local database (SQLCipher 4 encrypted) so you can manage cues, BPM, beat grids, and audio format conversion — without a subscription.

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

> Changes stay in the app as a preview until you explicitly save. Nothing touches your database until you say so.

---

## Getting Started

1. Download the latest release from **Releases**.
2. Extract the archive and run **RDBManager.exe**.
3. The app will auto-detect your rekordbox database location.
4. **Close rekordbox** before saving any changes.
5. **Back up your database first** — copy your `master.db` somewhere safe before you start.

---

## Using Each Feature

### Cue Generator

The cue generator lets you define **rule sets** — templates that place hotcues and memory cues at bar offsets relative to a base cue.

**How rule sets work:**
- Pick a **base hotcue** (e.g. Hotcue D) that already exists on your tracks.
- Define **offsets** in bars from that base position.
- Each offset creates a new hotcue or memory cue with the colour and label you specify.

**Example:**
1. Set the base to **Hotcue D**.
2. Add a rule: **Hotcue H** at **+4 bars**.
3. Add another rule: **Memory Cue** at **-8 bars**.
4. Click **Generate** — the app calculates positions for every selected track.

Generated cues appear as a **preview** in the track list. They are not written to rekordbox until you click **Save to rekordbox**.

### Bar Position Fixer

Fixes the bar alignment of the beat grid without changing the BPM or beat positions.

**What it does:** Moves the "bar 1" marker so that your reference point lands on a downbeat (beat 1 of a bar). Every other bar in the track shifts accordingly.

**When to use it:** The beat grid is correct (beats land on transients), but the bar numbering is off — e.g. the drop starts on beat 3 instead of beat 1.

**Example:**
1. Select all tracks you want to fix.
2. Choose a reference point — e.g. **Hotcue D**.
3. Click **Fix Bars**.
4. Bar 1 snaps to the position of Hotcue D on every selected track.

You can also align to a memory cue or a specific track position.

### Format Conversion

Convert audio files between formats without leaving the app. Powered by FFmpeg.

**Supported formats:** WAV, FLAC, MP3, AIFF

**Two modes:**
- **By Selection** — convert only the tracks you have selected.
- **By Format** — convert all tracks of a given format (e.g. all WAVs to FLAC).

**Details:**
- Metadata (tags, artwork) is preserved during conversion.
- New files are created alongside the originals. You can optionally delete the originals.
- After converting, you must **Save to rekordbox** so the database points to the new files.

### BPM Tools

- **Double BPM** — doubles the BPM value for all selected tracks (e.g. 85 becomes 170).
- **Halve BPM** — halves the BPM value for all selected tracks (e.g. 170 becomes 85).
- **Manual override** — set an exact BPM value on a per-track basis.

All BPM changes update the beat grid accordingly.

### Waveform & Playback

- **Click** on the waveform to seek to that position.
- **Drag** to scroll through the track.
- **Scroll wheel** to zoom in and out.
- The **green playhead** shows the current playback position.
- **Beat grid overlay** — grey lines mark individual beats, red lines mark bar downbeats.

---

## Important Notes

- **ALWAYS back up your rekordbox database** before making changes. Copy `master.db` to a safe location.
- **Close rekordbox** before clicking Save. Writing to the database while rekordbox is open can cause conflicts.
- **Changes are preview-only** until you click **Save to rekordbox**. You can freely experiment without risk.
- **Format conversion** creates new files alongside originals — originals are not overwritten unless you choose to delete them.
- **Tested with rekordbox 6.x.** May work with 7.x but this has not been verified.

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
