// src/renderer/components/RightPanel/RulesEditor/RulesEditor.jsx
import { useAppStore } from '../../../store/appStore.js'
import RuleSet from './RuleSet.jsx'

export default function RulesEditor() {
  const ruleSets       = useAppStore(s => s.ruleSets)
  const addRuleSet     = useAppStore(s => s.addRuleSet)
  const removeRuleSet  = useAppStore(s => s.removeRuleSet)
  const updateRuleSet  = useAppStore(s => s.updateRuleSet)
  const addCue         = useAppStore(s => s.addGeneratedCue)
  const updateCue      = useAppStore(s => s.updateGeneratedCue)
  const removeCue      = useAppStore(s => s.removeGeneratedCue)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>
        Cue Generation Rules
      </div>
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
        cursor: 'pointer', letterSpacing: '0.02em', transition: 'all 0.12s', marginBottom: 12,
      }}>
        ＋ Add Rule Set
      </button>
    </div>
  )
}
