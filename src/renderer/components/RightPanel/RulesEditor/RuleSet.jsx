// src/renderer/components/RightPanel/RulesEditor/RuleSet.jsx
import HotcuePicker from './HotcuePicker.jsx'
import GeneratedCueRow from './GeneratedCueRow.jsx'

export default function RuleSet({ ruleSet, onUpdate, onRemove, onAddCue, onUpdateCue, onRemoveCue }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 10, background: 'var(--bg-panel)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>Base</span>
        <HotcuePicker value={ruleSet.baseHotcue} onChange={v => onUpdate(ruleSet.id, { baseHotcue: v })} />
        <input
          value={ruleSet.name}
          onChange={e => onUpdate(ruleSet.id, { name: e.target.value })}
          placeholder="Rule set name..."
          style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 12, color: 'var(--text-secondary)', outline: 'none' }}
        />
        <button onClick={() => onRemove(ruleSet.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,69,58,0.5)', fontSize: 11, cursor: 'pointer', fontWeight: 500, padding: '3px 6px' }}>Remove</button>
      </div>
      <div style={{ padding: '8px 10px 4px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {ruleSet.generatedCues.map(cue => (
          <GeneratedCueRow key={cue.id} cue={cue} ruleSetId={ruleSet.id} onUpdate={onUpdateCue} onRemove={onRemoveCue} />
        ))}
        <button onClick={() => onAddCue(ruleSet.id)} style={{ background: 'none', border: 'none', color: 'rgba(10,132,255,0.75)', fontSize: 11, fontWeight: 500, cursor: 'pointer', textAlign: 'left', padding: '6px 2px 8px' }}>
          ＋ Add cue
        </button>
      </div>
    </div>
  )
}
