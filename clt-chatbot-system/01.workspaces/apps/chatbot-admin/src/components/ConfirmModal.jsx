import React from 'react';
import styles from './ConfirmModal.module.css';

function ConfirmModal({ isOpen, message, onConfirm, onCancel }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <p className={styles.message}>{message}</p>
        <div className={styles.buttonGroup}>
          <button onClick={onCancel} className={styles.cancelButton}>
            Cancel
          </button>
          <button onClick={onConfirm} className={styles.confirmButton}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;