// src/renderer/components/RightPanel/WaveformPanel/WaveformCanvas.jsx
import { useEffect, useRef, useState } from 'react'
import { HOTCUE_COLOURS } from '../../../utils/colours.js'

function resolvePx(slice, x, W) {
  if (!slice.length) return null
  const f0 = x / W * slice.length
  const f1 = (x + 1) / W * slice.length
  const i0 = Math.floor(f0)
  const i1 = Math.ceil(f1)

  if (i1 - i0 <= 1) {
    const frac = f0 - i0
    const p0   = slice[Math.min(i0, slice.length - 1)]
    const p1   = slice[Math.min(i0 + 1, slice.length - 1)] ?? p0
    return {
      max: p0.max + (p1.max - p0.max) * frac,
      min: p0.min + (p1.min - p0.min) * frac,
      rms: p0.rms + (p1.rms - p0.rms) * frac,
    }
  }

  let pMax = 0, pMin = 0, sumSq = 0, n = 0
  for (let i = i0; i < i1 && i < slice.length; i++) {
    const p = slice[i]; if (!p) continue
    if (p.max > pMax) pMax = p.max
    if (p.min < pMin) pMin = p.min
    sumSq += p.rms * p.rms; n++
  }
  return { max: pMax, min: pMin, rms: n > 0 ? Math.sqrt(sumSq / n) : 0 }
}

