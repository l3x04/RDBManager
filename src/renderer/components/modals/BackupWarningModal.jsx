// src/renderer/components/modals/BackupWarningModal.jsx
import Modal from './Modal.jsx'

export default function BackupWarningModal({ onDismiss }) {
  return (
    <Modal buttons={[{ label: 'I Understand', onClick: onDismiss, variant: 'danger' }]}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#ff453a', marginBottom: 16, letterSpacing: '-0.02em' }}>
        WARNING
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: 8 }}>
        Back up your rekordbox database before making any changes.
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
        This software modifies your rekordbox database directly. Changes cannot be undone without a backup.
        Please ensure you have a manual copy of your database files before proceeding.
      </div>
    </Modal>
  )
}
