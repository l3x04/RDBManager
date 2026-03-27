// src/renderer/components/RightPanel/WaveformPanel/WaveformPanel.jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../../store/appStore.js'
import WaveformCanvas from './WaveformCanvas.jsx'
import BeatgridControls from './BeatgridControls.jsx'

const NUM_BARS = 65536

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
      if (v > max) max = v; if (v < min) min = v; sumSq += v * v
    }
    out[i] = { min, max, rms: Math.sqrt(sumSq / (end - start)) }
  }
  const audioDurationMs = (spb * NUM_BARS) / audioBuffer.sampleRate * 1000
  return { peaks: out, audioDurationMs }
}

export default function WaveformPanel() {
  const focusedId = useAppStore(s => s.focusedTrackId)
  const tracks    = useAppStore(s => s.tracks)
  const adjs      = useAppStore(s => s.trackAdjustments)

  const [zoom, setZoom]           = useState(1)
  const [scrollMs, setScrollMs]   = useState(0)
  const [peaks, setPeaks]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playheadMs, setPlayheadMs] = useState(0)

  const peakCache      = useRef(new Map())
  const audioCtx       = useRef(null)
  const audioBufferRef = useRef(null)   // decoded buffer for playback
  const sourceRef      = useRef(null)   // current AudioBufferSourceNode
  const playStartRef   = useRef(0)      // audioCtx.currentTime when play started
  const playOffsetRef  = useRef(0)      // ms position where playback started
  const rafRef         = useRef(null)

  const track = tracks.find(t => t.id === focusedId) ?? null
  const adj   = track ? (adjs[track.id] ?? { bpmOverride: null, gridOffsetMs: 0 }) : null

  // ── Load audio ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!track) { setPeaks(null); audioBufferRef.current = null; return }
    const cached = peakCache.current.get(track.id)
    if (cached) { setPeaks(cached); audioBufferRef.current = cached.audioBuffer; setLoading(false); return }
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
        const entry = { ...extractPeaks(decoded), audioBuffer: decoded }
        peakCache.current.set(track.id, entry)
        audioBufferRef.current = decoded
        setPeaks(entry)
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

  // ── Reset on track change ─────────────────────────────────────────────────
  useEffect(() => {
    if (sourceRef.current) { try { sourceRef.current.stop() } catch {} sourceRef.current = null }
    setIsPlaying(false); setPlayheadMs(0); setZoom(1); setScrollMs(0)
  }, [track?.id])

  // ── Playhead rAF ──────────────────────────────────────────────────────────
  const durationMs  = (track?.duration ?? 0) * 1000
  const visibleMs   = durationMs / Math.max(zoom, 1)
  const clampScroll = Math.max(0, Math.min(scrollMs, durationMs - visibleMs))

  useEffect(() => {
    if (!isPlaying) return
    const tick = () => {
      const ms = Math.min(
        playOffsetRef.current + (audioCtx.current.currentTime - playStartRef.current) * 1000,
        durationMs
      )
      setPlayheadMs(ms)
      // Auto-scroll: keep playhead in visible window
      setScrollMs(prev => {
        const vis = durationMs / zoom
        const end = prev + vis
        if (ms > end - vis * 0.1) return Math.min(ms - vis * 0.1, durationMs - vis)
        return prev
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isPlaying, durationMs, zoom])

  // ── Playback controls ─────────────────────────────────────────────────────
  const startPlayback = useCallback((fromMs) => {
    const buf = audioBufferRef.current
    if (!buf || !audioCtx.current) return
    audioCtx.current.resume()
    if (sourceRef.current) {
      sourceRef.current.onended = null   // prevent async onended from killing isPlaying
      try { sourceRef.current.stop() } catch {}
      sourceRef.current = null
    }
    const src = audioCtx.current.createBufferSource()
    src.buffer = buf
    src.connect(audioCtx.current.destination)
    const offsetSec = Math.max(0, fromMs / 1000)
    src.start(0, offsetSec)
    src.onended = () => setIsPlaying(false)
    sourceRef.current = src
    playStartRef.current = audioCtx.current.currentTime
    playOffsetRef.current = fromMs
    setIsPlaying(true)
  }, [])

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      const ms = playOffsetRef.current + (audioCtx.current.currentTime - playStartRef.current) * 1000
      sourceRef.current.onended = null
      try { sourceRef.current.stop() } catch {}
      sourceRef.current = null
      setPlayheadMs(Math.round(ms))
    }
    setIsPlaying(false)
  }, [])

  const handlePlayPause = useCallback(() => {
    if (isPlaying) stopPlayback()
    else startPlayback(playheadMs)
  }, [isPlaying, stopPlayback, startPlayback, playheadMs])

  const handleSeek = useCallback((ms) => {
    setPlayheadMs(ms)
    if (isPlaying) startPlayback(ms)
  }, [isPlaying, startPlayback])

  const handleZoom = (newZoom, newScroll) => {
    setZoom(Math.max(1, Math.min(128, newZoom)))
    setScrollMs(Math.max(0, newScroll))
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)', background: '#0a0e14' }}>
      {track ? (
        <WaveformCanvas
          track={track}
          peaks={peaks?.peaks ?? null}
          audioDurationMs={peaks?.audioDurationMs ?? durationMs}
          loading={loading}
          gridOffsetMs={adj.gridOffsetMs ?? 0}
          bpmOverride={adj.bpmOverride}
          startMs={clampScroll}
          endMs={clampScroll + visibleMs}
          zoom={zoom}
          scrollMs={clampScroll}
          playheadMs={playheadMs}
          onScroll={setScrollMs}
          onZoom={handleZoom}
          onSeek={handleSeek}
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
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        hasAudio={!!audioBufferRef.current}
      />
    </div>
  )
}
