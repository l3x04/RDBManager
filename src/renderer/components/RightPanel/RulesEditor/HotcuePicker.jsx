// src/renderer/components/RightPanel/RulesEditor/HotcuePicker.jsx
import { HOTCUE_COLOURS } from '../../../utils/colours.js'

const SLOTS = ['A','B','C','D','E','F','G','H']

export default function HotcuePicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 6, padding: 3 }}>
      {SLOTS.map(slot => {
        const active = slot === value
        const colour = HOTCUE_COLOURS[slot]
        return (
          <div
            key={slot}
            data-active={active}
            onClick={() => onChange(slot)}
            style={{
              width: 26, height: 26, borderRadius: 4, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              color: active ? '#fff' : colour,
              background: active ? `${colour}22` : 'transparent',
              border: `1px solid ${active ? colour : 'transparent'}`,
              transition: 'all 0.1s',
            }}
          >
            {slot}
          </div>
        )
      })}
    </div>
  )
}
