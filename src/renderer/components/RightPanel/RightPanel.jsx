// src/renderer/components/RightPanel/RightPanel.jsx
import WaveformPanel from './WaveformPanel/WaveformPanel.jsx'
import TrackInfo from './TrackInfo.jsx'
import CueEditor from './WaveformPanel/CueEditor.jsx'
import { useAppStore } from '../../store/appStore.js'

export default function RightPanel() {
  const focusedId = useAppStore(s => s.focusedTrackId)
  const track = useAppStore(s => s.tracks.find(t => t.id === focusedId))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <WaveformPanel />
      <TrackInfo />
      <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid var(--border)' }}>
        <CueEditor track={track} playheadMs={0} />
      </div>
    </div>
  )
}
