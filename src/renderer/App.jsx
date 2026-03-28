// src/renderer/App.jsx
import { useEffect, useState } from 'react'
import './styles/globals.css'
import { useAppStore } from './store/appStore.js'
import { buildPreflightWarnings } from './utils/cueCalc.js'
import TrackList from './components/TrackList/TrackList.jsx'
import RightPanel from './components/RightPanel/RightPanel.jsx'
import TopBar from './components/TopBar.jsx'
import BottomBar from './components/BottomBar.jsx'
import PreflightModal from './components/modals/PreflightModal.jsx'
import SuccessModal from './components/modals/SuccessModal.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'

export default function App() {
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [readyToReveal, setReadyToReveal] = useState(false)
  const store = useAppStore()

  // On mount: restore session, subscribe to db:loaded to populate tracks
  useEffect(() => {
    async function init() {
      try {
        const session = await window.api.getSession()
        store.loadSession(session)
      } catch {}
    }
    init()

    const unsubLoaded = window.api.onDbLoaded(async ({ trackCount }) => {
      const allTracks = await window.api.getTracks()
      store.setDbError(null)

      // Load tracks in batches so the loading bar shows real rendering progress
      const BATCH = 200
      for (let i = 0; i < allTracks.length; i += BATCH) {
        const batch = allTracks.slice(0, i + BATCH)
        store.setTracks(batch)
        // Report progress to loading screen
        window.dispatchEvent(new CustomEvent('render-progress', {
          detail: Math.min((i + BATCH) / allTracks.length, 1)
        }))
        // Yield to let React render and loading screen update
        await new Promise(r => requestAnimationFrame(r))
        await new Promise(r => requestAnimationFrame(r))
      }
      // Final set with all tracks
      store.setTracks(allTracks)
      await new Promise(r => requestAnimationFrame(r))
      setReadyToReveal(true)
    })

    const unsubError = window.api.onDbError(({ error }) => {
      store.setDbError(error)
    })

    return () => {
      if (typeof unsubLoaded === 'function') unsubLoaded()
      if (typeof unsubError === 'function') unsubError()
    }
  }, [])

  // Debounced session autosave (~1 second)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!window.api) return
      window.api.saveSession({
        ruleSets: store.ruleSets,
        selectedTrackIds: [...store.selectedTrackIds],
        trackAdjustments: store.trackAdjustments,
        cueOverrides: store.cueOverrides,
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [store.ruleSets, store.selectedTrackIds, store.trackAdjustments, store.cueOverrides])

  async function handleReload() {
    const hasEdits = Object.keys(store.trackAdjustments).length > 0 || Object.keys(store.cueOverrides).length > 0
    if (hasEdits && !window.confirm('Reload will clear per-track adjustments, cue edits, and selection. Continue?')) return
    store.selectNone()
    useAppStore.setState({ trackAdjustments: {}, cueOverrides: {} })
    try {
      const result = await window.api.reloadDatabase()
      if (result?.ok) {
        const tracks = await window.api.getTracks()
        store.setTracks(tracks)
        store.setDbError(null)
      } else {
        store.setDbError(result?.error ?? 'Reload failed')
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

  async function handleSaveToRb() {
    const currentOverrides = useAppStore.getState().cueOverrides
    console.log('[save-renderer] cueOverrides keys:', Object.keys(currentOverrides), 'store.cueOverrides keys:', Object.keys(store.cueOverrides))
    if (!window.confirm('Save all changes (BPM, cues, generated cues) to rekordbox? A backup will be created.')) return
    try {
      const result = await window.api.saveToRekordbox({
        selectedTrackIds: [...store.selectedTrackIds],
        ruleSets: store.ruleSets,
        trackAdjustments: store.trackAdjustments,
        cueOverrides: currentOverrides,
      })
      if (result.ok) {
        // Reload tracks from the updated temp DB
        const updatedTracks = await window.api.getTracks()
        store.setTracks(updatedTracks)

        // Clear cue overrides that have been saved
        useAppStore.setState({ cueOverrides: {} })

        const parts = []
        if (result.bpmChanges > 0) parts.push(`${result.bpmChanges} BPM change${result.bpmChanges > 1 ? 's' : ''}`)
        if (result.cuesWritten > 0) parts.push(`${result.cuesWritten} generated cue${result.cuesWritten > 1 ? 's' : ''}`)
        if (result.cueOverrideCount > 0) parts.push(`${result.cueOverrideCount} track${result.cueOverrideCount > 1 ? 's' : ''} cue-edited`)
        window.alert(`Saved. Restart rekordbox to see changes.\n${parts.join(', ') || 'No changes written.'}`)
      } else {
        window.alert(`Save failed: ${result.error}`)
      }
    } catch (err) {
      window.alert(`Save failed: ${err.message}`)
    }
  }

  async function runGeneration() {
    setModal(null)
    try {
      const result = await window.api.generate({
        selectedTrackIds: [...store.selectedTrackIds],
        ruleSets: store.ruleSets,
        trackAdjustments: store.trackAdjustments,
      })
      if (result.ok) setModal({ type: 'success', result })
      else window.alert(`Generation failed: ${result.error}`)
    } catch (err) {
      window.alert(`Generation failed: ${err.message}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {loading && <LoadingScreen reveal={readyToReveal} onRevealDone={() => setLoading(false)} />}
      <TopBar onReload={handleReload} />

      {store.dbError && (
        <div style={{ background: '#3a1c1c', color: '#ff453a', padding: '8px 16px', fontSize: 12, textAlign: 'center', borderBottom: '1px solid #5a2020' }}>
          {store.dbError}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 420, flexShrink: 0, borderRight: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TrackList />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <RightPanel />
        </div>
      </div>
      <BottomBar onGenerate={handleGenerate} onSaveToRb={handleSaveToRb} />

      {modal?.type === 'preflight' && (
        <PreflightModal warnings={modal.warnings} onProceed={runGeneration} onCancel={() => setModal(null)} />
      )}
      {modal?.type === 'success' && (
        <SuccessModal result={modal.result} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
