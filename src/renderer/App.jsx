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
import BackupWarningModal from './components/modals/BackupWarningModal.jsx'
import Modal from './components/modals/Modal.jsx'

export default function App() {
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [readyToReveal, setReadyToReveal] = useState(false)
  const [showBackupWarning, setShowBackupWarning] = useState(false)
  const [panelWidth, setPanelWidth] = useState(420)
  const [saveModal, setSaveModal] = useState(null) // { type: 'confirm' | 'result', ... }
  const [updateAvailable, setUpdateAvailable] = useState(null) // { version, url }
  const store = useAppStore()

  // On mount: subscribe to db:loaded to populate tracks (no session restore — always fresh from DB)
  useEffect(() => {

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

    // Check for updates
    fetch('https://api.github.com/repos/l3x04/RDBManager/releases/latest')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.tag_name) return
        const remote = data.tag_name.replace(/^v/, '')
        const local = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
        // Don't show update notification in dev mode (version unknown) or when versions match
        if (local === '0.0.0' || remote === local) return
        setUpdateAvailable({ version: remote, url: data.html_url })
      })
      .catch(() => {}) // silent fail if offline

    return () => {
      if (typeof unsubLoaded === 'function') unsubLoaded()
      if (typeof unsubError === 'function') unsubError()
    }
  }, [])

  // Save session only on crash/close (beforeunload)
  useEffect(() => {
    const saveOnExit = () => {
      if (!window.api) return
      window.api.saveSession({
        ruleSets: store.ruleSets,
        selectedTrackIds: [...store.selectedTrackIds],
        trackAdjustments: store.trackAdjustments,
        cueOverrides: store.cueOverrides,
      })
    }
    window.addEventListener('beforeunload', saveOnExit)
    return () => window.removeEventListener('beforeunload', saveOnExit)
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

  function handleSaveToRb() {
    setSaveModal({ type: 'confirm' })
  }

  async function executeSave() {
    setSaveModal(null)
    const currentOverrides = useAppStore.getState().cueOverrides
    console.log('[save-renderer] cueOverrides keys:', Object.keys(currentOverrides), 'store.cueOverrides keys:', Object.keys(store.cueOverrides))
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
        if (result.conversionsApplied > 0) parts.push(`${result.conversionsApplied} conversion${result.conversionsApplied > 1 ? 's' : ''} applied`)
        setSaveModal({ type: 'success', message: parts.join(', ') || 'No changes written.' })
      } else {
        setSaveModal({ type: 'error', message: result.error })
      }
    } catch (err) {
      setSaveModal({ type: 'error', message: err.message })
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
      {loading && <LoadingScreen reveal={readyToReveal} onRevealDone={() => { setLoading(false); setShowBackupWarning(true) }} />}
      <TopBar onReload={handleReload} />

      {updateAvailable && (
        <div style={{ background: '#1a2a1a', padding: '5px 16px', fontSize: 11, borderBottom: '1px solid #2a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ color: '#30d158' }}>v{updateAvailable.version} available</span>
          <a href={updateAvailable.url} target="_blank" rel="noreferrer"
            style={{ color: '#30d158', textDecoration: 'none', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
            onClick={(e) => { e.preventDefault(); window.api?.openExternal?.(updateAvailable.url) || window.open(updateAvailable.url) }}>
            Update
          </a>
          <button onClick={() => setUpdateAvailable(null)}
            style={{ background: 'none', border: 'none', color: 'rgba(48,209,88,0.4)', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      )}

      {store.dbError && (
        <div style={{ background: '#3a1c1c', color: '#ff453a', padding: '8px 16px', fontSize: 12, textAlign: 'center', borderBottom: '1px solid #5a2020' }}>
          {store.dbError}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: panelWidth, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TrackList />
        </div>
        <div
          style={{ width: 4, cursor: 'col-resize', background: 'var(--border)', flexShrink: 0, transition: 'background 0.1s' }}
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startW = panelWidth
            const onMove = (ev) => setPanelWidth(Math.max(250, Math.min(800, startW + ev.clientX - startX)))
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--border)'}
        />
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

      {showBackupWarning && (
        <BackupWarningModal onDismiss={() => setShowBackupWarning(false)} />
      )}

      {saveModal?.type === 'confirm' && (
        <Modal
          buttons={[
            { label: 'Cancel', onClick: () => setSaveModal(null), variant: 'ghost' },
            { label: 'Save to Rekordbox', onClick: executeSave, variant: 'danger' },
          ]}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Save to Rekordbox</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Save all changes (BPM, cues, generated cues) to rekordbox? A backup will be created automatically.
          </div>
        </Modal>
      )}

      {saveModal?.type === 'success' && (
        <Modal buttons={[{ label: 'Done', onClick: () => setSaveModal(null), variant: 'primary' }]}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#30d158' }}>Saved Successfully</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Restart rekordbox to see changes.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{saveModal.message}</div>
        </Modal>
      )}

      {saveModal?.type === 'error' && (
        <Modal buttons={[{ label: 'Close', onClick: () => setSaveModal(null), variant: 'ghost' }]}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#ff453a' }}>Save Failed</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{saveModal.message}</div>
        </Modal>
      )}
    </div>
  )
}
