// src/renderer/components/LoadingScreen.jsx
import { useState, useEffect } from 'react'
import '../styles/loading.css'

const BAR_COUNT = 28
const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
  const center = (BAR_COUNT - 1) / 2
  const dist = Math.abs(i - center) / center
  const side = i < center ? -1 : 1
  return {
    height: 20 + (1 - dist) * 36,
    dur: (0.8 + dist * 0.7).toFixed(2),
    delay: (i * 0.04).toFixed(2),
    opacity: (0.35 + (1 - dist) * 0.65).toFixed(2),
    // Burst animation: bars scatter outward from center
    burstDelay: (dist * 0.12).toFixed(2),
    burstDur: (0.35 + dist * 0.25).toFixed(2),
    scatterY: `${side * (20 + (1 - dist) * 40)}px`,
  }
})

const PHASE_LABELS = {
  init:    'Initialising…',
  decrypt: 'Decrypting database…',
  tracks:  'Loading tracks…',
  beats:   'Reading beat grids…',
  render:  'Preparing interface…',
  done:    'Ready',
}

// Progress weights — reserve 50% for React rendering (it's half the total time)
function computeOverall(phase, phaseProgress) {
  switch (phase) {
    case 'decrypt': return 0.06 * phaseProgress
    case 'tracks':  return 0.06 + 0.02 * phaseProgress
    case 'beats':   return 0.08 + 0.42 * phaseProgress  // caps at 0.50
    default:        return 0
  }
}

export default function LoadingScreen({ reveal, onRevealDone }) {
  const [phase, setPhase]       = useState('init')
  const [progress, setProgress] = useState(0)
  const [error, setError]       = useState(null)
  const [revealing, setRevealing] = useState(false)

  useEffect(() => {
    const unsubProgress = window.api.onDbProgress((data) => {
      setPhase(data.phase)
      setProgress(computeOverall(data.phase, data.progress))
    })
    const unsubLoaded = window.api.onDbLoaded(() => {
      setPhase('render')
    })
    const unsubError = window.api.onDbError(({ error }) => setError(error))

    // Listen for real render progress from App.jsx batch loading
    const onRenderProgress = (e) => {
      setProgress(0.50 + e.detail * 0.48) // 50% → 98%
    }
    window.addEventListener('render-progress', onRenderProgress)

    return () => {
      unsubProgress(); unsubLoaded(); unsubError()
      window.removeEventListener('render-progress', onRenderProgress)
    }
  }, [])

  useEffect(() => {
    if (reveal && !revealing) {
      setProgress(1)
      setPhase('done')
      const t = setTimeout(() => setRevealing(true), 200)
      return () => clearTimeout(t)
    }
  }, [reveal, revealing])

  useEffect(() => {
    if (revealing) {
      const timer = setTimeout(onRevealDone, 900)
      return () => clearTimeout(timer)
    }
  }, [revealing, onRevealDone])

  return (
    <div className={`loading-screen${revealing ? ' loading-reveal' : ''}`}>
      <div className="loading-content">
        <div className="loading-title">RDBManager</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: -4, letterSpacing: '0.15em' }}>by L£X</div>

        <div className="freq-bars">
          {bars.map((bar, i) => (
            <div
              key={i}
              className="freq-bar"
              style={{
                height: bar.height,
                '--dur': `${bar.dur}s`,
                '--delay': `${bar.delay}s`,
                '--opacity': bar.opacity,
                '--burst-delay': `${bar.burstDelay}s`,
                '--burst-dur': `${bar.burstDur}s`,
                '--scatter-y': bar.scatterY,
              }}
            />
          ))}
        </div>

        {error ? (
          <div className="loading-error">{error}</div>
        ) : (
          <>
            <div className="loading-phase">{PHASE_LABELS[phase] ?? ''}</div>
            <div className="loading-progress-track">
              <div className="loading-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
