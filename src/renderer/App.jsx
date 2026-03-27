// src/renderer/App.jsx
import { useEffect, useState, useRef } from 'react'
import './styles/globals.css'
import { useAppStore } from './store/appStore.js'
import { buildPreflightWarnings } from './utils/cueCalc.js'
import TrackList from './components/TrackList/TrackList.jsx'
import RightPanel from './components/RightPanel/RightPanel.jsx'
import TopBar from './components/TopBar.jsx'
import BottomBar from './components/BottomBar.jsx'
import PreflightModal from './components/modals/PreflightModal.jsx'
import SuccessModal from './components/modals/SuccessModal.jsx'

export default function App() {
  const [modal, setModal] = useState(null) // null | { type: 'preflight', warnings } | { type: 'success', result }
  const [currentDbPath, setCurrentDbPath] = useState(null)

  const store = useAppStore()

  // On mount: restore session + subscribe to db:loaded events
  useEffect(() => {
    async function init() {
      try {
        const session = await window.api.getSession()
        store.loadSession(session)
        if (session.lastDbPath) setCurrentDbPath(session.lastDbPath)
        // Pick up tracks already loaded by watcher (avoids race with db:loaded event)
        const tracks = await window.api.getTracks()
        if (tracks.length > 0) store.setTracks(tracks)
      } catch {
        // Session load failed — start fresh with default state
      }
    }
    init()

    const unsubscribe = window.api.onDbLoaded(async ({ dbPath }) => {
      setCurrentDbPath(dbPath)
      const tracks = await window.api.getTracks()
      store.setTracks(tracks)
    })

    return () => { if (typeof unsubscribe === 'function') unsubscribe() }
  }, [])

  // Debounced session autosave (~1 second)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!window.api) return
      window.api.saveSession({
        ruleSets: store.ruleSets,
        selectedTrackIds: [...store.selectedTrackIds],
        trackAdjustments: store.trackAdjustments,
        lastDbPath: currentDbPath,
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [store.ruleSets, store.selectedTrackIds, store.trackAdjustments, currentDbPath])

  async function handleReload() {
    const hasEdits = Object.keys(store.trackAdjustments).length > 0
    if (hasEdits && !window.confirm('Reload will clear per-track beatgrid adjustments and selection. Continue?')) return
    store.selectNone()
    useAppStore.setState({ trackAdjustments: {} })
    try {
      const result = await window.api.loadDatabase(currentDbPath)
      if (result?.ok) {
        const tracks = await window.api.getTracks()
        store.setTracks(tracks)
      }
    } catch (err) {
      window.alert(`Reload failed: ${err.message}`)
    }
  }

  async function handleGenerate() {
    const warnings = buildPreflightWarnings({
      selectedTrackIds: store.selectedTrackIds,
      tracks: store.tracks,
      ruleSets: store.ruleSets,
    })
    if (warnings.length > 0) {
      setModal({ type: 'preflight', warnings })
      return
    }
    await runGeneration()
  }

  async function runGeneration() {
    setModal(null)
    try {
      const result = await window.api.generate({
        selectedTrackIds: [...store.selectedTrackIds],
        ruleSets: store.ruleSets,
        trackAdjustments: store.trackAdjustments,
        sourceDbPath: currentDbPath,
      })
      if (result.ok) setModal({ type: 'success', result })
      else window.alert(`Generation failed: ${result.error}`)
    } catch (err) {
      window.alert(`Generation failed: ${err.message}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBar onReload={handleReload} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 420, flexShrink: 0, borderRight: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TrackList />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <RightPanel />
        </div>
      </div>
      <BottomBar onGenerate={handleGenerate} />

      {modal?.type === 'preflight' && (
        <PreflightModal warnings={modal.warnings} onProceed={runGeneration} onCancel={() => setModal(null)} />
      )}
      {modal?.type === 'success' && (
        <SuccessModal result={modal.result} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
