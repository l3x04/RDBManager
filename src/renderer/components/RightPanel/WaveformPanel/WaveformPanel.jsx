// src/renderer/components/RightPanel/WaveformPanel/WaveformPanel.jsx
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../../store/appStore.js'
import WaveformCanvas from './WaveformCanvas.jsx'
import BeatgridControls from './BeatgridControls.jsx'

const NUM_BARS = 65536 // ~1 peak per display pixel at 64× zoom for a 900px canvas

function extractPeaks(audioBuffer) {
  const ch  = audioBuffer.getChannelData(0)
  const spb = Math.max(1, Math.floor(ch.length / NUM_BARS))
  const out = new Array(NUM_BARS)
  for (let i = 0; i < NUM_BARS; i++) {
    let min = 0, max = 0, sumSq = 0
    const start = i * spb
    const end   = Math.min(start + spb, ch.length)
    for (let j = start; j < end; j++) {
      const v = ch[j]
      if (v > max) max = v
      if (v < min) min = v
      sumSq += v * v
    }
    out[i] = { min, max, rms: Math.sqrt(sumSq / (end - start)) }
  }
  return out
}

export default function WaveformPanel() {
  const focusedId = useAppStore(s => s.focusedTrackId)
  const tracks    = useAppStore(s => s.tracks)
  const adjs      = useAppStore(s => s.trackAdjustments)

  const [zoom, setZoom]         = useState(1)
  const [scrollMs, setScrollMs] = useState(0)
  const [peaks, setPeaks]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const peakCache = useRef(new Map())
  const audioCtx  = useRef(null)

  const track = tracks.find(t => t.id === focusedId) ?? null
  const adj   = track ? (adjs[track.id] ?? { bpmOverride: null, gridOffsetMs: 0 }) : null

  useEffect(() => {
    if (!track) { setPeaks(null); return }
    if (peakCache.current.has(track.id)) { setPeaks(peakCache.current.get(track.id)); return }
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const result = await window.api.readAudioFile(track.filePath)
        if (cancelled || !result.ok) { setLoading(false); return }
        if (!audioCtx.current) audioCtx.current = new AudioContext()
        const raw = result.data
        const ab  = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
        const decoded = await audioCtx.current.decodeAudioData(ab)
        if (cancelled) return
        const p = extractPeaks(decoded)
        peakCache.current.set(track.id, p)
        setPeaks(p)
      } catch (e) {
        console.warn('Waveform load failed:', e.message)
        setPeaks(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [track?.id])

  useEffect(() => { setZoom(1); setScrollMs(0) }, [track?.id])

  const durationMs  = (track?.duration ?? 0) * 1000
  const visibleMs   = durationMs / Math.max(zoom, 1)
  const clampScroll = Math.max(0, Math.min(scrollMs, durationMs - visibleMs))

  const handleZoom = (newZoom, newScroll) => {
    setZoom(Math.max(1, Math.min(64, newZoom)))
    setScrollMs(Math.max(0, newScroll))
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)', background: '#0a0e14' }}>
      {track ? (
        <WaveformCanvas
          track={track}
          peaks={peaks}
          loading={loading}
          gridOffsetMs={adj.gridOffsetMs ?? 0}
          bpmOverride={adj.bpmOverride}
          startMs={clampScroll}
          endMs={clampScroll + visibleMs}
          zoom={zoom}
          scrollMs={clampScroll}
          onScroll={setScrollMs}
          onZoom={handleZoom}
        />
      ) : (
        <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
          Select a track to view waveform
        </div>
      )}
      <BeatgridControls
        track={track}
        zoom={zoom}
        onZoomIn={() => handleZoom(zoom * 2, clampScroll)}
        onZoomOut={() => handleZoom(zoom / 2, clampScroll)}
        scrollMs={clampScroll}
        durationMs={durationMs}
        visibleMs={visibleMs}
        onScroll={setScrollMs}
      />
    </div>
  )
}
