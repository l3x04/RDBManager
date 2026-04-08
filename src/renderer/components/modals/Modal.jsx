// src/renderer/components/modals/Modal.jsx
// Reusable styled modal component for the dark UI theme.

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
}

const panelStyle = {
  background: '#1c1c1e',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 24,
  width: 420,
  maxWidth: '90vw',
}

const btnBase = {
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 12,
  fontWeight: 600,
  padding: '9px 20px',
  cursor: 'pointer',
}

const btnVariants = {
  primary: { ...btnBase, background: 'var(--accent)', color: '#fff' },
  danger:  { ...btnBase, background: '#ff453a', color: '#fff' },
  ghost:   { ...btnBase, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-primary)' },
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children    — modal body content
 * @param {Array<{label:string, onClick:()=>void, variant?:string, disabled?:boolean}>} props.buttons
 * @param {number} [props.width]              — panel width override (default 420)
 * @param {function} [props.onClose]          — called when clicking the overlay backdrop
 */
export default function Modal({ children, buttons = [], width, onClose }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...panelStyle, ...(width ? { width } : {}) }} onClick={e => e.stopPropagation()}>
        {children}
        {buttons.length > 0 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            {buttons.map((btn, i) => (
              <button
                key={i}
                onClick={btn.onClick}
                disabled={btn.disabled}
                style={{
                  ...btnVariants[btn.variant ?? 'primary'],
                  ...(btn.disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
