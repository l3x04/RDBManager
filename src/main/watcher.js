// src/main/watcher.js
import fs from 'fs'
import path from 'path'

export function watchInputFolder(inputDir, onDbFound) {
  if (!fs.existsSync(inputDir)) return

  // Fire immediately for any existing .zip file
  const existing = fs.readdirSync(inputDir).find(f => f.endsWith('.zip'))
  if (existing) onDbFound(path.join(inputDir, existing))

  // Watch for new files dropped in
  const debounceTimers = new Map()

  const watcher = fs.watch(inputDir, (_event, filename) => {
    if (!filename?.endsWith('.zip')) return
    const full = path.join(inputDir, filename)
    // Debounce per-filename to handle Windows duplicate events
    if (debounceTimers.has(filename)) clearTimeout(debounceTimers.get(filename))
    debounceTimers.set(filename, setTimeout(() => {
      debounceTimers.delete(filename)
      if (fs.existsSync(full)) onDbFound(full)
    }, 300))
  })

  return watcher  // caller can call .close() to stop watching
}
