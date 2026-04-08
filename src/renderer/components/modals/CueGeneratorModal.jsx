// src/renderer/components/modals/CueGeneratorModal.jsx
import { useAppStore } from '../../store/appStore.js'
import { buildPreflightWarnings } from '../../utils/cueCalc.js'
import RuleSet from '../RightPanel/RulesEditor/RuleSet.jsx'
import Modal from './Modal.jsx'

export default function CueGeneratorModal({ onClose, onGenerate }) {
  const tracks       = useAppStore(s => s.tracks)
  const selected     = useAppStore(s => s.selectedTrackIds)
  const ruleSets     = useAppStore(s => s.ruleSets)
  const addRuleSet   = useAppStore(s => s.addRuleSet)
  const removeRuleSet  = useAppStore(s => s.removeRuleSet)
  const updateRuleSet  = useAppStore(s => s.updateRuleSet)
  const addCue         = useAppStore(s => s.addGeneratedCue)
  const updateCue      = useAppStore(s => s.updateGeneratedCue)
  const removeCue      = useAppStore(s => s.removeGeneratedCue)

  const warnings = buildPreflightWarnings({ selectedTrackIds: selected, tracks, ruleSets })
  const canGenerate = selected.size > 0 && ruleSets.length > 0

  return (
    <Modal
      width={600}
      onClose={onClose}
      buttons={[
        { label: 'Cancel', onClick: onClose, variant: 'ghost' },
        { label: 'Generate', onClick: onGenerate, disabled: !canGenerate },
      ]}
    >
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Cue Generator</div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 6 }}>
        Automatically generates hotcues and memory cues based on rules. Create rule sets that reference
        an existing hotcue (the "base"), then add generated cues at bar offsets from that base.
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 16 }}>
        Example: Base = Hotcue D (the drop). Add Hotcue H at +4 bars to mark 4 bars after every drop across all selected tracks.
      </div>

      {/* Rule sets area */}
      <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
        {ruleSets.map(rs => (
          <RuleSet
            key={rs.id} ruleSet={rs}
            onUpdate={updateRuleSet} onRemove={removeRuleSet}
            onAddCue={addCue} onUpdateCue={updateCue} onRemoveCue={removeCue}
          />
        ))}
        <button onClick={addRuleSet} style={{
          width: '100%', padding: 12, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 10,
          background: 'transparent', color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 500,
          cursor: 'pointer', letterSpacing: '0.02em', transition: 'all 0.12s',
        }}>
          + Add Rule Set
        </button>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ fontSize: 11, color: '#ff9f0a', marginBottom: 6 }}>
          {warnings.map((w, i) => (
            <div key={i}>
              {w.missingCount} track{w.missingCount !== 1 ? 's' : ''} missing base hotcue {w.baseHotcue}
              {w.ruleSetName ? ` (${w.ruleSetName})` : ''}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        {selected.size} track{selected.size !== 1 ? 's' : ''} selected
        {ruleSets.length > 0 && ` \u00b7 ${ruleSets.length} rule set${ruleSets.length !== 1 ? 's' : ''}`}
      </div>
    </Modal>
  )
}