export default function WaveformCanvas({
  track, peaks, audioDurationMs, loading,
  gridOffsetMs = 0, bpmOverride = null,
  startMs = 0, endMs,
  zoom = 1, scrollMs = 0,
  playheadMs = null,
  onScroll, onZoom, onSeek,
}) {
  const canvasRef  = useRef(null)
  const dragRef    = useRef(null)
  const propsRef   = useRef({})
  const [canvasW, setCanvasW] = useState(900)
  propsRef.current = { startMs, endMs, zoom, scrollMs, track, onScroll, onZoom, onSeek, playheadMs }

  // ── Resize canvas to match CSS width ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0].contentRect.width)
      if (w > 0) setCanvasW(w)
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // ── Drawing ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !track) return
    canvas.width = canvasW
    const ctx = canvas.getContext('2d')
    const W = canvasW
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const bpm        = bpmOverride ?? track.bpm
    const durationMs = track.duration * 1000
    const waveformMs = audioDurationMs ?? durationMs
    const visEnd     = endMs ?? durationMs
    const spanMs     = visEnd - startMs
    if (spanMs <= 0) return
    const msPerPx = spanMs / W

    // ── Waveform ─────────────────────────────────────────────────────────
    if (loading) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Loading waveform…', W / 2, H / 2 + 4)
      ctx.textAlign = 'left'
    } else if (peaks && peaks.length > 0) {
      const effectiveEnd = Math.min(visEnd, waveformMs)
      const waveW        = Math.round((effectiveEnd - startMs) / spanMs * W)
      const startFrac    = startMs      / waveformMs
      const endFrac      = effectiveEnd / waveformMs
      const i0           = Math.floor(startFrac * peaks.length)
      const i1           = Math.ceil(endFrac   * peaks.length)
      const slice        = peaks.slice(i0, i1)
      const mid          = H / 2

      for (let x = 0; x < waveW; x++) {
        const p = resolvePx(slice, x, waveW)
        if (!p) continue
        const amp = Math.max(Math.abs(p.max), Math.abs(p.min))
        const oh  = Math.max(1, amp   * mid * 0.95)
        const rh  = Math.max(1, p.rms * mid * 1.1)
        const sh  = Math.max(0.5, p.rms * mid * 0.38)
        ctx.fillStyle = 'rgba(8,90,210,0.32)';  ctx.fillRect(x, mid - oh, 1, oh * 2)
        ctx.fillStyle = 'rgba(30,140,255,0.88)'; ctx.fillRect(x, mid - rh, 1, rh * 2)
        ctx.fillStyle = 'rgba(120,190,255,0.55)'; ctx.fillRect(x, mid - sh, 1, sh * 2)
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(0, H / 2 - 1, W, 2)
    }

    // ── Beat grid ─────────────────────────────────────────────────────────
    const useAnlz = track.beats && track.beats.length > 0 && !bpmOverride
    if (useAnlz) {
      // Exact ANLZ positions — used when BPM hasn't been overridden
      for (const beat of track.beats) {
        const t = beat.timeMs + gridOffsetMs
        if (t < startMs || t > visEnd) continue
        const x     = (t - startMs) / msPerPx
        const isBar = beat.beatNumber === 1
        ctx.strokeStyle = isBar ? 'rgba(220,50,50,0.85)' : 'rgba(140,140,140,0.28)'
        ctx.lineWidth   = isBar ? 1 : 0.5
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
    } else if (bpm > 0) {
      // Computed grid: use first ANLZ beat as anchor if available
      const firstBeatMs = (track.beats && track.beats.length > 0) ? track.beats[0].timeMs : 0
      const beatMs    = 60000 / bpm
      const barMs     = beatMs * 4
      const gridStart = (((firstBeatMs + gridOffsetMs) % barMs) + barMs) % barMs
      let beatIndex   = Math.ceil((startMs - gridStart) / beatMs)
      if (beatIndex < 0) beatIndex = 0
      for (;;) {
        const t = gridStart + beatIndex * beatMs
        if (t > visEnd) break
        const x     = (t - startMs) / msPerPx
        const isBar = beatIndex % 4 === 0
        ctx.strokeStyle = isBar ? 'rgba(220,50,50,0.85)' : 'rgba(140,140,140,0.28)'
        ctx.lineWidth   = isBar ? 1 : 0.5
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
        beatIndex++
      }
    }

    // ── Cue markers ───────────────────────────────────────────────────────
    const drawMarker = (posMs, label, colour) => {
      if (posMs < startMs || posMs > visEnd) return
      const x = (posMs - startMs) / msPerPx
      ctx.strokeStyle = colour; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ctx.fillStyle = colour
      ctx.beginPath()
      ctx.moveTo(x, 0); ctx.lineTo(x + 14, 0); ctx.lineTo(x + 14, 12)
      ctx.lineTo(x + 8, 16); ctx.lineTo(x, 16); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 9px Inter, system-ui, sans-serif'
      ctx.fillText(label, x + 3, 11)
    }
    for (const hc of (track.hotcues ?? []))
      drawMarker(hc.positionMs, hc.slot, hc.colour ?? HOTCUE_COLOURS[hc.slot])
    for (const mc of (track.memoryCues ?? []))
      drawMarker(mc.positionMs, '●', mc.colour ?? '#ffd60a')

    // ── Playhead ──────────────────────────────────────────────────────────
    if (playheadMs != null && playheadMs >= startMs && playheadMs <= visEnd) {
      const x = (playheadMs - startMs) / msPerPx
      ctx.strokeStyle = '#1aff6e'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }

  }, [track, peaks, audioDurationMs, loading, gridOffsetMs, bpmOverride, startMs, endMs, playheadMs, canvasW, track?.beats])

  // ── Interaction ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onMouseDown = (e) => {
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startScrollMs: propsRef.current.scrollMs, hasDragged: false }
      canvas.style.cursor = 'grabbing'
    }

    const onMouseMove = (e) => {
      if (!dragRef.current) return
      if (Math.abs(e.clientX - dragRef.current.startX) > 4) dragRef.current.hasDragged = true
      if (!dragRef.current.hasDragged) return
      const { startMs, endMs, track, onScroll } = propsRef.current
      if (!track) return
      const durationMs = track.duration * 1000
      const spanMs     = (endMs ?? durationMs) - startMs
      const msPerPx    = spanMs / canvas.offsetWidth
      const deltaMs    = (dragRef.current.startX - e.clientX) * msPerPx
      onScroll?.(Math.max(0, Math.min(dragRef.current.startScrollMs + deltaMs, durationMs - spanMs)))
    }

    const onMouseUp = (e) => {
      if (dragRef.current && !dragRef.current.hasDragged) {
        const { startMs, endMs, track, onSeek } = propsRef.current
        if (track && onSeek) {
          const durationMs = track.duration * 1000
          const spanMs     = (endMs ?? durationMs) - startMs
          const rect       = canvas.getBoundingClientRect()
          const frac       = (e.clientX - rect.left) / rect.width
          onSeek(Math.max(0, Math.min(startMs + frac * spanMs, durationMs)))
        }
      }
      dragRef.current = null
      canvas.style.cursor = 'grab'
    }

    const onWheel = (e) => {
      e.preventDefault()
      const { startMs, endMs, zoom, track, onZoom } = propsRef.current
      if (!track) return
      const durationMs = track.duration * 1000
      const spanMs     = (endMs ?? durationMs) - startMs
      const rect       = canvas.getBoundingClientRect()
      const cursorFrac = (e.clientX - rect.left) / rect.width
      const cursorMs   = startMs + cursorFrac * spanMs
      const newZoom    = Math.max(1, Math.min(128, zoom * Math.exp(-e.deltaY * 0.0035)))
      const newVisible = durationMs / newZoom
      onZoom?.(newZoom, Math.max(0, Math.min(cursorMs - cursorFrac * newVisible, durationMs - newVisible)))
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.style.cursor = 'grab'
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={canvasW}
      height={110}
      style={{ width: '100%', height: 110, display: 'block', background: '#070d14', userSelect: 'none' }}
    />
  )
}
