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

export default function App() {
  const [modal, setModal] = useState(null)
  const store = useAppStore()

  // On mount: restore session, load local DB, subscribe to events
  useEffect(() => {
    async function init() {
      try {
        const session = await window.api.getSession()
        store.loadSession(session)
      } catch {}

      // Try loading local DB (may already be loaded by main process auto-load)
      const tracks = await window.api.getTracks()
      if (tracks.length > 0) {
        store.setTracks(tracks)
      } else {
        // Main process hasn't finished yet — try explicitly
        const result = await window.api.loadLocalDb()
        if (result?.ok) {
          const t = await window.api.getTracks()
          store.setTracks(t)
          store.setDbError(null)
        } else if (result?.error) {
          store.setDbError(result.error)
        }
      }
    }
    init()

    const unsubLoaded = window.api.onDbLoaded(async () => {
      const tracks = await window.api.getTracks()
      store.setTracks(tracks)
      store.setDbError(null)
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
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [store.ruleSets, store.selectedTrackIds, store.trackAdjustments])

  async function handleReload() {
    const hasEdits = Object.keys(store.trackAdjustments).length > 0
    if (hasEdits && !window.confirm('Reload will clear per-track beatgrid adjustments and selection. Continue?')) return
    store.selectNone()
    useAppStore.setState({ trackAdjustments: {} })
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
    if (!window.confirm('Save all changes (BPM, generated cues) to rekordbox? A backup will be created.')) return
    try {
      const result = await window.api.saveToRekordbox({
        selectedTrackIds: [...store.selectedTrackIds],
        ruleSets: store.ruleSets,
        trackAdjustments: store.trackAdjustments,
      })
      if (result.ok) {
        const parts = []
        if (result.bpmChanges > 0) parts.push(`${result.bpmChanges} BPM change${result.bpmChanges > 1 ? 's' : ''}`)
        if (result.cuesWritten > 0) parts.push(`${result.cuesWritten} cue${result.cuesWritten > 1 ? 's' : ''}`)
        window.alert(`Saved to rekordbox: ${parts.join(', ') || 'no changes'}`)
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
