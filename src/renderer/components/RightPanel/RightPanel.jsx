// src/renderer/components/RightPanel/RightPanel.jsx
import WaveformPanel from './WaveformPanel/WaveformPanel.jsx'
import TrackInfo from './TrackInfo.jsx'
import RulesEditor from './RulesEditor/RulesEditor.jsx'

export default function RightPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <WaveformPanel />
      <TrackInfo />
      <RulesEditor />
    </div>
  )
}
