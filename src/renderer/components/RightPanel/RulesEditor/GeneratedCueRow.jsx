// src/renderer/components/RightPanel/RulesEditor/GeneratedCueRow.jsx
import { RB_COLOURS } from '../../../utils/colours.js'

const SLOTS = ['A','B','C','D','E','F','G','H']

function ColourSwatches({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {RB_COLOURS.map(hex => (
        <div
          key={hex}
          onClick={() => onChange(hex)}
          title={hex}
          style={{
            width: 13, height: 13, borderRadius: 3, background: hex, cursor: 'pointer', flexShrink: 0,
            outline: value === hex ? '2px solid #fff' : '2px solid transparent',
            outlineOffset: 1,
          }}
        />
      ))}
    </div>
  )
}

export default function GeneratedCueRow({ cue, ruleSetId, onUpdate, onRemove }) {
  const field = (key, value) => onUpdate(ruleSetId, cue.id, { [key]: value })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.055)', borderRadius: 7 }}>
      <ColourSwatches value={cue.colour} onChange={v => field('colour', v)} />
      <select value={cue.type} onChange={e => field('type', e.target.value)}
        style={{ background: cue.type === 'hotcue' ? '#0d1e2e' : '#1e1c09', color: cue.type === 'hotcue' ? '#409cff' : '#ffd60a', border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 600, letterSpacing: '0.07em', padding: '2px 6px', textTransform: 'uppercase', cursor: 'pointer' }}>
        <option value="hotcue">Hotcue</option>
        <option value="memory">Memory</option>
      </select>
      {cue.type === 'hotcue' && (
        <select value={cue.slot ?? 'A'} onChange={e => field('slot', e.target.value)}
          style={{ background: '#1c1c1e', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', padding: '2px 6px', cursor: 'pointer' }}>
          {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      <input value={cue.label} onChange={e => field('label', e.target.value)} placeholder="Label"
        style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 11, color: 'var(--text-secondary)', outline: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 4px' }}>
        <button onClick={() => field('barOffset', (cue.barOffset ?? 0) - 1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px' }}>−</button>
        <span style={{ fontSize: 11, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'center' }}>
          {cue.barOffset > 0 ? `+${cue.barOffset}` : cue.barOffset} bars
        </span>
        <button onClick={() => field('barOffset', (cue.barOffset ?? 0) + 1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px' }}>+</button>
      </div>
      <button onClick={() => onRemove(ruleSetId, cue.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,69,58,0.5)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>✕</button>
    </div>
  )
}
